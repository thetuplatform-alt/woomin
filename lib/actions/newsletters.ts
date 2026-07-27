'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, requireOnlyAdminAuth } from '@/lib/require-admin'
import { getNewsletterSettings, validateNewsletterSendPrerequisites } from '@/lib/newsletter/settings'
import { assertHtmlSize, normalizeNewsletterContent, renderCampaignHtml } from '@/lib/newsletter/render'
import { createUnsubscribeToken } from '@/lib/newsletter/consent'
import { estimateAudience, parseSegmentJson } from '@/lib/newsletter/audience'
import { dispatchNewsletters, sendNewsletterTestEmail, prepareNewsletterRecipients } from '@/lib/newsletter/send'
import { getEmailTransportSnapshot } from '@/lib/email-transport'
import { SETTING_KEYS } from '@/lib/validations/settings'
import type { AudienceEstimate, NewsletterContent, SegmentJson } from '@/lib/newsletter/types'
import type { NewsletterStatus, NewsletterType, Prisma } from '@prisma/client'

type Result<T = void> = { success: boolean; error?: string; data?: T }

function jsonInput<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function normalizeType(type: string): NewsletterType {
  return type === 'PROMO' ? 'PROMO' : 'GENERAL'
}

async function logNewsletterAction(
  adminId: string,
  action:
    | 'CREATE_NEWSLETTER'
    | 'UPDATE_NEWSLETTER'
    | 'SEND_NEWSLETTER'
    | 'SCHEDULE_NEWSLETTER'
    | 'PAUSE_NEWSLETTER'
    | 'CANCEL_NEWSLETTER'
    | 'DUPLICATE_NEWSLETTER',
  details: Prisma.InputJsonValue,
  targetId?: string
) {
  const ipAddress = await getRequestIp()
  await prisma.adminLog.create({
    data: {
      adminId,
      action,
      targetType: 'NewsletterCampaign',
      targetId,
      details,
      ipAddress,
    },
  })
}

async function getRequestIp(): Promise<string | null> {
  try {
    const headersList = await headers()
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      null
    )
  } catch {
    return null
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

async function upsertSiteSetting(key: string, value: string) {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

function parseScheduledAt(input?: string | null, timezone = 'Asia/Taipei'): Date | null | undefined {
  if (input === undefined) return undefined
  if (input === null || input.trim() === '') return null
  const value = input.trim()
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value)
  if (timezone === 'Asia/Taipei' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return new Date(`${value}${value.length === 16 ? ':00' : ''}+08:00`)
  }
  return new Date(value)
}

export async function listNewsletters() {
  const user = await requireAdminAuth()
  const where = user.role === 'ADMIN' ? {} : { createdById: user.id }
  const [campaigns, stats, alerts] = await Promise.all([
    prisma.newsletterCampaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { coupon: { select: { code: true } } },
    }),
    prisma.newsletterCampaign.aggregate({
      where,
      _sum: { sentCount: true, openCount: true, clickCount: true },
      _count: true,
    }),
    prisma.newsletterAlert.findMany({
      where: { readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { campaign: { select: { name: true } } },
    }),
  ])

  return { campaigns: campaigns.map((campaign) => ({ ...campaign, senderSnapshot: null })), stats, alerts }
}

export async function getNewsletter(id: string) {
  const user = await requireAdminAuth()
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, role: true } },
      recipients: { take: 10, orderBy: { createdAt: 'desc' } },
      coupon: true,
      orders: { where: { status: 'PAID' }, select: { id: true, amount: true, paidAt: true } },
    },
  })
  if (!campaign) throw new Error('找不到電子報')
  if (user.role !== 'ADMIN' && campaign.createdById !== user.id) {
    throw new Error('權限不足')
  }
  return { ...campaign, senderSnapshot: null }
}

export async function getNewsletterSenderSettings(): Promise<Result<{
  footerName: string
  footerEmail: string
}>> {
  try {
    await requireAdminAuth()
    const settings = await getNewsletterSettings()
    return {
      success: true,
      data: {
        footerName: settings.footerName,
        footerEmail: settings.footerEmail,
      },
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '讀取寄件人資訊失敗' }
  }
}

