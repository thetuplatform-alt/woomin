import type { Prisma, NewsletterType, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertEmailConsent, maskEmail } from '@/lib/newsletter/consent'
import type { AudienceEstimate, SegmentAudienceItem, SegmentJson } from '@/lib/newsletter/types'

type AudienceUser = {
  id: string | null
  name: string | null
  email: string
  marketingConsent: boolean | null
  generalEmailConsent: boolean
  unsubscribedAt: Date | null
  emailInvalidAt: Date | null
  emailBounceState: string
  country: string | null
  isExternal?: boolean
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function manualEmails(segment: SegmentJson | null | undefined) {
  const legacyEmails = segment?.manualEmails || []
  const includeEmails = (segment?.include || [])
    .filter((item): item is Extract<SegmentAudienceItem, { type: 'email' }> => item.type === 'email')
    .map((item) => item.email)
  return [...new Set([...legacyEmails, ...includeEmails].map(normalizeEmail).filter((email) => email.includes('@')))]
}

function itemWhere(item: SegmentAudienceItem): Prisma.UserWhereInput | null {
  if (item.type === 'all') return {}
  if (item.type === 'course') {
    return { purchases: { some: { courseId: item.id, revokedAt: null } } }
  }
  if (item.type === 'noCourse') {
    return { purchases: { none: { revokedAt: null } } }
  }
  if (item.type === 'user') return { id: item.id }
  if (item.type === 'email') return { email: { equals: normalizeEmail(item.email), mode: 'insensitive' } }
  return null
}

function modernIncludeItems(segment: SegmentJson | null | undefined): SegmentAudienceItem[] {
  if (segment?.include?.length) return segment.include
  if (!segment || segment.preset === 'all') return [{ type: 'all', id: 'all' }]
  if (segment.preset === 'courseStudents' && segment.courseIds?.length) {
    return segment.courseIds.map((id) => ({ type: 'course', id }))
  }
  if (segment.preset === 'manual') {
    return [
      ...(segment.manualUserIds || []).map((id) => ({ type: 'user' as const, id })),
      ...manualEmails(segment).map((email) => ({ type: 'email' as const, id: email, email })),
    ]
  }
  return []
}

function modernWhere(items: SegmentAudienceItem[], fallback: Prisma.UserWhereInput = {}): Prisma.UserWhereInput {
  if (!items.length) return fallback
  if (items.some((item) => item.type === 'all')) return {}
  const clauses = items.map(itemWhere).filter((where): where is Prisma.UserWhereInput => !!where)
  if (!clauses.length) return { id: { in: [] } }
  return clauses.length === 1 ? clauses[0] : { OR: clauses }
}

function segmentWhere(segment: SegmentJson | null | undefined): Prisma.UserWhereInput {
  if (segment?.include?.length) return modernWhere(segment.include)
  if (!segment || segment.preset === 'all') return {}
  if (segment.preset === 'paidStudents') {
    return { purchases: { some: { source: { in: ['PAID', 'BUNDLE'] }, revokedAt: null } } }
  }
  if (segment.preset === 'freeStudents') {
    return { purchases: { some: { source: 'FREE_ENROLL', revokedAt: null } } }
  }
  if (segment.preset === 'manual' && ((segment.manualUserIds?.length || 0) > 0 || manualEmails(segment).length > 0)) {
    const emails = manualEmails(segment)
    return {
      OR: [
        ...(segment.manualUserIds?.length ? [{ id: { in: segment.manualUserIds } }] : []),
        ...(emails.length ? [{ email: { in: emails, mode: 'insensitive' as const } }] : []),
      ],
    }
  }
  if (segment.preset === 'courseStudents' && segment.courseIds?.length) {
    return {
      purchases: {
        some: {
          courseId: { in: segment.courseIds },
          revokedAt: null,
        },
      },
    }
  }

  const rules = segment.rules || []
  const clauses: Prisma.UserWhereInput[] = rules.map((rule) => {
    switch (rule.field) {
      case 'coursePurchased':
        return { purchases: { some: { courseId: String(rule.value), revokedAt: null } } }
      case 'courseNotPurchased':
        return { purchases: { none: { courseId: String(rule.value), revokedAt: null } } }
      case 'role':
        return { role: String(rule.value) as UserRole }
      case 'lastLoginWithinDays': {
        const date = new Date(Date.now() - Number(rule.value || 0) * 24 * 60 * 60 * 1000)
        return { lastLoginAt: { gte: date } }
      }
      case 'lastLoginBeforeDays': {
        const date = new Date(Date.now() - Number(rule.value || 0) * 24 * 60 * 60 * 1000)
        return { OR: [{ lastLoginAt: { lt: date } }, { lastLoginAt: null }] }
      }
      case 'createdAfter':
        return { createdAt: { gte: new Date(String(rule.value)) } }
      case 'createdBefore':
        return { createdAt: { lte: new Date(String(rule.value)) } }
      case 'marketingConsent':
        return { marketingConsent: rule.value === true }
      default:
        return {}
    }
  })

  if (clauses.length === 0) return {}
  return segment.mode === 'OR' ? { OR: clauses } : { AND: clauses }
}

export function parseSegmentJson(value: unknown): SegmentJson {
  if (!value || typeof value !== 'object') return { preset: 'all', mode: 'AND', rules: [] }
  return value as SegmentJson
}

function mergeWhere(...clauses: Prisma.UserWhereInput[]): Prisma.UserWhereInput {
  const active = clauses.filter((clause) => Object.keys(clause).length > 0)
  if (active.length === 0) return {}
  if (active.length === 1) return active[0]
  return { AND: active }
}

function scopeWhere(params: { createdById?: string; createdByRole?: string }): Prisma.UserWhereInput {
  if (params.createdByRole !== 'INSTRUCTOR' && params.createdByRole !== 'EDITOR') return {}
  return {
    purchases: {
      some: {
        revokedAt: null,
        course: {
          instructors: { some: { userId: params.createdById } },
        },
      },
    },
  }
}

export async function getAudienceUsers(params: {
  type: NewsletterType
  segment: SegmentJson
  limit?: number
  createdById?: string
  createdByRole?: string
}) {
  const baseWhere = segmentWhere(params.segment)
  const accessWhere = scopeWhere(params)
  const where: Prisma.UserWhereInput = mergeWhere(
    baseWhere,
    accessWhere,
    {
      email: { not: '' },
      role: { in: ['USER', 'INSTRUCTOR', 'EDITOR', 'ADMIN'] },
    }
  )

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      marketingConsent: true,
      generalEmailConsent: true,
      unsubscribedAt: true,
      emailInvalidAt: true,
      emailBounceState: true,
      country: true,
    },
    orderBy: { createdAt: 'desc' },
    take: params.limit,
  })

  const excludeItems = params.segment.exclude || []
  const excludedEmails = new Set<string>()
  if (excludeItems.length) {
    const excludeWhere = mergeWhere(modernWhere(excludeItems, { id: { in: [] } }), accessWhere)
    const excludedUsers = await prisma.user.findMany({
      where: mergeWhere(excludeWhere, { email: { not: '' } }),
      select: { email: true },
      take: 50000,
    })
    for (const user of excludedUsers) excludedEmails.add(normalizeEmail(user.email))
    for (const item of excludeItems) {
      if (item.type === 'email') excludedEmails.add(normalizeEmail(item.email))
    }
  }

  const deduped = new Map<string, AudienceUser>()
  for (const user of users) {
    const email = normalizeEmail(user.email)
    if (!excludedEmails.has(email)) deduped.set(email, user)
  }

  const includeItems = modernIncludeItems(params.segment)
  const includesAll = includeItems.some((item) => item.type === 'all')
  const externalEmails = includesAll ? [] : manualEmails(params.segment)
  for (const email of externalEmails) {
    if (!excludedEmails.has(email) && !deduped.has(email)) {
      deduped.set(email, {
        id: null,
        name: email.split('@')[0] || null,
        email,
        marketingConsent: true,
        generalEmailConsent: true,
        unsubscribedAt: null,
        emailInvalidAt: null,
        emailBounceState: 'NONE',
        country: null,
        isExternal: true,
      })
    }
  }

  return [...deduped.values()]
}

