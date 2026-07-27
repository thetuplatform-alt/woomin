import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { isInternalAppHost } from '@/lib/app-url'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'
import {
  getEmailTransport,
  getEmailTransportFromSnapshot,
  type EmailProvider,
  type EmailPayload,
  type EmailTransportSnapshot,
} from '@/lib/email-transport'
import { getNewsletterSettings } from '@/lib/newsletter/settings'
import { assertEmailConsent, createUnsubscribeToken } from '@/lib/newsletter/consent'
import { processPendingUnsubscribeOutbox } from '@/lib/newsletter/unsubscribe-outbox'
import { getAudienceUsers, parseSegmentJson } from '@/lib/newsletter/audience'
import { makeTrackingToken, normalizeNewsletterContent, renderBodyText, renderCampaignHtml } from '@/lib/newsletter/render'

const BATCH_SIZE = 500
const CRON_WINDOW_MS = 55_000
const RECIPIENT_LEASE_MS = 10 * 60 * 1000
const RESEND_BATCH_MAX_SIZE = 100
const BATCH_INTERVAL_MS = 5_000

type NewsletterSenderSnapshot = Awaited<ReturnType<typeof getNewsletterSettings>> & {
  emailProvider: EmailProvider
  transport?: EmailTransportSnapshot
  capturedAt: string
}

type NewsletterCampaignForSend = Prisma.NewsletterCampaignGetPayload<{ include: { coupon: true } }>
type NewsletterRecipientForSend = Prisma.NewsletterRecipientGetPayload<{ include: { user: true } }>

type PreparedNewsletterEmail = {
  recipient: NewsletterRecipientForSend
  payload: EmailPayload
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stableDigest(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function trackingDigest(value: string) {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || 'newsletter-tracking'
  return crypto.createHmac('sha256', secret).update(value).digest('hex')
}

function makeRecipientIdempotencyKey(campaignId: string, recipientId: string) {
  return `newsletter:${campaignId}:${recipientId}`
}

function makeBatchIdempotencyKey(campaignId: string, recipientIds: string[]) {
  return `newsletter:${campaignId}:batch:${stableDigest(recipientIds.join(',')).slice(0, 24)}`
}

function scopeForType(type: 'GENERAL' | 'PROMO') {
  return type === 'PROMO' ? 'marketing' : 'general'
}

async function markAlert(params: {
  campaignId?: string
  type: 'INFO' | 'WARNING' | 'ERROR'
  title: string
  message: string
}) {
  await prisma.newsletterAlert.create({ data: params })
}

export async function prepareNewsletterRecipients(campaignId: string) {
  const campaign = await prisma.newsletterCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { createdBy: { select: { id: true, role: true } } },
  })
  const users = await getAudienceUsers({
    type: campaign.type,
    segment: parseSegmentJson(campaign.segmentJson),
    createdById: campaign.createdById,
    createdByRole: campaign.createdBy.role,
    limit: 50000,
  })
  for (const user of users) {
    const consentType = campaign.type === 'PROMO' ? 'marketing' : 'general'
    const consent = await assertEmailConsent(user.id, consentType, user.email)
    const existing = await prisma.newsletterRecipient.findUnique({
      where: { campaignId_toEmail: { campaignId, toEmail: user.email.toLowerCase() } },
      select: { status: true, isTest: true },
    })
    if (existing && !existing.isTest && ['SENT', 'PROCESSING', 'BOUNCED'].includes(existing.status)) {
      continue
    }
    await prisma.newsletterRecipient.upsert({
      where: { campaignId_toEmail: { campaignId, toEmail: user.email.toLowerCase() } },
      create: {
        campaignId,
        userId: user.id,
        toEmail: user.email.toLowerCase(),
        toName: user.name,
        status: consent.allowed ? 'PENDING' : 'SKIPPED',
        skipReason: consent.reason,
      },
      update: {
        userId: user.id,
        toName: user.name,
        ...(consent.allowed
          ? { status: 'PENDING', skipReason: null }
          : { status: 'SKIPPED', skipReason: consent.reason }),
      },
    })
  }

  const counts = await prisma.newsletterRecipient.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true,
  })
  const map = new Map(counts.map((row) => [row.status, row._count]))
  await prisma.newsletterCampaign.update({
    where: { id: campaignId },
    data: {
      totalRecipients: map.get('PENDING') || 0,
      skippedCount: map.get('SKIPPED') || 0,
      sentCursor: 0,
    },
  })
}