export async function updateNewsletterSenderSettings(data: {
  footerName: string
  footerEmail: string
}): Promise<Result<{
  footerName: string
  footerEmail: string
}>> {
  try {
    const user = await requireAdminAuth()
    const footerName = data.footerName.trim()
    const footerEmail = data.footerEmail.trim().toLowerCase()

    if (!footerName) return { success: false, error: '請填寫寄件人名稱。' }
    if (!isValidEmail(footerEmail)) return { success: false, error: '請填寫有效的聯絡信箱。' }

    await Promise.all([
      upsertSiteSetting(SETTING_KEYS.NEWSLETTER_FOOTER_NAME, footerName),
      upsertSiteSetting(SETTING_KEYS.NEWSLETTER_SENDER_NAME, footerName),
      upsertSiteSetting(SETTING_KEYS.NEWSLETTER_FOOTER_EMAIL, footerEmail),
      upsertSiteSetting(SETTING_KEYS.NEWSLETTER_REPLY_TO, footerEmail),
    ])
    await logNewsletterAction(user.id, 'UPDATE_NEWSLETTER', { senderSettings: true, footerName, footerEmail }, undefined)
    revalidatePath('/admin/newsletters')

    return { success: true, data: { footerName, footerEmail } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '儲存寄件人資訊失敗' }
  }
}

export async function getNewsletterReport(id: string) {
  const user = await requireAdminAuth()
  const [campaign, linkRows] = await Promise.all([
    prisma.newsletterCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, role: true } },
        coupon: true,
        orders: { where: { status: 'PAID' }, select: { id: true, amount: true, paidAt: true } },
      },
    }),
    prisma.newsletterLink.groupBy({
      by: ['targetUrl'],
      where: { campaignId: id },
      _sum: { clickCount: true, uniqueClickCount: true },
      _count: { _all: true },
    }),
  ])
  if (!campaign) throw new Error('找不到電子報')
  if (user.role !== 'ADMIN' && campaign.createdById !== user.id) {
    throw new Error('權限不足')
  }

  const links = linkRows
    .map((row) => ({
      id: row.targetUrl,
      targetUrl: row.targetUrl,
      clickCount: row._sum.clickCount || 0,
      uniqueClickCount: row._sum.uniqueClickCount || 0,
      recipientLinkCount: row._count._all,
    }))
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, 100)

  return { ...campaign, links, senderSnapshot: null }
}

export async function createNewsletter(data: {
  type?: NewsletterType
  name?: string
  templateId?: string
}): Promise<Result<{ id: string }>> {
  try {
    const user = await requireAdminAuth()
    const type = normalizeType(data.type || 'GENERAL')
    const content: NewsletterContent = {
      meta: { tags: ['一般'] },
      blocks: [
        { id: randomUUID(), type: 'heading', text: '給學員的一封信' },
        { id: randomUUID(), type: 'paragraph', text: '嗨 {{學員姓名}}，\n\n在這裡寫下你想分享的內容。' },
        { id: randomUUID(), type: 'button', text: '繼續閱讀', url: '/' },
      ],
    }
    const campaign = await prisma.newsletterCampaign.create({
      data: {
        type,
        name: data.name || '新的電子報',
        subject: '未命名主旨',
        preheader: '',
        contentJson: jsonInput(content),
        templateId: data.templateId,
        createdById: user.id,
      },
    })
    await logNewsletterAction(user.id, 'CREATE_NEWSLETTER', { type }, campaign.id)
    revalidatePath('/admin/newsletters')
    return { success: true, data: { id: campaign.id } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '建立失敗' }
  }
}

