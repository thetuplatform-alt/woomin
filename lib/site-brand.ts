const LEGACY_SITE_NAMES = new Set(['Course Realms', 'Realms'])

export function getDisplaySiteName(value: string | null | undefined): string {
  return !value || LEGACY_SITE_NAMES.has(value) ? 'WooMin' : value
}