async function sendRecipientBatch(campaignId: string, recipientIds: string[]) {
  if (recipientIds.length === 0) return
  const [campaign, recipients, settings] = await Promise.all([
    prisma.newsletterCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { coupon: true },
    }),
    prisma.newsletterRecipient.findMany({
      where: { id: { in: recipientIds } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }),
    getNewsletterSettings(),
  ])

  if (campaign.status !== 'SENDING') {
    await prisma.newsletterRecipient.updateMany({
      where: { id: { in: recipientIds }, status: 'PROCESSING' },
      data: { status: 'PENDING' },
    })
    return
  }
  const snapshot = getSenderSnapshot(campaign.senderSnapshot, settings)
  const transport = getEmailTransportFromSnapshot(snapshot.transport) || (await getEmailTransport(snapshot.emailProvider))
  if (!transport) throw new Error('Email 服務未設定')

  const prepared: PreparedNewsletterEmail[] = []
  for (const item of recipients) {
    if (item.status !== 'PROCESSING') continue
    const payload = await prepareRecipientEmail(campaign, item, snapshot)
    if (payload) prepared.push({ recipient: item, payload })
  }

  if (prepared.length === 0) return

  const canUseBatch = snapshot.emailProvider === 'resend' && typeof transport.sendBatch === 'function' && prepared.length > 1
  const results = canUseBatch
    ? await transport.sendBatch!(
        prepared.map((item) => item.payload),
        { idempotencyKey: makeBatchIdempotencyKey(campaign.id, prepared.map((item) => item.recipient.id)) }
      )
    : await Promise.all(prepared.map((item) => transport.send(item.payload)))

  if (results.length !== prepared.length) {
    throw new Error(`寄信服務回傳數量不一致：預期 ${prepared.length}，實際 ${results.length}`)
  }

  await markPreparedEmailsSent(campaign.id, prepared, results)
}

async function prepareRecipientEmail(
  campaign: NewsletterCampaignForSend,
  recipient: NewsletterRecipientForSend,
  snapshot: NewsletterSenderSnapshot
): Promise<EmailPayload | null> {
  const consentType = campaign.type === 'PROMO' ? 'marketing' : 'general'
  const consent = await assertEmailConsent(recipient.userId, consentType, recipient.toEmail)
  if (!consent.allowed) {
    const skipped = await prisma.newsletterRecipient.updateMany({
      where: { id: recipient.id, status: 'PROCESSING' },
      data: { status: 'SKIPPED', skipReason: consent.reason },
    })
    if (skipped.count === 1) {
      await prisma.newsletterCampaign.update({
        where: { id: campaign.id },
        data: { skippedCount: { increment: 1 } },
      })
    }
    return null
  }

  const token = createUnsubscribeToken({
    userId: recipient.userId || `external:${recipient.id}`,
    email: recipient.toEmail,
    scope: scopeForType(campaign.type),
  })
  const unsubscribeUrl = `${snapshot.appUrl}/unsubscribe?email=${encodeURIComponent(recipient.toEmail)}&token=${encodeURIComponent(token)}&campaignId=${campaign.id}`
  const context = {
    type: campaign.type,
    subject: campaign.subject,
    preheader: campaign.preheader,
    siteName: snapshot.siteName,
    siteLogo: snapshot.siteLogo,
    appUrl: snapshot.appUrl,
    footerName: snapshot.footerName,
    footerAddress: snapshot.footerAddress,
    footerEmail: snapshot.footerEmail,
    unsubscribeUrl,
    recipientName: recipient.toName,
    couponCode: campaign.coupon?.code,
    couponExpiresAt: campaign.coupon?.expiresAt,
    mode: 'send' as const,
  }
  const content = normalizeNewsletterContent(campaign.contentJson)
  let html = renderCampaignHtml(content, context)
  html = await rewriteTrackedLinks({
    html,
    campaignId: campaign.id,
    recipientId: recipient.id,
    appUrl: snapshot.appUrl,
  })
  html = html.replace('</body>', `<img src="${snapshot.appUrl}/api/track/open/${recipient.id}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;"> </body>`)
  const text = campaign.bodyText || renderBodyText(content, context)

  return {
    from: `${snapshot.senderName} <${snapshot.fromEmail}>`,
    to: [recipient.toEmail],
    subject: campaign.subject,
    html,
    text,
    replyTo: snapshot.replyTo,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Newsletter-Campaign': campaign.id,
    },
    idempotencyKey: makeRecipientIdempotencyKey(campaign.id, recipient.id),
  }
}