async function resolveAudienceConsent(user: AudienceUser, consentType: 'general' | 'marketing') {
  if (!user.id || user.isExternal) {
    return assertEmailConsent(null, consentType, user.email)
  }

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
  if (user.unsubscribedAt) return { allowed: false, reason: 'unsubscribed_all' }

  if (consentType === 'general') {
    if (user.country === 'HK' && user.generalEmailConsent !== true) {
      return { allowed: false, reason: 'hk_general_requires_opt_in' }
    }
    return user.generalEmailConsent === true
      ? { allowed: true }
      : { allowed: false, reason: 'general_unsubscribed' }
  }

  return user.marketingConsent === true
    ? { allowed: true }
    : { allowed: false, reason: 'marketing_consent_missing' }
}

export async function estimateAudience(params: {
  type: NewsletterType
  segment: SegmentJson
  createdById?: string
  createdByRole?: string
}): Promise<AudienceEstimate> {
  const users = await getAudienceUsers({ ...params, limit: 50000 })
  let unsubscribed = 0
  let marketingMissing = 0
  let hardBounced = 0
  const sendable: AudienceUser[] = []
  const consentType = params.type === 'PROMO' ? 'marketing' : 'general'

  for (const user of users) {
    const consent = await resolveAudienceConsent(user, consentType)
    if (consent.allowed) {
      sendable.push(user)
      continue
    }

    if (['email_invalid_or_complained', 'soft_bounce_suspended'].includes(consent.reason || '')) {
      hardBounced++
      continue
    }

    if (params.type === 'PROMO') {
      marketingMissing++
      continue
    }

    unsubscribed++
  }

  return {
    matched: users.length,
    excluded: {
      unsubscribed,
      marketingMissing,
      hardBounced,
    },
    sendable: sendable.length,
    samples: sendable.slice(0, 5).map((user) => ({
      id: user.id || user.email,
      name: user.name,
      emailMasked: maskEmail(user.email),
    })),
    recipients: sendable.map((user) => ({
      id: user.id || user.email,
      name: user.name,
      email: user.email,
      source: user.isExternal ? 'external' : 'user',
    })),
  }
}
