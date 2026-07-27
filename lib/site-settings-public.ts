import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { PUBLIC_SITE_DEFAULTS } from '@/lib/site-settings-public-types'
import { resolveAppUrl } from '@/lib/app-url'
import { resolveSiteIconPath } from '@/lib/site-brand-assets'
import type { PublicSiteSettings } from '@/lib/site-settings-public-types'
import { getGoogleCredentials, getAppleCredentials } from '@/lib/auth-credentials'
import { getDisplaySiteName } from '@/lib/site-brand'

export { PUBLIC_SITE_DEFAULTS }
export type { PublicSiteSettings }

function safeParseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  const keys = [
    SETTING_KEYS.SITE_NAME,
    SETTING_KEYS.SITE_LOGO,
    SETTING_KEYS.SHARE_TITLE,
    SETTING_KEYS.SHARE_DESCRIPTION,
    SETTING_KEYS.SHARE_LOGO,
    SETTING_KEYS.SHARE_IMAGE,
    SETTING_KEYS.CONTACT_EMAIL,
    SETTING_KEYS.BRAND_DISPLAY_NAME,
    SETTING_KEYS.BRAND_SUBTITLE,
    SETTING_KEYS.HEADER_LEFT_LINKS,
    SETTING_KEYS.HEADER_RIGHT_LINKS,
    SETTING_KEYS.FOOTER_DESCRIPTION,
    SETTING_KEYS.FOOTER_SECTIONS,
  ]

  let settings: { key: string; value: string }[] = []
  try {
    settings = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
    })
  } catch {
    // DB not available (e.g. during build), return defaults
  }

  const map = new Map(settings.map((s) => [s.key, s.value]))

  const [googleCreds, appleCreds, appUrl] = await Promise.all([
    getGoogleCredentials(),
    getAppleCredentials(),
    resolveAppUrl().catch(() => undefined),
  ])

  return {
    siteName: getDisplaySiteName(map.get(SETTING_KEYS.SITE_NAME) || PUBLIC_SITE_DEFAULTS.siteName),
    siteLogo: resolveSiteIconPath(
      map.get(SETTING_KEYS.SITE_LOGO) || PUBLIC_SITE_DEFAULTS.siteLogo,
      appUrl
    ),
    shareTitle: map.get(SETTING_KEYS.SHARE_TITLE) || '',
    shareDescription:
      map.get(SETTING_KEYS.SHARE_DESCRIPTION) ||
      PUBLIC_SITE_DEFAULTS.shareDescription,
    shareLogo: map.get(SETTING_KEYS.SHARE_LOGO) || '',
    shareImage: map.get(SETTING_KEYS.SHARE_IMAGE) || '',
    contactEmail:
      map.get(SETTING_KEYS.CONTACT_EMAIL) || PUBLIC_SITE_DEFAULTS.contactEmail,
    brandDisplayName:
      map.get(SETTING_KEYS.BRAND_DISPLAY_NAME) ||
      PUBLIC_SITE_DEFAULTS.brandDisplayName,
    brandSubtitle:
      map.get(SETTING_KEYS.BRAND_SUBTITLE) || PUBLIC_SITE_DEFAULTS.brandSubtitle,
    googleLoginEnabled: googleCreds.isConfigured,
    appleLoginEnabled: appleCreds.isConfigured,
    headerLeftLinks: safeParseJson(map.get(SETTING_KEYS.HEADER_LEFT_LINKS), []),
    headerRightLinks: safeParseJson(map.get(SETTING_KEYS.HEADER_RIGHT_LINKS), []),
    footerDescription: map.get(SETTING_KEYS.FOOTER_DESCRIPTION) || PUBLIC_SITE_DEFAULTS.footerDescription,
    footerSections: safeParseJson(map.get(SETTING_KEYS.FOOTER_SECTIONS), []),
  }
})