async function markPreparedEmailsSent(
  campaignId: string,
  prepared: PreparedNewsletterEmail[],
  results: Array<{ messageId?: string }>
) {
  let sentCount = 0
  const resetSoftSuspendedUserIds: string[] = []
  for (const [index, item] of prepared.entries()) {
    const sent = await prisma.newsletterRecipient.updateMany({
      where: { id: item.recipient.id, status: 'PROCESSING' },
      data: {
        status: 'SENT',
        providerMessageId: results[index]?.messageId,
        sentAt: new Date(),
      },
    })
    if (sent.count === 1) {
      sentCount++
      if (item.recipient.userId && item.recipient.user?.emailBounceState === 'SOFT_SUSPENDED') {
        resetSoftSuspendedUserIds.push(item.recipient.userId)
      }
    }
  }
  if (sentCount === 0) return

  await prisma.$transaction([
    prisma.newsletterCampaign.update({
      where: { id: campaignId },
      data: { sentCount: { increment: sentCount }, sentCursor: { increment: sentCount } },
    }),
    ...(resetSoftSuspendedUserIds.length
      ? [
          prisma.user.updateMany({
            where: { id: { in: resetSoftSuspendedUserIds } },
            data: { emailBounceState: 'NONE', emailInvalidAt: null, emailBounceCount: 0 },
          }),
        ]
      : []),
  ])
}

async function rewriteTrackedLinks(params: {
  html: string
  campaignId: string
  recipientId: string
  appUrl: string
}) {
  const hrefPattern = /href="([^"]+)"/g
  const replacements: Array<{ from: string; to: string }> = []
  let occurrence = 0
  for (const match of params.html.matchAll(hrefPattern)) {
    const target = match[1]
    if (!target || target.startsWith('mailto:') || target.includes('/unsubscribe')) continue
    const index = occurrence++
    const token = await createTrackingLink({
      campaignId: params.campaignId,
      recipientId: params.recipientId,
      targetUrl: appendNewsletterUtm(target, params.campaignId),
      seed: target,
      occurrence: index,
    })
    replacements.push({ from: `href="${target}"`, to: `href="${params.appUrl}/api/track/click/${token}"` })
  }
  return replacements.reduce((html, item) => html.replace(item.from, item.to), params.html)
}

async function createTrackingLink(params: {
  campaignId: string
  recipientId: string
  targetUrl: string
  seed: string
  occurrence: number
}) {
  const token = trackingDigest(
    `${params.campaignId}:${params.recipientId}:${params.occurrence}:${params.seed}:${params.targetUrl}`
  ).slice(0, 32)
  await prisma.newsletterLink.upsert({
    where: { token },
    create: {
      campaignId: params.campaignId,
      recipientId: params.recipientId,
      token,
      targetUrl: params.targetUrl,
    },
    update: {
      targetUrl: params.targetUrl,
    },
  })
  return token
}

function appendNewsletterUtm(raw: string, campaignId: string): string {
  try {
    const url = raw.startsWith('/') ? new URL(raw, 'http://local') : new URL(raw)
    url.searchParams.set('utm_source', 'newsletter')
    url.searchParams.set('utm_medium', 'email')
    url.searchParams.set('utm_campaign', campaignId)
    url.searchParams.set('utm_content', 'email')
    const output = url.toString()
    return raw.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : output
  } catch {
    return raw
  }
}

export async function sendNewsletterTestEmail(campaignId: string, to: string) {
  const [campaign, settings] = await Promise.all([
    prisma.newsletterCampaign.findUniqueOrThrow({ where: { id: campaignId }, include: { coupon: true } }),
    getNewsletterSettings(),
  ])
  const transport = await getEmailTransport()
  if (!transport) return { success: false, error: 'Email 服務未設定' }

  const unsubscribeUrl = `${settings.appUrl}/unsubscribe?email=${encodeURIComponent(to)}&token=test`
  const context = {
    type: campaign.type,
    subject: campaign.subject,
    preheader: campaign.preheader,
    siteName: settings.siteName,
    siteLogo: settings.siteLogo,
    appUrl: settings.appUrl,
    footerName: settings.footerName || settings.siteName,
    footerAddress: settings.footerAddress,
    footerEmail: settings.footerEmail,
    unsubscribeUrl,
    recipientName: '測試同學',
    couponCode: campaign.coupon?.code,
    couponExpiresAt: campaign.coupon?.expiresAt,
    mode: 'test' as const,
  }
  const content = normalizeNewsletterContent(campaign.contentJson)
  const html = renderCampaignHtml(content, context)
  const result = await transport.send({
    from: `${settings.senderName} <${settings.fromEmail}>`,
    to: [to],
    subject: `[測試] ${campaign.subject}`,
    html,
    text: renderBodyText(content, context),
    replyTo: settings.replyTo,
  })

  await prisma.newsletterRecipient.create({
    data: {
      campaignId,
      toEmail: `__test__:${makeTrackingToken(`${campaignId}:${to}`)}:${to.toLowerCase()}`,
      toName: to,
      status: 'SENT',
      isTest: true,
      providerMessageId: result.messageId,
      sentAt: new Date(),
    },
  }).catch(() => undefined)

  return { success: true, data: { messageId: result.messageId } }
}