export async function updateNewsletter(data: {
  id: string
  expectedUpdatedAt?: string
  type?: NewsletterType
  name?: string
  subject?: string
  preheader?: string
  contentJson?: NewsletterContent
  segmentJson?: SegmentJson
  couponId?: string | null
  scheduledAt?: string | null
  timezone?: string
}): Promise<Result<{ updatedAt: string }>> {
  try {
    const user = await requireAdminAuth()
    const existing = await getNewsletter(data.id)
    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(existing.status)) {
      return { success: false, error: '此狀態不可編輯內容' }
    }
    if (data.expectedUpdatedAt && new Date(data.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
      return { success: false, error: '內容已被其他人變更，請重新整理後再儲存。' }
    }

    const nextContent = normalizeNewsletterContent(data.contentJson || existing.contentJson)
    await prisma.newsletterCampaign.update({
      where: { id: data.id },
      data: {
        type: data.type ? normalizeType(data.type) : undefined,
        name: data.name,
        subject: data.subject,
        preheader: data.preheader,
        contentJson: jsonInput(nextContent),
        segmentJson: data.segmentJson ? jsonInput(data.segmentJson) : undefined,
        couponId: data.couponId === undefined ? undefined : data.couponId,
        scheduledAt: parseScheduledAt(data.scheduledAt, data.timezone || existing.timezone),
        timezone: data.timezone,
      },
    })
    const updated = await prisma.newsletterCampaign.findUniqueOrThrow({
      where: { id: data.id },
      select: { updatedAt: true },
    })
    await logNewsletterAction(user.id, 'UPDATE_NEWSLETTER', { status: existing.status }, data.id)
    revalidatePath('/admin/newsletters')
    revalidatePath(`/admin/newsletters/${data.id}/edit`)
    return { success: true, data: { updatedAt: updated.updatedAt.toISOString() } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '儲存失敗' }
  }
}

export async function duplicateNewsletter(id: string): Promise<Result<{ id: string }>> {
  try {
    const user = await requireAdminAuth()
    const campaign = await getNewsletter(id)
    const copy = await prisma.newsletterCampaign.create({
      data: {
        type: campaign.type,
        name: `${campaign.name} 副本`,
        subject: `${campaign.subject} 副本`,
        preheader: campaign.preheader,
        contentJson: jsonInput(campaign.contentJson),
        templateId: campaign.templateId,
        status: 'DRAFT',
        timezone: campaign.timezone,
        senderName: campaign.senderName,
        replyTo: campaign.replyTo,
        segmentJson: campaign.segmentJson === null ? undefined : jsonInput(campaign.segmentJson),
        couponId: campaign.couponId,
        attributionWindowDays: campaign.attributionWindowDays,
        ratePerMinute: campaign.ratePerMinute,
        createdById: user.id,
      },
    })
    await logNewsletterAction(user.id, 'DUPLICATE_NEWSLETTER', { sourceId: id }, copy.id)
    revalidatePath('/admin/newsletters')
    return { success: true, data: { id: copy.id } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '複製失敗' }
  }
}

async function validateCampaignForSend(id: string) {
  const campaign = await getNewsletter(id)
  const settings = await getNewsletterSettings()
  const errors = validateNewsletterSendPrerequisites(settings)
  const segment = parseSegmentJson(campaign.segmentJson)
  const audience = await estimateAudience({
    type: campaign.type,
    segment,
    createdById: campaign.createdById,
    createdByRole: campaign.createdBy.role,
  })

  if (audience.sendable === 0) errors.push('符合條件且可寄送的收件人為 0。')

  if (campaign.type === 'PROMO' && campaign.couponId) {
    const coupon = await prisma.coupon.findUnique({ where: { id: campaign.couponId } })
    const now = new Date()
    if (!coupon?.active) errors.push('優惠券未啟用。')
    if (coupon?.expiresAt && coupon.expiresAt < now) errors.push('優惠券已過期。')
    if (coupon?.maxRedemptions && coupon.maxRedemptions > 0 && coupon.timesRedeemed >= coupon.maxRedemptions) {
      errors.push('優惠券兌換次數已滿。')
    }
  }

  const previewToken = settings.dedicatedUnsubscribeSecret
    ? createUnsubscribeToken({
        userId: campaign.createdById,
        email: 'preview@example.com',
        scope: campaign.type === 'PROMO' ? 'marketing' : 'general',
      })
    : 'missing-newsletter-secret'
  const unsubscribeUrl = `${settings.appUrl}/unsubscribe?email=preview@example.com&token=${previewToken}`
  const html = renderCampaignHtml(normalizeNewsletterContent(campaign.contentJson), {
    type: campaign.type,
    subject: campaign.subject,
    preheader: campaign.preheader,
    siteName: settings.siteName,
    siteLogo: settings.siteLogo,
    appUrl: settings.appUrl,
    footerName: settings.footerName,
    footerAddress: settings.footerAddress,
    footerEmail: settings.footerEmail,
    unsubscribeUrl,
    mode: 'preview',
  })
  const size = assertHtmlSize(html)
  if (!size.ok) errors.push(`信件 HTML 已達 ${Math.round(size.bytes / 1024)}KB，超過 Gmail 102KB 裁切門檻。`)

  return { campaign, settings, audience, errors, html }
}

