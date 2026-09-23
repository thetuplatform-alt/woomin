export const LEGAL_BRAND_NAME = 'BestAppStore'
export const LEGAL_CONTACT_EMAIL = 'service@bestappstore.co.uk'

const LEGACY_LEGAL_BRANDING = [
  ['WooMin Learning System', LEGAL_BRAND_NAME],
  ['WooMin', LEGAL_BRAND_NAME],
  ['support@example.com', LEGAL_CONTACT_EMAIL],
] as const

export function normalizeLegalBranding(content: string): string {
  return LEGACY_LEGAL_BRANDING.reduce(
    (normalized, [legacyValue, replacement]) =>
      normalized.replaceAll(legacyValue, replacement),
    content
  )
}