function getDispatchBatchSize(campaign: { ratePerMinute: number | null; senderSnapshot: unknown }) {
  const rate = Math.max(1, campaign.ratePerMinute || 60)
  const snapshot = campaign.senderSnapshot && typeof campaign.senderSnapshot === 'object'
    ? campaign.senderSnapshot as Partial<NewsletterSenderSnapshot>
    : null
  const isResend = snapshot?.emailProvider === 'resend' || snapshot?.transport?.provider === 'resend'
  if (!isResend) return 1

  const slicesPerMinute = Math.ceil(60_000 / BATCH_INTERVAL_MS)
  return Math.min(
    BATCH_SIZE,
    RESEND_BATCH_MAX_SIZE,
    Math.max(1, Math.ceil(rate / slicesPerMinute))
  )
}

function getDispatchDelayMs(ratePerMinute: number, sentOrAttempted: number) {
  return Math.max(0, Math.ceil((60_000 * sentOrAttempted) / Math.max(1, ratePerMinute)))
}

export async function dispatchNewsletters(options: { windowMs?: number } = {}) {
  const started = Date.now()
  const windowMs = Math.min(CRON_WINDOW_MS, Math.max(1000, options.windowMs ?? CRON_WINDOW_MS))
  await processPendingUnsubscribeOutbox()
  await prisma.siteSetting.upsert({
    where: { key: SETTING_KEYS.NEWSLETTER_LAST_CRON_HEARTBEAT_AT },
    update: { value: new Date().toISOString() },
    create: { key: SETTING_KEYS.NEWSLETTER_LAST_CRON_HEARTBEAT_AT, value: new Date().toISOString() },
  })

  const staleHeartbeat = new Date(Date.now() - 5 * 60 * 1000)
  await prisma.newsletterCampaign.updateMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    data: { status: 'QUEUED' },
  })

  const campaigns = await prisma.newsletterCampaign.findMany({
    where: {
      OR: [
        { status: 'QUEUED' },
        { status: 'SENDING', lastHeartbeatAt: { lt: staleHeartbeat } },
      ],
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    take: 3,
  })
  if (campaigns.length) {
    console.info(`[newsletter] dispatch picked ${campaigns.length} campaign(s)`)
  }

  for (const campaign of campaigns) {
    const claimed = await prisma.newsletterCampaign.updateMany({
      where: {
        id: campaign.id,
        OR: [
          { status: 'QUEUED' },
          { status: 'SENDING', lastHeartbeatAt: { lt: staleHeartbeat } },
        ],
      },
      data: { status: 'SENDING', lastHeartbeatAt: new Date() },
    })
    if (claimed.count !== 1) continue
    console.info(`[newsletter] dispatch started campaign=${campaign.id} status=${campaign.status}`)

    const rate = Math.max(1, campaign.ratePerMinute || 60)
    const batchSize = getDispatchBatchSize(campaign)
    while (Date.now() - started < windowMs) {
      const fresh = await prisma.newsletterCampaign.findUnique({
        where: { id: campaign.id },
        select: { status: true },
      })
      if (!fresh || fresh.status !== 'SENDING') break

      const recipientIds: string[] = []
      for (let i = 0; i < batchSize; i++) {
        const recipientId = await claimNextRecipient(campaign.id)
        if (!recipientId) break
        recipientIds.push(recipientId)
      }
      if (recipientIds.length === 0) {
        const activeProcessing = await prisma.newsletterRecipient.count({
          where: {
            campaignId: campaign.id,
            isTest: false,
            status: 'PROCESSING',
            updatedAt: { gte: new Date(Date.now() - RECIPIENT_LEASE_MS) },
          },
        })
        if (activeProcessing > 0) break
        const counts = await prisma.newsletterRecipient.groupBy({
          by: ['status'],
          where: { campaignId: campaign.id, isTest: false },
          _count: true,
        })
        const failed = counts.find((row) => row.status === 'FAILED')?._count || 0
        await prisma.newsletterCampaign.update({
          where: { id: campaign.id },
          data: { status: failed > 0 ? 'PARTIAL_FAILED' : 'SENT' },
        })
        console.info(`[newsletter] dispatch completed campaign=${campaign.id} failed=${failed}`)
        break
      }

      try {
        console.info(`[newsletter] dispatch sending campaign=${campaign.id} recipients=${recipientIds.length}`)
        await sendRecipientBatch(campaign.id, recipientIds)
      } catch (error) {
        const message = error instanceof Error ? error.message : '發送失敗'
        const lowerMessage = message.toLowerCase()
        const isRateLimited = message.includes('429') || lowerMessage.includes('rate limit')
        const isAuthFailure = message.includes('401') || lowerMessage.includes('unauthorized')
        const failedRecipients = await prisma.newsletterRecipient.updateMany({
          where: { id: { in: recipientIds }, status: 'PROCESSING' },
          data: {
            status: isRateLimited ? 'PENDING' : 'FAILED',
            errorMessage: message,
          },
        })
        await prisma.newsletterCampaign.update({
          where: { id: campaign.id },
          data: {
            ...(isRateLimited ? {} : { failedCount: { increment: failedRecipients.count } }),
            status: isRateLimited ? 'PAUSED' : isAuthFailure ? 'FAILED' : 'SENDING',
            errorMessage: message,
          },
        })
        await markAlert({
          campaignId: campaign.id,
          type: 'ERROR',
          title: isRateLimited ? '寄信服務配額或速率限制' : '電子報發送失敗',
          message,
        })
        if (isRateLimited || isAuthFailure) break
      } finally {
        await prisma.newsletterCampaign.update({
          where: { id: campaign.id },
          data: { lastHeartbeatAt: new Date() },
        })
      }
      await sleep(getDispatchDelayMs(rate, recipientIds.length))
    }
  }
}

