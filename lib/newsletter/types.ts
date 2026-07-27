import type { NewsletterType } from '@prisma/client'

export type NewsletterBlock =
  | {
      id: string
      type: 'heading'
      text: string
    }
  | {
      id: string
      type: 'paragraph'
      text: string
    }
  | {
      id: string
      type: 'quote'
      text: string
      cite?: string
    }
  | {
      id: string
      type: 'button'
      text: string
      url: string
      align?: 'left' | 'center' | 'right'
    }
  | {
      id: string
      type: 'cta'
      title: string
      text?: string
      buttonText: string
      url: string
    }
  | {
      id: string
      type: 'divider'
    }
  | {
      id: string
      type: 'image'
      url: string
      alt?: string
    }
  | {
      id: string
      type: 'video'
      title: string
      url: string
      thumbnailUrl?: string
    }
  | {
      id: string
      type: 'course'
      courseId: string
      title: string
      imageUrl?: string
      priceLabel?: string
      url: string
    }
  | {
      id: string
      type: 'coupon'
      couponId: string
      code: string
      description?: string
      expiresAt?: string
    }
  | {
      id: string
      type: 'countdown'
      text: string
      expiresAt?: string
    }

export interface NewsletterContent {
  blocks: NewsletterBlock[]
  meta?: {
    tags?: string[]
    blocknoteDocument?: unknown
    blocknoteHtml?: string
  }
}

export interface NewsletterRenderContext {
  type: NewsletterType
  subject?: string
  preheader?: string | null
  siteName: string
  siteLogo: string
  appUrl: string
  unsubscribeUrl: string
  preferenceUrl?: string
  footerName: string
  footerAddress: string
  footerEmail: string
  recipientName?: string | null
  courseName?: string | null
  couponCode?: string | null
  couponExpiresAt?: Date | string | null
  mode?: 'preview' | 'test' | 'send'
}

export interface AudienceEstimate {
  matched: number
  excluded: {
    unsubscribed: number
    marketingMissing: number
    hardBounced: number
  }
  sendable: number
  samples: Array<{
    id: string
    name: string | null
    emailMasked: string
  }>
  recipients?: Array<{
    id: string
    name: string | null
    email: string
    source: 'user' | 'external'
  }>
}

export interface SegmentRule {
  field: 'all' | 'coursePurchased' | 'courseNotPurchased' | 'role' | 'lastLoginWithinDays' | 'lastLoginBeforeDays' | 'createdAfter' | 'createdBefore' | 'marketingConsent'
  value?: string | number | boolean
}

export interface SegmentJson {
  mode?: 'AND' | 'OR'
  preset?: 'all' | 'paidStudents' | 'freeStudents' | 'courseStudents' | 'manual'
  rules?: SegmentRule[]
  manualUserIds?: string[]
  manualEmails?: string[]
  courseIds?: string[]
  include?: SegmentAudienceItem[]
  exclude?: SegmentAudienceItem[]
}

export type SegmentAudienceItem =
  | { type: 'all'; id: 'all'; label?: string }
  | { type: 'course'; id: string; label?: string }
  | { type: 'noCourse'; id: 'noCourse'; label?: string }
  | { type: 'user'; id: string; email?: string; label?: string }
  | { type: 'email'; id: string; email: string; label?: string }