export async function getNewsletterSendChecklist(id: string): Promise<Result<AudienceEstimate>> {
  try {
    const { audience, errors } = await validateCampaignForSend(id)
    return { success: errors.length === 0, error: errors.join('\n'), data: audience }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '檢查失敗' }
  }
}

export async function sendTestNewsletter(id: string, to: string): Promise<Result<{ messageId?: string }>> {
  try {
    const user = await requireAdminAuth()
    const recipient = await prisma.user.findUnique({
      where: { email: to.toLowerCase() },
      select: { id: true, role: true },
    })
    if (!recipient || !['ADMIN', 'EDITOR', 'INSTRUCTOR'].includes(recipient.role)) {
      return { success: false, error: '測試信僅能寄給 ADMIN / EDITOR / INSTRUCTOR 內部帳號。' }
    }

    const campaign = await getNewsletter(id)
    const result = await sendNewsletterTestEmail(campaign.id, to)
    await logNewsletterAction(user.id, 'SEND_NEWSLETTER', { test: true, to }, id)
    return result
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '測試信寄送失敗' }
  }
}

export async function startNewsletter(id: string, scheduledAt?: string | null): Promise<Result> {
  try {
    const user = await requireAdminAuth()
    const { campaign, settings, audience, errors } = await validateCampaignForSend(id)
    if (errors.length) return { success: false, error: errors.join('\n') }
    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return { success: false, error: '此電子報狀態不可啟動。' }
    }

    if (campaign.status !== 'PAUSED') {
      await prepareNewsletterRecipients(campaign.id)
    }
    const nextStatus: NewsletterStatus = scheduledAt ? 'SCHEDULED' : 'QUEUED'
    const transportSnapshot = await getEmailTransportSnapshot(settings.emailProvider)
    if (!transportSnapshot) return { success: false, error: '寄信服務未設定或無法建立 provider snapshot。' }

    const updated = await prisma.newsletterCampaign.updateMany({
      where: { id, status: { in: ['DRAFT', 'PAUSED', 'SCHEDULED'] } },
      data: {
        status: nextStatus,
        scheduledAt: parseScheduledAt(scheduledAt, campaign.timezone) ?? null,
        ...(campaign.status === 'PAUSED'
          ? {}
          : {
              totalRecipients: audience.sendable,
              ratePerMinute: settings.ratePerMinute,
              snapshotAt: new Date(),
              senderSnapshot: jsonInput({
                siteName: settings.siteName,
                siteLogo: settings.siteLogo,
                appUrl: settings.appUrl,
                senderName: settings.senderName,
                fromEmail: settings.fromEmail,
                replyTo: settings.replyTo,
                footerName: settings.footerName,
                footerAddress: settings.footerAddress,
                footerEmail: settings.footerEmail,
                ratePerMinute: settings.ratePerMinute,
                emailProvider: settings.emailProvider,
                transport: transportSnapshot,
                capturedAt: new Date().toISOString(),
              }),
            }),
      },
    })
    if (updated.count !== 1) {
      return { success: false, error: '狀態已變更，請重新整理後再試。' }
    }
    await logNewsletterAction(user.id, scheduledAt ? 'SCHEDULE_NEWSLETTER' : 'SEND_NEWSLETTER', { recipients: audience.sendable }, id)
    console.info(`[newsletter] ${scheduledAt ? 'scheduled' : 'queued'} campaign=${id} recipients=${audience.sendable}`)
    if (!scheduledAt) {
      await dispatchNewsletters({ windowMs: 8_000 })
    }
    revalidatePath('/admin/newsletters')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '啟動失敗' }
  }
}