async function claimNextRecipient(campaignId: string): Promise<string | null> {
  const staleRecipient = new Date(Date.now() - RECIPIENT_LEASE_MS)
  const candidate = await prisma.newsletterRecipient.findFirst({
    where: {
      campaignId,
      isTest: false,
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', updatedAt: { lt: staleRecipient } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!candidate) return null

  const claimed = await prisma.newsletterRecipient.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', updatedAt: { lt: staleRecipient } },
      ],
    },
    data: {
      status: 'PROCESSING',
      errorMessage: null,
      attemptCount: { increment: 1 },
    },
  })
  return claimed.count === 1 ? candidate.id : null
}

function getSenderSnapshot(
  value: unknown,
  fallback: Awaited<ReturnType<typeof getNewsletterSettings>>
): NewsletterSenderSnapshot {
  if (value && typeof value === 'object') {
    const snapshot = value as Partial<NewsletterSenderSnapshot>
    if (snapshot.fromEmail && snapshot.senderName && snapshot.appUrl && snapshot.emailProvider) {
      const snapshotAppUrl = getSafeSnapshotAppUrl(snapshot.appUrl, fallback.appUrl)
      return {
        ...fallback,
        ...snapshot,
        appUrl: snapshotAppUrl,
        siteLogo: rewriteSnapshotAssetUrl(snapshot.siteLogo || fallback.siteLogo, snapshot.appUrl, snapshotAppUrl),
        emailProvider: snapshot.emailProvider,
        transport: snapshot.transport,
        capturedAt: snapshot.capturedAt || new Date().toISOString(),
      } as NewsletterSenderSnapshot
    }
  }
  return { ...fallback, capturedAt: new Date().toISOString() }
}

function getSafeSnapshotAppUrl(snapshotAppUrl: string, fallbackAppUrl: string) {
  try {
    const url = new URL(snapshotAppUrl)
    return isInternalAppHost(url.hostname) ? fallbackAppUrl : snapshotAppUrl.replace(/\/$/, '')
  } catch {
    return fallbackAppUrl
  }
}

function rewriteSnapshotAssetUrl(value: string | undefined, oldAppUrl: string, newAppUrl: string) {
  if (!value || oldAppUrl === newAppUrl) return value || ''

  try {
    const assetUrl = new URL(value)
    const oldUrl = new URL(oldAppUrl)
    if (isInternalAppHost(assetUrl.hostname) || assetUrl.origin === oldUrl.origin) {
      return new URL(`${assetUrl.pathname}${assetUrl.search}${assetUrl.hash}`, newAppUrl).toString()
    }
  } catch {
    return value
  }

  return value
}
