export const SETTINGS_SECTION_IDS = [
  'basic',
  'media',
  'analytics',
  'layout',
  'email',
  'social-login',
  'ai',
] as const

export function getSettingsSectionClass(activeSection: string, sectionId: string) {
  return activeSection === sectionId ? '' : 'hidden'
}
