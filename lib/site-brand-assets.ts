export const DEFAULT_SITE_ICON_PATH = '/bestappstore-icon.png'
export const LEGACY_SITE_ICON_PATH = '/icon.png'
export const LEGACY_SITE_ICON_SVG_PATH = '/icon.svg'

const LEGACY_SITE_ICON_PATHS = [
  LEGACY_SITE_ICON_PATH,
  LEGACY_SITE_ICON_SVG_PATH,
] as const

const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isLegacySiteIconPath(value: string, appUrl?: string | null): boolean {
  if (LEGACY_SITE_ICON_PATHS.some((path) => value === path)) {
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
      LEGACY_SITE_ICON_PATHS.some((path) => iconUrl.pathname === path)
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
