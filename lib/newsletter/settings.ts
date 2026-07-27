import { prisma } from '@/lib/prisma'
import { isInternalAppHost, resolveAppUrl } from '@/lib/app-url'
import { resolveAssetUrl } from '@/lib/asset-url'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { getDisplaySiteName } from '@/lib/site-brand'
import { isEmailServiceConfigured, type EmailProvider } from '@/lib/email-transport'
import { hasDedicatedNewsletterSecret } from '@/lib/newsletter/consent'

export interface NewsletterSettings {
  siteName: string
  siteLogo: string
  appUrl: string
  senderName: string
  fromEmail: string
  replyTo: string
  footerName: string
  footerAddress: string
  footerEmail: string
  ratePerMinute: number
  emailProvider: EmailProvider
  emailConfigured: boolean
  dedicatedUnsubscribeSecret: boolean
  lastCronHeartbeatAt: string
  domainStatus: string
}

export async function getNewsletterSettings(): Promise<NewsletterSettings> {
  const appUrl = await resolveAppUrl()
  const keys = [
    SETTING_KEYS.SITE_NAME,
    SETTING_KEYS.SITE_LOGO,
    SETTING_KEYS.EMAIL_SENDER_NAME,
    SETTING_KEYS.EMAIL_FROM,
    SETTING_KEYS.NEWSLETTER_SENDER_NAME,
    SETTING_KEYS.NEWSLETTER_REPLY_TO,
    SETTING_KEYS.NEWSLETTER_FOOTER_NAME,
    SETTING_KEYS.NEWSLETTER_FOOTER_ADDRESS,
    SETTING_KEYS.NEWSLETTER_FOOTER_EMAIL,
    SETTING_KEYS.NEWSLETTER_RATE_PER_MINUTE,
    SETTING_KEYS.NEWSLETTER_LAST_CRON_HEARTBEAT_AT,
    SETTING_KEYS.NEWSLETTER_DOMAIN_STATUS,
    SETTING_KEYS.EMAIL_PROVIDER,
  ]

  const settings = await prisma.siteSetting.findMany({ where: { key: { in: keys } } })
  const map = new Map(settings.map((item) => [item.key, item.value]))
  const siteName = getDisplaySiteName(map.get(SETTING_KEYS.SITE_NAME))
  const fromEmail = map.get(SETTING_KEYS.EMAIL_FROM) || process.env.EMAIL_FROM || 'noreply@example.com'

  return {
    siteName,
    siteLogo: resolveAssetUrl(map.get(SETTING_KEYS.SITE_LOGO), appUrl) || `${appUrl}/icon.png`,
    appUrl,
    senderName: map.get(SETTING_KEYS.NEWSLETTER_SENDER_NAME) || map.get(SETTING_KEYS.EMAIL_SENDER_NAME) || siteName,
    fromEmail,
    replyTo: map.get(SETTING_KEYS.NEWSLETTER_REPLY_TO) || fromEmail,
    footerName: map.get(SETTING_KEYS.NEWSLETTER_FOOTER_NAME) || map.get(SETTING_KEYS.EMAIL_SENDER_NAME) || siteName,
    footerAddress: map.get(SETTING_KEYS.NEWSLETTER_FOOTER_ADDRESS) || '',
    footerEmail: map.get(SETTING_KEYS.NEWSLETTER_FOOTER_EMAIL) || fromEmail,
    ratePerMinute: parseRatePerMinute(map.get(SETTING_KEYS.NEWSLETTER_RATE_PER_MINUTE)),
    emailProvider: parseEmailProvider(map.get(SETTING_KEYS.EMAIL_PROVIDER)),
    emailConfigured: await isEmailServiceConfigured(),
    dedicatedUnsubscribeSecret: hasDedicatedNewsletterSecret(),
    lastCronHeartbeatAt: map.get(SETTING_KEYS.NEWSLETTER_LAST_CRON_HEARTBEAT_AT) || '',
    domainStatus: map.get(SETTING_KEYS.NEWSLETTER_DOMAIN_STATUS) || 'unchecked',
  }
}

function parseRatePerMinute(value: string | undefined): number {
  const parsed = Number(value || 60)
  if (!Number.isFinite(parsed)) return 60
  return Math.min(1200, Math.max(1, Math.floor(parsed)))
}

function parseEmailProvider(value: string | undefined): EmailProvider {
  return value === 'smtp' || value === 'zsend' ? value : 'resend'
}

export function validateNewsletterSendPrerequisites(settings: NewsletterSettings): string[] {
  const errors: string[] = []
  if (!settings.emailConfigured) errors.push('尚未設定寄信服務，只能存草稿。')
  if (!settings.footerName || !settings.footerEmail) {
    errors.push('電子報寄件人名稱與聯絡信箱必填。')
  }
  if (!settings.dedicatedUnsubscribeSecret) {
    errors.push('尚未設定 NEWSLETTER_UNSUBSCRIBE_SECRET，退訂簽章不可與登入 secret 共用。')
  }
  if (!isPublicNewsletterUrl(settings.appUrl)) {
    errors.push('站點網址不可使用 0.0.0.0、localhost 或容器內部網址，請先設定正式公開網址。')
  }
  return errors
}

function isPublicNewsletterUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.hostname === '0.0.0.0' || url.hostname === '::' || url.hostname === '[::]') return false
    if (process.env.NODE_ENV === 'production' && isInternalAppHost(url.hostname)) return false
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:')
  } catch {
    return false
  }
}
