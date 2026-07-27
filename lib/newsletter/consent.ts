import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export type ConsentEmailType = 'transactional' | 'general' | 'marketing'
export type UnsubscribeScope = 'all' | 'marketing' | 'general'

export interface ConsentResult {
  allowed: boolean
  reason?: string
}

function secret(): string {
  return process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || ''
}

export function hasDedicatedNewsletterSecret(): boolean {
  return !!process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
}

function payload(userId: string, email: string, scope: UnsubscribeScope): string {
  return `${userId}:${email.toLowerCase()}:${scope}`
}

export function createUnsubscribeToken(params: {
  userId: string
  email: string
  scope: UnsubscribeScope
}): string {
  const signingSecret = secret()
  if (!signingSecret) {
    throw new Error('NEWSLETTER_UNSUBSCRIBE_SECRET is required for unsubscribe token signing')
  }
  const sig = crypto
    .createHmac('sha256', signingSecret)
    .update(payload(params.userId, params.email, params.scope))
    .digest('base64url')
  return `${params.userId}.${params.scope}.${sig}`
}

export function verifyUnsubscribeToken(params: {
  token: string
  email: string
}): { ok: boolean; userId?: string; scope?: UnsubscribeScope } {
  if (!secret()) return { ok: false }
  const [userId, scope, sig] = params.token.split('.')
  if (!userId || !scope || !sig || !['all', 'marketing', 'general'].includes(scope)) {
    return { ok: false }
  }

  const expected = createUnsubscribeToken({
    userId,
    email: params.email,
    scope: scope as UnsubscribeScope,
  }).split('.')[2]

  const left = Buffer.from(sig)
  const right = Buffer.from(expected || '')
  if (left.length !== right.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return { ok: false }
  }

  return {
    ok: crypto.timingSafeEqual(left, right),
    userId,
    scope: scope as UnsubscribeScope,
  }
}

export async function assertEmailConsent(
  userId: string | null | undefined,
  type: ConsentEmailType,
  fallbackEmail?: string
): Promise<ConsentResult> {
  if (!userId) {
    if (type === 'transactional') return { allowed: true }
    if (!fallbackEmail) {
      return { allowed: false, reason: 'external_contact_requires_explicit_consent' }
    }

    const latestConsent = await prisma.emailConsentLog.findFirst({
      where: {
        email: fallbackEmail.toLowerCase(),
        consentType: type === 'marketing' ? 'MARKETING' : 'GENERAL',
      },
      orderBy: { createdAt: 'desc' },
      select: { action: true },
    })

    return latestConsent?.action === 'GRANTED'
      ? { allowed: true }
      : { allowed: false, reason: 'external_contact_requires_explicit_consent' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      marketingConsent: true,
      generalEmailConsent: true,
      unsubscribedAt: true,
      emailInvalidAt: true,
      emailBounceState: true,
      country: true,
    },
  })

  if (!user) return { allowed: false, reason: 'user_not_found' }
  if (user.emailBounceState === 'HARD_BOUNCED' || user.emailBounceState === 'COMPLAINED') {
    return { allowed: false, reason: 'email_invalid_or_complained' }
  }
  if (
    user.emailBounceState === 'SOFT_SUSPENDED' &&
    user.emailInvalidAt &&
    user.emailInvalidAt.getTime() > Date.now()
  ) {
    return { allowed: false, reason: 'soft_bounce_suspended' }
  }
  if (user.emailInvalidAt && user.emailBounceState !== 'SOFT_SUSPENDED') {
    return { allowed: false, reason: 'email_invalid_or_complained' }
  }
  if (type === 'transactional') return { allowed: true }
  if (user.unsubscribedAt) return { allowed: false, reason: 'unsubscribed_all' }

  if (type === 'general') {
    if (user.country === 'HK' && user.generalEmailConsent !== true) {
      return { allowed: false, reason: 'hk_general_requires_opt_in' }
    }
    return user.generalEmailConsent === true
      ? { allowed: true }
      : { allowed: false, reason: 'general_unsubscribed' }
  }

  if (type === 'marketing') {
    return user.marketingConsent === true
      ? { allowed: true }
      : { allowed: false, reason: 'marketing_consent_missing' }
  }

  return { allowed: false, reason: fallbackEmail ? 'unknown_type' : 'unknown_type' }
}

export async function applyUnsubscribe(params: {
  userId: string
  email: string
  scope: UnsubscribeScope
  source?: string
  ip?: string | null
  campaignId?: string | null
}) {
  const now = new Date()
  if (params.userId.startsWith('external:')) {
    const recipientId = params.userId.slice('external:'.length)
    await prisma.$transaction([
      prisma.newsletterRecipient.updateMany({
        where: {
          id: recipientId,
          toEmail: params.email.toLowerCase(),
        },
        data: {
          unsubscribedAt: now,
          status: 'SKIPPED',
          skipReason: 'external_unsubscribed',
        },
      }),
      prisma.emailConsentLog.create({
        data: {
          userId: null,
          email: params.email.toLowerCase(),
          consentType: params.scope === 'general' ? 'GENERAL' : 'MARKETING',
          action: 'REVOKED',
          source: params.source || 'unsubscribe_page',
          ip: params.ip || null,
          campaignId: params.campaignId || null,
        },
      }),
      ...(params.campaignId
        ? [
            prisma.newsletterCampaign.update({
              where: { id: params.campaignId },
              data: { unsubCount: { increment: 1 } },
            }),
          ]
        : []),
    ])
    return
  }

  const data =
    params.scope === 'all'
      ? {
          unsubscribedAt: now,
          generalEmailConsent: false,
          marketingConsent: false,
        }
      : params.scope === 'marketing'
      ? {
          marketingConsent: false,
        }
      : {
          generalEmailConsent: false,
        }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: params.userId },
      data,
    }),
    prisma.emailConsentLog.create({
      data: {
        userId: params.userId,
        email: params.email.toLowerCase(),
        consentType: params.scope === 'general' ? 'GENERAL' : 'MARKETING',
        action: 'REVOKED',
        source: params.source || 'unsubscribe_page',
        ip: params.ip || null,
        campaignId: params.campaignId || null,
      },
    }),
    ...(params.campaignId
      ? [
          prisma.newsletterCampaign.update({
            where: { id: params.campaignId },
            data: { unsubCount: { increment: 1 } },
          }),
        ]
      : []),
  ])
}

export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@')
  const maskedName = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`
  return `${maskedName}@${domain}`
}
