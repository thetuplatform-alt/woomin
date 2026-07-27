export const DEFAULT_SITE_ICON_PATH = '/icon.svg'
export const LEGACY_SITE_ICON_PATH = '/icon.png'

const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isLegacySiteIconPath(value: string, appUrl?: string | null): boolean {
  if (value === LEGACY_SITE_ICON_PATH) {
    return true
  }

  if (!appUrl || !ABSOLUTE_HTTP_URL_PATTERN.test(value)) {
    return false
  }

  try {
    const iconUrl = new URL(value)
    const siteOrigin = normalizeOrigin(appUrl)
    return Boolean(siteOrigin) &&
      iconUrl.origin === siteOrigin &&
      iconUrl.pathname === LEGACY_SITE_ICON_PATH
  } catch {
    return false
  }
}

export function resolveSiteIconPath(
  value?: string | null,
  appUrl?: string | null
): string {
  const trimmed = value?.trim() || ''
  if (!trimmed || isLegacySiteIconPath(trimmed, appUrl)) {
    return DEFAULT_SITE_ICON_PATH
  }

  return trimmed
}