export async function pauseNewsletter(id: string): Promise<Result> {
  try {
    const user = await requireAdminAuth()
    const updated = await prisma.newsletterCampaign.updateMany({
      where: { id, status: { in: ['QUEUED', 'SENDING'] } },
      data: { status: 'PAUSED' },
    })
    if (updated.count !== 1) return { success: false, error: '此狀態不可暫停。' }
    await logNewsletterAction(user.id, 'PAUSE_NEWSLETTER', {}, id)
    revalidatePath('/admin/newsletters')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '暫停失敗' }
  }
}

export async function cancelNewsletter(id: string): Promise<Result> {
  try {
    const user = await requireAdminAuth()
    const updated = await prisma.newsletterCampaign.updateMany({
      where: { id, status: { notIn: ['SENT', 'FAILED', 'CANCELLED'] } },
      data: { status: 'CANCELLED' },
    })
    if (updated.count !== 1) return { success: false, error: '此狀態不可取消。' }
    await logNewsletterAction(user.id, 'CANCEL_NEWSLETTER', {}, id)
    revalidatePath('/admin/newsletters')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '取消失敗' }
  }
}

export async function estimateNewsletterAudience(id: string): Promise<Result<AudienceEstimate>> {
  try {
    const campaign = await getNewsletter(id)
    const audience = await estimateAudience({
      type: campaign.type,
      segment: parseSegmentJson(campaign.segmentJson),
      createdById: campaign.createdById,
      createdByRole: campaign.createdBy.role,
    })
    return { success: true, data: audience }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '預估失敗' }
  }
}

export async function getNewsletterEditorOptions() {
  await requireAdminAuth()
  const [courses, coupons, templates] = await Promise.all([
    prisma.course.findMany({
      where: { status: { in: ['PUBLISHED', 'UNLISTED'] } },
      select: { id: true, title: true, slug: true, coverImage: true, price: true, salePrice: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
    prisma.coupon.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, description: true, expiresAt: true, maxRedemptions: true, timesRedeemed: true, discountType: true, amountOff: true, percentOff: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
	    prisma.newsletterTemplate.findMany({ orderBy: [{ isBuiltIn: 'desc' }, { updatedAt: 'desc' }] }),
	  ])
  const [totalEmailCount, noCourseCount, courseCounts] = await Promise.all([
    prisma.user.count({ where: { email: { not: '' } } }),
    prisma.user.count({
      where: {
        email: { not: '' },
        purchases: { none: { revokedAt: null } },
      },
    }),
    prisma.purchase.groupBy({
      by: ['courseId'],
      where: {
        revokedAt: null,
        courseId: { in: courses.map((course) => course.id) },
      },
      _count: { userId: true },
    }),
  ])
  const courseCountMap = new Map(courseCounts.map((item) => [item.courseId, item._count.userId]))
	  return {
    courses: courses.map((course) => ({
      ...course,
      audienceCount: courseCountMap.get(course.id) || 0,
    })),
    coupons,
    templates,
    audienceGroups: {
      totalEmailCount,
      noCourseCount,
    },
  }
}

export async function searchNewsletterUsers(query: string): Promise<Result<Array<{ id: string; name: string | null; email: string }>>> {
  try {
    await requireAdminAuth()
    const keyword = query.trim()
    if (keyword.length < 1) return { success: true, data: [] }
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { startsWith: keyword, mode: 'insensitive' } },
          { name: { startsWith: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } },
          { name: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })
    return { success: true, data: users }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '搜尋失敗' }
  }
}

export async function overrideUserNewsletterConsent(data: {
  userId: string
  generalEmailConsent?: boolean
  marketingConsent?: boolean | null
}): Promise<Result> {
  try {
    const admin = await requireOnlyAdminAuth()
    if (data.marketingConsent === true) {
      return { success: false, error: '行銷同意只能由用戶本人勾選或 double opt-in 產生，ADMIN 不可代為重新訂閱。' }
    }
    await prisma.user.update({
      where: { id: data.userId },
      data: {
        generalEmailConsent: data.generalEmailConsent,
            marketingConsent: data.marketingConsent,
          },
    })
    await prisma.adminLog.create({
      data: {
        adminId: admin.id,
        action: 'ADMIN_OVERRIDE_CONSENT',
        targetType: 'User',
        targetId: data.userId,
        details: { generalEmailConsent: data.generalEmailConsent, marketingConsent: data.marketingConsent },
        ipAddress: await getRequestIp(),
      },
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '更新失敗' }
  }
}
