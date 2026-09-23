export const GENERAL_EMAIL_CONSENT_VERSION = 'GENERAL_EMAIL_V1_202609' as const
export const MARKETING_EMAIL_CONSENT_VERSION = 'MARKETING_EMAIL_V1_202609' as const

export const GENERAL_EMAIL_CONSENT_TEXT =
  '我願意接收 BestAppStore 的內容精選、服務使用指南與非必要功能更新電子報；可隨時退訂。本選項不影響註冊、購買或既有服務使用。' as const

export const MARKETING_EMAIL_CONSENT_TEXT =
  '我願意接收 BestAppStore 的優惠、活動及新服務行銷電子報；可隨時退訂。本選項不影響註冊、購買或既有服務使用。' as const

export const REQUIRED_SERVICE_NOTICE_TEXT =
  '與帳號、安全、交易、付款、權限及已開通服務直接相關的必要通知，為履行服務所需，不屬於行銷訂閱。' as const

export type VersionedEmailConsentType = 'general' | 'marketing'

export function getCurrentEmailConsentVersion(type: VersionedEmailConsentType): string {
  return type === 'marketing'
    ? MARKETING_EMAIL_CONSENT_VERSION
    : GENERAL_EMAIL_CONSENT_VERSION
}

export function isCurrentEmailConsentVersion(
  type: VersionedEmailConsentType,
  termsVersion: string | null | undefined
): boolean {
  return termsVersion === getCurrentEmailConsentVersion(type)
}
