// lib/actions/settings.ts
// 系統設定 Server Actions
// 提供設定 CRUD 操作

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { resolveAppUrl } from '@/lib/app-url'
import { getDisplaySiteName } from '@/lib/site-brand'
import {
  clearCloudflareStreamConfigCache,
  getCloudflareStreamConfig,
  getCloudflareStreamConfigStatus,
} from '@/lib/cloudflare-stream-config'
import {
  clearBunnyStreamConfigCache,
  getBunnyStreamConfig,
  getBunnyStreamConfigStatus,
} from '@/lib/bunny-stream-config'
import { testLibraryConnection } from '@/lib/bunny'
import { encryptSecret } from '@/lib/crypto/settings-encryption'
import {
  siteSettingsSchema,
  cloudflareStreamSettingsSchema,
  emailSettingsSchema,
  socialLoginSettingsSchema,
  layoutSettingsSchema,
  legalMarkdownSchema,
  aiSettingsSchema,
  SETTING_KEYS,
  type SiteSettingsFormData,
  type CloudflareStreamSettingsFormData,
  type EmailSettingsFormData,
  type SocialLoginSettingsFormData,
  type LayoutSettingsFormData,
  type AISettingsFormData,
  bunnyStreamSettingsSchema,
  type BunnyStreamSettingsFormData,
} from '@/lib/validations/settings'
import {
  SHOPLINE_DEFAULT_PAYMENT_METHODS,
  normalizeShoplinePaymentMethods,
  parseShoplinePaymentMethods,
  serializeShoplinePaymentMethods,
  type ShoplinePaymentMethodCode,
} from '@/lib/payment/shopline-methods'
import {
  getCloudVideoProviderFilter,
  getCloudVideoProviderSwitchWarning,
  normalizeCloudVideoProvider,
} from '@/lib/video-provider-policy'

// requireOnlyAdminAuth 從 @/lib/require-admin 引入（直接查 DB 確保角色即時生效）
// settings.ts 的所有操作僅限 ADMIN（不含 EDITOR）

/**
 * 記錄管理員操作日誌
 */
async function logAdminAction(
  adminId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'UPDATE_SETTINGS',
        targetType: 'SiteSetting',
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    })
  } catch (error) {
    console.error('記錄操作日誌失敗:', error)
  }
}

/**
 * 取得所有設定
 */
/**
 * 需要遮蔽的敏感設定 key 列表
 */
const SENSITIVE_SETTING_KEYS: Set<string> = new Set([
  SETTING_KEYS.POSTHOG_PERSONAL_API_KEY,
  SETTING_KEYS.META_CAPI_ACCESS_TOKEN,
  SETTING_KEYS.GEMINI_API_KEY,
  SETTING_KEYS.RESEND_API_KEY,
  SETTING_KEYS.ZSEND_API_KEY,
  SETTING_KEYS.CLOUDFLARE_API_TOKEN,
  SETTING_KEYS.CLOUDFLARE_STREAM_SIGNING_SECRET,
  SETTING_KEYS.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
  SETTING_KEYS.GOOGLE_CLIENT_SECRET,
  SETTING_KEYS.APPLE_PRIVATE_KEY,
  SETTING_KEYS.SHOPLINE_API_KEY,
  SETTING_KEYS.SHOPLINE_CLIENT_KEY,
  SETTING_KEYS.SHOPLINE_SIGN_KEY,
  SETTING_KEYS.STRIPE_SECRET_KEY,
  SETTING_KEYS.STRIPE_WEBHOOK_SECRET,
  SETTING_KEYS.PAYUNI_HASH_KEY,
  SETTING_KEYS.PAYUNI_HASH_IV,
  SETTING_KEYS.BUNNY_LIBRARY_API_KEY,
  SETTING_KEYS.EINVOICE_HASH_KEY,
  SETTING_KEYS.EINVOICE_HASH_IV,
])

/**
 * 遮蔽敏感值，只保留前後幾個字元
 */
function maskSecret(value: string): string {
  if (!value || value.length < 8) return value ? '••••••••' : ''
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export async function getSiteSettings(): Promise<Record<string, string>> {
  await requireOnlyAdminAuth()

  const settings = await prisma.siteSetting.findMany()

  const result: Record<string, string> = {}
  for (const setting of settings) {
    if (SENSITIVE_SETTING_KEYS.has(setting.key)) {
      result[setting.key] = maskSecret(setting.value)
    } else {
      result[setting.key] = setting.key === SETTING_KEYS.SITE_NAME
        ? getDisplaySiteName(setting.value)
        : setting.value
    }
  }

  return result
}

/**
 * 取得單一設定
 */
export async function getSettingByKey(key: string): Promise<string | null> {
  await requireOnlyAdminAuth()

  const setting = await prisma.siteSetting.findUnique({
    where: { key },
  })

  if (!setting) return null

  // 對敏感設定做遮蔽處理，與 getSiteSettings 行為一致
  if (SENSITIVE_SETTING_KEYS.has(key)) {
    return maskSecret(setting.value)
  }

  return setting.value
}

export async function getActiveCloudVideoProvider() {
  await requireOnlyAdminAuth()
  const setting = await prisma.siteSetting.findUnique({
    where: { key: SETTING_KEYS.VIDEO_PROVIDER },
    select: { value: true },
  })
  return normalizeCloudVideoProvider(setting?.value)
}

/**
 * 更新或建立設定
 */
async function upsertSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

/**
 * 更新站點設定
 */
export async function updateSiteSettings(
  data: SiteSettingsFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()

    // 驗證資料
    const validatedData = siteSettingsSchema.parse(data)

    const currentProviderSetting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.VIDEO_PROVIDER },
      select: { value: true },
    })
    const currentCloudProvider = normalizeCloudVideoProvider(currentProviderSetting?.value)
    const nextCloudProvider = normalizeCloudVideoProvider(validatedData.videoProvider)

    if (
      currentCloudProvider &&
      nextCloudProvider &&
      currentCloudProvider !== nextCloudProvider &&
      !validatedData.confirmVideoProviderSwitch
    ) {
      const otherProviderCount = await prisma.media.count({
        where: {
          type: 'VIDEO',
          ...getCloudVideoProviderFilter(currentCloudProvider),
        },
      })
      if (otherProviderCount > 0) {
        return {
          success: false,
          error: getCloudVideoProviderSwitchWarning(
            currentCloudProvider,
            nextCloudProvider,
            otherProviderCount
          ),
        }
      }
    }

    // 更新設定
    await Promise.all([
      upsertSetting(SETTING_KEYS.SITE_NAME, validatedData.siteName),
      upsertSetting(SETTING_KEYS.SITE_LOGO, validatedData.siteLogo || ''),
      upsertSetting(SETTING_KEYS.SHARE_TITLE, validatedData.shareTitle || ''),
      upsertSetting(SETTING_KEYS.SHARE_DESCRIPTION, validatedData.shareDescription || ''),
      upsertSetting(SETTING_KEYS.SHARE_LOGO, validatedData.shareLogo || ''),
      upsertSetting(SETTING_KEYS.SHARE_IMAGE, validatedData.shareImage || ''),
      upsertSetting(SETTING_KEYS.SITE_URL, validatedData.siteUrl || ''),
      upsertSetting(SETTING_KEYS.CONTACT_EMAIL, validatedData.contactEmail || ''),
      upsertSetting(SETTING_KEYS.BRAND_DISPLAY_NAME, validatedData.brandDisplayName || ''),
      upsertSetting(SETTING_KEYS.BRAND_SUBTITLE, validatedData.brandSubtitle || ''),
      upsertSetting(SETTING_KEYS.VIDEO_PROVIDER, validatedData.videoProvider || 'youtube'),
      upsertSetting(SETTING_KEYS.STORAGE_DRIVER, validatedData.storageDriver || 'local'),
      upsertSetting(SETTING_KEYS.LOCAL_STORAGE_ROOT, validatedData.localStorageRoot || ''),
      upsertSetting(SETTING_KEYS.GA_ID, validatedData.gaId || ''),
      upsertSetting(SETTING_KEYS.POSTHOG_KEY, validatedData.posthogKey || ''),
      upsertSetting(SETTING_KEYS.POSTHOG_HOST, validatedData.posthogHost || ''),
      // 敏感欄位：只有在使用者實際輸入新值時才更新（遮蔽值含 '...' 不存回）
      ...(validatedData.posthogPersonalApiKey && !validatedData.posthogPersonalApiKey.includes('...')
        ? [upsertSetting(SETTING_KEYS.POSTHOG_PERSONAL_API_KEY, validatedData.posthogPersonalApiKey)]
        : []),
      upsertSetting(SETTING_KEYS.META_PIXEL_ID, validatedData.metaPixelId || ''),
      ...(validatedData.metaCapiAccessToken && !validatedData.metaCapiAccessToken.includes('...')
        ? [upsertSetting(SETTING_KEYS.META_CAPI_ACCESS_TOKEN, validatedData.metaCapiAccessToken)]
        : []),
    ])

    // 記錄操作日誌（遮蔽敏感欄位，不記錄原始秘鑰）
    const safeLogData = { ...validatedData } as Record<string, unknown>
    const sensitiveFields = [
      'posthogPersonalApiKey', 'metaCapiAccessToken',
    ]
    for (const field of sensitiveFields) {
      if (safeLogData[field] && typeof safeLogData[field] === 'string') {
        safeLogData[field] = '[REDACTED]'
      }
    }
    await logAdminAction(user.id as string, {
      action: 'update_site_settings',
      settings: safeLogData,
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/settings')
    revalidatePath('/')
    revalidatePath('/courses')

    return { success: true }
  } catch (error) {
    console.error('更新站點設定失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新設定時發生錯誤' }
  }
}

export async function getCloudflareStreamSettings(): Promise<{
  accountId: string
  customerCode: string
  apiTokenHint: string
  signingSecretHint: string
  webhookSecretHint: string
  isUploadConfigured: boolean
  isPlaybackConfigured: boolean
  isSigningConfigured: boolean
  isWebhookConfigured: boolean
}> {
  // M16：Cloudflare Stream 憑證屬機敏設定，僅限 ADMIN（與其他設定一致）
  await requireOnlyAdminAuth()

  const config = await getCloudflareStreamConfigStatus()

  return {
    accountId: config.accountId,
    customerCode: config.customerCode,
    apiTokenHint: config.apiToken ? maskSecret(config.apiToken) : '',
    signingSecretHint: config.signingSecret ? maskSecret(config.signingSecret) : '',
    webhookSecretHint: config.webhookSecret ? maskSecret(config.webhookSecret) : '',
    isUploadConfigured: config.hasUploadConfig,
    isPlaybackConfigured: config.hasPlaybackConfig,
    isSigningConfigured: config.hasSigningConfig,
    isWebhookConfigured: config.hasWebhookConfig,
  }
}

export async function updateCloudflareStreamSettings(
  data: CloudflareStreamSettingsFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()
    const validatedData = cloudflareStreamSettingsSchema.parse(data)
    const currentConfig = await getCloudflareStreamConfig({ forceRefresh: true })
    const nextAccountId = validatedData.accountId?.trim() || ''
    const nextCustomerCode = validatedData.customerCode?.trim() || ''
    const accountChanged = currentConfig.accountId !== nextAccountId

    if (accountChanged && currentConfig.apiToken && !validatedData.apiTokenTouched) {
      return {
        success: false,
        error:
          '你已修改 Cloudflare Account ID，請重新貼上對應的 API Token 後再儲存，避免帳號與 token 不匹配。',
      }
    }

    await Promise.all([
      upsertSetting(
        SETTING_KEYS.CLOUDFLARE_ACCOUNT_ID,
        nextAccountId
      ),
      upsertSetting(
        SETTING_KEYS.CLOUDFLARE_STREAM_CUSTOMER_CODE,
        nextCustomerCode
      ),
      ...(validatedData.apiTokenTouched
        ? [
            upsertSetting(
              SETTING_KEYS.CLOUDFLARE_API_TOKEN,
              (validatedData.apiToken || '').trim()
            ),
          ]
        : []),
      ...(validatedData.signingSecretTouched
        ? [
            upsertSetting(
              SETTING_KEYS.CLOUDFLARE_STREAM_SIGNING_SECRET,
              (validatedData.signingSecret || '').trim()
            ),
          ]
        : []),
      ...(validatedData.webhookSecretTouched
        ? [
            upsertSetting(
              SETTING_KEYS.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
              (validatedData.webhookSecret || '').trim()
            ),
          ]
        : []),
    ])

    clearCloudflareStreamConfigCache()

    await logAdminAction(user.id as string, {
      action: 'update_cloudflare_stream_settings',
      settings: {
        accountId: validatedData.accountId?.trim() || '',
        customerCode: validatedData.customerCode?.trim() || '',
        apiToken: validatedData.apiToken ? '[REDACTED]' : '',
        signingSecret: validatedData.signingSecret ? '[REDACTED]' : '',
        webhookSecret: validatedData.webhookSecret ? '[REDACTED]' : '',
      },
    })

    revalidatePath('/admin/settings')
    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')
    revalidatePath('/admin/courses')

    return { success: true }
  } catch (error) {
    console.error('更新 Cloudflare Stream 設定失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新 Cloudflare Stream 設定時發生錯誤' }
  }
}

export async function testCloudflareStreamConnection(input?: {
  accountId?: string
  apiToken?: string
}): Promise<{ success: boolean; message: string }> {
  try {
    await requireOnlyAdminAuth()

    const storedConfig = await getCloudflareStreamConfig()
    const accountId =
      input?.accountId?.trim() || storedConfig.accountId || ''
    const inputApiToken = input?.apiToken?.trim() || ''
    const apiToken =
      inputApiToken && !inputApiToken.includes('...')
        ? inputApiToken
        : storedConfig.apiToken || ''

    if (!accountId || !apiToken) {
      return {
        success: false,
        message: '請先填寫並儲存 Cloudflare Account ID 與 API Token。',
      }
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?limit=1`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    )

    const data = await response.json()

    if (!data.success) {
      const firstError = data.errors?.[0]
      if (firstError?.code === 10000) {
        return {
          success: false,
          message:
            'Cloudflare 驗證失敗。這通常代表目前實際使用的 Account ID 與 API Token 並不是同一組，或 API Token 不屬於這個帳號。',
        }
      }

      return {
        success: false,
        message:
          firstError?.message || 'Cloudflare Stream 連線測試失敗',
      }
    }

    return {
      success: true,
      message: 'Cloudflare Stream 連線成功，這組認證目前可正常呼叫 Stream API。',
    }
  } catch (error) {
    console.error('測試 Cloudflare Stream 連線失敗:', error)
    return {
      success: false,
      message: 'Cloudflare Stream 連線測試失敗，請稍後再試。',
    }
  }
}

export async function getBunnyStreamSettings() {
  await requireOnlyAdminAuth()
  const config = await getBunnyStreamConfigStatus()
  return {
    libraryId: config.libraryId,
    apiKeyHint: config.apiKey ? maskSecret(config.apiKey) : '',
    readOnlyApiKeyHint: config.readOnlyApiKey ? maskSecret(config.readOnlyApiKey) : '',
    isConfigured: config.isConfigured,
  }
}

export async function testBunnyStreamConnection(input?: {
  libraryId?: string
  apiKey?: string
}): Promise<{ success: boolean; message: string }> {
  try {
    await requireOnlyAdminAuth()
    const stored = await getBunnyStreamConfig()
    const libraryId = input?.libraryId?.trim() || stored.libraryId
    const enteredKey = input?.apiKey?.trim() || ''
    const apiKey = enteredKey && !enteredKey.includes('...') ? enteredKey : stored.apiKey
    if (!libraryId || !apiKey) return { success: false, message: '請先填寫 Library ID 與 Library API Key。' }

    const result = await testLibraryConnection(libraryId, apiKey)
    return result.success
      ? { success: true, message: 'Bunny Stream 連線成功。' }
      : { success: false, message: `Bunny Stream 連線失敗（${result.status}）。` }
  } catch {
    return { success: false, message: 'Bunny Stream 連線測試失敗，請稍後再試。' }
  }
}

export async function updateBunnyStreamSettings(
  data: BunnyStreamSettingsFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()
    const validated = bunnyStreamSettingsSchema.parse(data)
    const current = await getBunnyStreamConfig({ forceRefresh: true })
    const nextLibraryId = validated.libraryId?.trim() || ''
    const nextApiKey = validated.apiKey?.trim() || ''
    const nextReadOnlyApiKey = validated.readOnlyApiKey?.trim() || ''

    await upsertSetting(SETTING_KEYS.BUNNY_LIBRARY_ID, nextLibraryId)
    if (validated.apiKeyTouched && nextApiKey && !nextApiKey.includes('...')) {
      await upsertSetting(SETTING_KEYS.BUNNY_LIBRARY_API_KEY, encryptSecret(nextApiKey))
    } else if (!current.apiKey && nextApiKey) {
      await upsertSetting(SETTING_KEYS.BUNNY_LIBRARY_API_KEY, encryptSecret(nextApiKey))
    }
    if (validated.readOnlyApiKeyTouched && nextReadOnlyApiKey && !nextReadOnlyApiKey.includes('...')) {
      await upsertSetting(SETTING_KEYS.BUNNY_READ_ONLY_API_KEY, encryptSecret(nextReadOnlyApiKey))
    } else if (!current.readOnlyApiKey && nextReadOnlyApiKey) {
      await upsertSetting(SETTING_KEYS.BUNNY_READ_ONLY_API_KEY, encryptSecret(nextReadOnlyApiKey))
    }
    clearBunnyStreamConfigCache()
    await logAdminAction(user.id as string, {
      action: 'update_bunny_stream_settings',
      settings: { libraryId: nextLibraryId, apiKey: '[REDACTED]', readOnlyApiKey: '[REDACTED]' },
    })
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '更新 Bunny 設定失敗' }
  }
}

/**
 * 更新 Email 設定
 */
export async function updateEmailSettings(
  data: EmailSettingsFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()

    // 驗證資料
    const validatedData = emailSettingsSchema.parse(data)

    // 更新設定
    await Promise.all([
      upsertSetting(SETTING_KEYS.EMAIL_PROVIDER, validatedData.emailProvider || 'resend'),
      ...(validatedData.resendApiKey && !validatedData.resendApiKey.includes('...')
        ? [upsertSetting(SETTING_KEYS.RESEND_API_KEY, validatedData.resendApiKey)]
        : []),
      ...(validatedData.tosendApiKey && !validatedData.tosendApiKey.includes('...')
        ? [upsertSetting(SETTING_KEYS.TOSEND_API_KEY, validatedData.tosendApiKey)]
        : []),
      ...(validatedData.zsendApiKey && !validatedData.zsendApiKey.includes('...')
        ? [upsertSetting(SETTING_KEYS.ZSEND_API_KEY, validatedData.zsendApiKey)]
        : []),
      ...(validatedData.zsendDomain !== undefined
        ? [upsertSetting(SETTING_KEYS.ZSEND_DOMAIN, validatedData.zsendDomain || '')]
        : []),
      upsertSetting(SETTING_KEYS.EMAIL_SENDER_NAME, validatedData.emailSenderName),
      ...(validatedData.emailFrom !== undefined
        ? [upsertSetting(SETTING_KEYS.EMAIL_FROM, validatedData.emailFrom || '')]
        : []),
      // SMTP 設定（只在有值時更新，遮蔽值不存回）
      ...(validatedData.smtpHost !== undefined
        ? [upsertSetting(SETTING_KEYS.SMTP_HOST, validatedData.smtpHost || '')]
        : []),
      ...(validatedData.smtpPort !== undefined
        ? [upsertSetting(SETTING_KEYS.SMTP_PORT, validatedData.smtpPort || '')]
        : []),
      ...(validatedData.smtpUser !== undefined
        ? [upsertSetting(SETTING_KEYS.SMTP_USER, validatedData.smtpUser || '')]
        : []),
      // SMTP 密碼：只有實際輸入新值才更新（遮蔽值含 '...' 不存回）
      ...(validatedData.smtpPass && !validatedData.smtpPass.includes('...')
        ? [upsertSetting(SETTING_KEYS.SMTP_PASS, validatedData.smtpPass)]
        : []),
      upsertSetting(SETTING_KEYS.SMTP_SECURE, String(validatedData.smtpSecure ?? false)),
      upsertSetting(SETTING_KEYS.NEWSLETTER_SENDER_NAME, validatedData.newsletterSenderName || validatedData.emailSenderName),
      upsertSetting(SETTING_KEYS.NEWSLETTER_REPLY_TO, validatedData.newsletterReplyTo || validatedData.emailFrom || ''),
      upsertSetting(SETTING_KEYS.NEWSLETTER_FOOTER_NAME, validatedData.newsletterFooterName || validatedData.emailSenderName),
      upsertSetting(SETTING_KEYS.NEWSLETTER_FOOTER_ADDRESS, validatedData.newsletterFooterAddress || ''),
      upsertSetting(SETTING_KEYS.NEWSLETTER_FOOTER_EMAIL, validatedData.newsletterFooterEmail || validatedData.emailFrom || ''),
      upsertSetting(SETTING_KEYS.NEWSLETTER_RATE_PER_MINUTE, validatedData.newsletterRatePerMinute || '60'),
    ])

    // 記錄操作日誌（遮蔽敏感欄位）
    await logAdminAction(user.id as string, {
      action: 'update_email_settings',
      settings: {
        emailProvider: validatedData.emailProvider,
        resendApiKey: validatedData.resendApiKey ? '[REDACTED]' : '',
        tosendApiKey: validatedData.tosendApiKey ? '[REDACTED]' : '',
        zsendApiKey: validatedData.zsendApiKey ? '[REDACTED]' : '',
        zsendDomain: validatedData.zsendDomain,
        emailSenderName: validatedData.emailSenderName,
        emailFrom: validatedData.emailFrom,
        smtpHost: validatedData.smtpHost,
        smtpPort: validatedData.smtpPort,
        smtpUser: validatedData.smtpUser,
        smtpPass: validatedData.smtpPass ? '[REDACTED]' : '',
        newsletterSenderName: validatedData.newsletterSenderName,
        newsletterFooterName: validatedData.newsletterFooterName,
        newsletterFooterAddress: validatedData.newsletterFooterAddress ? '[SET]' : '',
        newsletterFooterEmail: validatedData.newsletterFooterEmail,
        newsletterRatePerMinute: validatedData.newsletterRatePerMinute,
      },
    })

    // 清除 email transport 快取，使新設定生效
    const { clearTransportCache } = await import('@/lib/email-transport')
    clearTransportCache()

    // 重新驗證頁面快取
    revalidatePath('/admin/settings/email')

    return { success: true }
  } catch (error) {
    console.error('更新 Email 設定失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新設定時發生錯誤' }
  }
}

export async function updateSocialLoginSettings(
  data: SocialLoginSettingsFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()
    const validatedData = socialLoginSettingsSchema.parse(data)

    await Promise.all([
      upsertSetting(SETTING_KEYS.GOOGLE_OAUTH_ENABLED, String(validatedData.googleEnabled)),
      upsertSetting(SETTING_KEYS.GOOGLE_CLIENT_ID, validatedData.googleClientId || ''),
      ...(validatedData.googleClientSecret && !validatedData.googleClientSecret.includes('...')
        ? [upsertSetting(SETTING_KEYS.GOOGLE_CLIENT_SECRET, validatedData.googleClientSecret)]
        : []),
      upsertSetting(SETTING_KEYS.APPLE_OAUTH_ENABLED, String(validatedData.appleEnabled)),
      upsertSetting(SETTING_KEYS.APPLE_CLIENT_ID, validatedData.appleClientId || ''),
      upsertSetting(SETTING_KEYS.APPLE_TEAM_ID, validatedData.appleTeamId || ''),
      upsertSetting(SETTING_KEYS.APPLE_KEY_ID, validatedData.appleKeyId || ''),
      ...(validatedData.applePrivateKey && !validatedData.applePrivateKey.includes('...')
        ? [upsertSetting(SETTING_KEYS.APPLE_PRIVATE_KEY, validatedData.applePrivateKey)]
        : []),
    ])

    await logAdminAction(user.id as string, {
      action: 'update_social_login_settings',
      settings: {
        googleEnabled: validatedData.googleEnabled,
        googleClientId: validatedData.googleClientId,
        googleClientSecret: validatedData.googleClientSecret ? '[REDACTED]' : '',
        appleEnabled: validatedData.appleEnabled,
        appleClientId: validatedData.appleClientId,
        appleTeamId: validatedData.appleTeamId,
        appleKeyId: validatedData.appleKeyId,
        applePrivateKey: validatedData.applePrivateKey ? '[REDACTED]' : '',
      },
    })

    revalidatePath('/admin/settings')
    revalidatePath('/login')

    return { success: true }
  } catch (error) {
    console.error('更新 登入方式 設定失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新 登入方式 設定時發生未知錯誤' }
  }
}

/**
 * 取得金流設定（含 DB 值，遮罩敏感資料）
 */
export async function getPaymentSettings(): Promise<{
  gateway: 'shopline' | 'stripe' | 'payuni'
  shopline: {
    merchantId: string
    apiKeyHint: string
    clientKeyHint: string
    signKeyHint: string
    testMode: boolean
    enabledMethods: ShoplinePaymentMethodCode[]
    webhookUrl: string
    returnUrl: string
    isConfigured: boolean
  }
  stripe: {
    secretKeyHint: string
    webhookSecretHint: string
    webhookUrl: string
    isConfigured: boolean
    isTestMode: boolean
  }
  payuni: {
    merchantId: string
    hashKeyHint: string
    hashIVHint: string
    testMode: boolean
    returnUrl: string
    notifyUrl: string
    isConfigured: boolean
  }
}> {
  await requireOnlyAdminAuth()

  const { getPaymentGatewaySettings } = await import('@/lib/payment/gateway-factory')
  const settings = await getPaymentGatewaySettings()
  const appUrl = await resolveAppUrl()

  const maskTail = (value: string, tail = 4): string =>
    value
      ? `${'•'.repeat(Math.max(0, Math.min(12, value.length - tail)))}${value.slice(-tail)}`
      : ''

  const shoplineApiKey = settings.shopline.apiKey
  const shoplineApiKeyHint = maskTail(shoplineApiKey)
  const shoplineClientKey = settings.shopline.clientKey
  const shoplineClientKeyHint = maskTail(shoplineClientKey)
  const shoplineSignKey = settings.shopline.signKey
  const shoplineSignKeyHint = maskTail(shoplineSignKey)

  const stripeKey = settings.stripe.secretKey
  const stripeKeyHint = stripeKey
    ? `${stripeKey.slice(0, 7)}...${stripeKey.slice(-4)}`
    : ''

  const webhookSecret = settings.stripe.webhookSecret
  const webhookSecretHint = webhookSecret
    ? `${webhookSecret.slice(0, 6)}...${webhookSecret.slice(-4)}`
    : ''
  const payuniHashKeyHint = maskTail(settings.payuni.hashKey)
  const payuniHashIVHint = maskTail(settings.payuni.hashIV)

  return {
    gateway: settings.gateway,
    shopline: {
      merchantId: settings.shopline.merchantId,
      apiKeyHint: shoplineApiKeyHint,
      clientKeyHint: shoplineClientKeyHint,
      signKeyHint: shoplineSignKeyHint,
      testMode: settings.shopline.testMode,
      enabledMethods: settings.shopline.enabledPaymentMethods,
      webhookUrl: `${appUrl}/api/webhooks/shopline`,
      returnUrl: `${appUrl}/api/payment/shopline/return`,
      isConfigured: !!(
        settings.shopline.merchantId &&
        settings.shopline.apiKey &&
        settings.shopline.signKey
      ),
    },
    stripe: {
      secretKeyHint: stripeKeyHint,
      webhookSecretHint,
      webhookUrl: `${appUrl}/api/webhooks/stripe`,
      isConfigured: !!(settings.stripe.secretKey && settings.stripe.webhookSecret),
      isTestMode: stripeKey.startsWith('sk_test_'),
    },
    payuni: {
      merchantId: settings.payuni.merchantId,
      hashKeyHint: payuniHashKeyHint,
      hashIVHint: payuniHashIVHint,
      testMode: settings.payuni.testMode,
      returnUrl: `${appUrl}/api/payment/return`,
      notifyUrl: `${appUrl}/api/payment/notify`,
      isConfigured: !!(
        settings.payuni.merchantId &&
        settings.payuni.hashKey &&
        settings.payuni.hashIV
      ),
    },
  }
}

/**
 * 更新金流設定
 */
export async function updatePaymentSettings(data: {
  gateway: 'shopline' | 'stripe' | 'payuni'
  shoplineMerchantId?: string
  shoplineApiKey?: string
  shoplineClientKey?: string
  shoplineSignKey?: string
  shoplineTestMode?: boolean
  shoplineEnabledMethods?: ShoplinePaymentMethodCode[]
  stripeSecretKey?: string
  stripeWebhookSecret?: string
  payuniMerchantId?: string
  payuniHashKey?: string
  payuniHashIV?: string
  payuniTestMode?: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()

    // 基本驗證（不使用 refine，因為已設定時允許秘鑰為空）
    const { z } = await import('zod')
    const baseSchema = z.object({
      gateway: z.enum(['shopline', 'stripe', 'payuni']),
      shoplineMerchantId: z.string().optional().or(z.literal('')),
      shoplineApiKey: z.string().optional().or(z.literal('')),
      shoplineClientKey: z.string().optional().or(z.literal('')),
      shoplineSignKey: z.string().optional().or(z.literal('')),
      shoplineTestMode: z.boolean().default(true),
      shoplineEnabledMethods: z
        .array(z.enum([
          'CreditCard',
          'ApplePay',
          'LinePay',
          'VirtualAccount',
        ]))
        .optional(),
      stripeSecretKey: z.string().optional().or(z.literal('')),
      stripeWebhookSecret: z.string().optional().or(z.literal('')),
      payuniMerchantId: z.string().optional().or(z.literal('')),
      payuniHashKey: z.string().optional().or(z.literal('')),
      payuniHashIV: z.string().optional().or(z.literal('')),
      payuniTestMode: z.boolean().default(true),
    })
    const validatedData = baseSchema.parse(data)

    const existingSettings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.PAYMENT_GATEWAY,
            SETTING_KEYS.SHOPLINE_MERCHANT_ID,
            SETTING_KEYS.SHOPLINE_API_KEY,
            SETTING_KEYS.SHOPLINE_CLIENT_KEY,
            SETTING_KEYS.SHOPLINE_SIGN_KEY,
            SETTING_KEYS.SHOPLINE_PAYMENT_METHODS,
            SETTING_KEYS.STRIPE_SECRET_KEY,
            SETTING_KEYS.STRIPE_WEBHOOK_SECRET,
            SETTING_KEYS.PAYUNI_MERCHANT_ID,
            SETTING_KEYS.PAYUNI_HASH_KEY,
            SETTING_KEYS.PAYUNI_HASH_IV,
            SETTING_KEYS.PAYUNI_TEST_MODE,
          ],
        },
      },
    })
    const existingMap = new Map(existingSettings.map((setting) => [setting.key, setting.value]))

    const mergedShopline = {
      merchantId:
        validatedData.shoplineMerchantId ||
        existingMap.get(SETTING_KEYS.SHOPLINE_MERCHANT_ID) ||
        '',
      apiKey:
        validatedData.shoplineApiKey ||
        existingMap.get(SETTING_KEYS.SHOPLINE_API_KEY) ||
        '',
      signKey:
        validatedData.shoplineSignKey ||
        existingMap.get(SETTING_KEYS.SHOPLINE_SIGN_KEY) ||
        '',
      enabledPaymentMethods: normalizeShoplinePaymentMethods(
        validatedData.shoplineEnabledMethods ||
          parseShoplinePaymentMethods(
            existingMap.get(SETTING_KEYS.SHOPLINE_PAYMENT_METHODS)
          ) ||
          SHOPLINE_DEFAULT_PAYMENT_METHODS
      ),
    }

    const mergedStripe = {
      secretKey:
        validatedData.stripeSecretKey ||
        existingMap.get(SETTING_KEYS.STRIPE_SECRET_KEY) ||
        '',
      webhookSecret:
        validatedData.stripeWebhookSecret ||
        existingMap.get(SETTING_KEYS.STRIPE_WEBHOOK_SECRET) ||
        '',
    }

    const mergedPayUni = {
      merchantId:
        validatedData.payuniMerchantId ||
        existingMap.get(SETTING_KEYS.PAYUNI_MERCHANT_ID) ||
        '',
      hashKey:
        validatedData.payuniHashKey ||
        existingMap.get(SETTING_KEYS.PAYUNI_HASH_KEY) ||
        '',
      hashIV:
        validatedData.payuniHashIV ||
        existingMap.get(SETTING_KEYS.PAYUNI_HASH_IV) ||
        '',
    }

    if (mergedPayUni.hashKey && mergedPayUni.hashKey.length !== 32) {
      return { success: false, error: 'PAYUNi Hash Key 必須剛好 32 個字元。' }
    }
    if (mergedPayUni.hashIV && mergedPayUni.hashIV.length !== 16) {
      return { success: false, error: 'PAYUNi Hash IV 必須剛好 16 個字元。' }
    }
    if (
      validatedData.stripeSecretKey &&
      !/^sk_(test|live)_/.test(validatedData.stripeSecretKey)
    ) {
      return { success: false, error: 'Stripe Secret Key 格式錯誤，必須使用 sk_test_ 或 sk_live_ 開頭的金鑰。' }
    }
    if (
      validatedData.stripeWebhookSecret &&
      !validatedData.stripeWebhookSecret.startsWith('whsec_')
    ) {
      return { success: false, error: 'Stripe Webhook Secret 格式錯誤，必須以 whsec_ 開頭。' }
    }

    // 訂閱保存的是 provider 端資源 ID；直接換帳號／環境／加密憑證會讓取消、
    // 退款、查詢與後續 webhook 全部失去對帳能力。已有任何歷史訂閱時一律阻擋，
    // 必須先完成資料遷移或保留 credential version，不能在設定頁硬切。
    const currentStripeSecret =
      existingMap.get(SETTING_KEYS.STRIPE_SECRET_KEY) ||
      process.env.STRIPE_SECRET_KEY ||
      ''
    const currentPayUniMerchant =
      existingMap.get(SETTING_KEYS.PAYUNI_MERCHANT_ID) ||
      process.env.PAYUNI_MERCHANT_ID ||
      ''
    const currentPayUniHashKey =
      existingMap.get(SETTING_KEYS.PAYUNI_HASH_KEY) ||
      process.env.PAYUNI_HASH_KEY ||
      ''
    const currentPayUniHashIV =
      existingMap.get(SETTING_KEYS.PAYUNI_HASH_IV) ||
      process.env.PAYUNI_HASH_IV ||
      ''
    const currentPayUniTestMode =
      existingMap.has(SETTING_KEYS.PAYUNI_TEST_MODE)
        ? existingMap.get(SETTING_KEYS.PAYUNI_TEST_MODE) !== 'false'
        : process.env.PAYUNI_TEST_MODE !== 'false'
    const stripeIdentityChanged =
      !!validatedData.stripeSecretKey &&
      !!currentStripeSecret &&
      validatedData.stripeSecretKey !== currentStripeSecret
    const payUniIdentityChanged =
      (!!validatedData.payuniMerchantId &&
        !!currentPayUniMerchant &&
        validatedData.payuniMerchantId !== currentPayUniMerchant) ||
      (!!validatedData.payuniHashKey &&
        !!currentPayUniHashKey &&
        validatedData.payuniHashKey !== currentPayUniHashKey) ||
      (!!validatedData.payuniHashIV &&
        !!currentPayUniHashIV &&
        validatedData.payuniHashIV !== currentPayUniHashIV) ||
      validatedData.payuniTestMode !== currentPayUniTestMode

    if (stripeIdentityChanged) {
      const count = await prisma.courseSubscription.count({
        where: { gateway: 'stripe' },
      })
      if (count > 0) {
        return {
          success: false,
          error: `已有 ${count} 筆 Stripe 訂閱帳務紀錄，不能直接更換 Secret Key。請先執行帳號遷移與歷史退款／取消策略。`,
        }
      }
    }
    if (payUniIdentityChanged) {
      const count = await prisma.courseSubscription.count({
        where: { gateway: 'payuni' },
      })
      if (count > 0) {
        return {
          success: false,
          error: `已有 ${count} 筆 PAYUNi 訂閱帳務紀錄，不能直接更換商店、Hash Key/IV 或測試環境。請先完成訂閱遷移。`,
        }
      }
    }

    if (
      validatedData.gateway === 'shopline' &&
      (!mergedShopline.merchantId || !mergedShopline.apiKey || !mergedShopline.signKey)
    ) {
      return {
        success: false,
        error:
          '要啟用 SHOPLINE Payments，至少需要 merchantId、apiKey、signKey。你可以先儲存 merchantId/apiKey/clientKey，等 webhook URL 設好並拿到 signKey 後再切換為主用金流。',
      }
    }

    if (
      validatedData.gateway === 'stripe' &&
      (!mergedStripe.secretKey || !mergedStripe.webhookSecret)
    ) {
      return {
        success: false,
        error: '要啟用 Stripe，請先補齊 Secret Key 與 Webhook Secret。',
      }
    }

    if (
      validatedData.gateway === 'payuni' &&
      (!mergedPayUni.merchantId || !mergedPayUni.hashKey || !mergedPayUni.hashIV)
    ) {
      return {
        success: false,
        error: '要啟用 PAYUNi，請先補齊商店代號、Hash Key、Hash IV。',
      }
    }

    // 儲存所有設定（空值表示不更改）
    await Promise.all([
      upsertSetting(SETTING_KEYS.PAYMENT_GATEWAY, validatedData.gateway),
      // Shopline
      ...(validatedData.shoplineMerchantId
        ? [upsertSetting(SETTING_KEYS.SHOPLINE_MERCHANT_ID, validatedData.shoplineMerchantId)]
        : []),
      ...(validatedData.shoplineApiKey
        ? [upsertSetting(SETTING_KEYS.SHOPLINE_API_KEY, validatedData.shoplineApiKey)]
        : []),
      ...(validatedData.shoplineClientKey
        ? [upsertSetting(SETTING_KEYS.SHOPLINE_CLIENT_KEY, validatedData.shoplineClientKey)]
        : []),
      ...(validatedData.shoplineSignKey
        ? [upsertSetting(SETTING_KEYS.SHOPLINE_SIGN_KEY, validatedData.shoplineSignKey)]
        : []),
      upsertSetting(
        SETTING_KEYS.SHOPLINE_TEST_MODE,
        String(validatedData.shoplineTestMode ?? true)
      ),
      upsertSetting(
        SETTING_KEYS.SHOPLINE_PAYMENT_METHODS,
        serializeShoplinePaymentMethods(mergedShopline.enabledPaymentMethods)
      ),
      // Stripe
      ...(validatedData.stripeSecretKey
        ? [upsertSetting(SETTING_KEYS.STRIPE_SECRET_KEY, validatedData.stripeSecretKey)]
        : []),
      ...(validatedData.stripeWebhookSecret
        ? [upsertSetting(SETTING_KEYS.STRIPE_WEBHOOK_SECRET, validatedData.stripeWebhookSecret)]
        : []),
      // PAYUNi
      ...(validatedData.payuniMerchantId
        ? [upsertSetting(SETTING_KEYS.PAYUNI_MERCHANT_ID, validatedData.payuniMerchantId)]
        : []),
      ...(validatedData.payuniHashKey
        ? [upsertSetting(SETTING_KEYS.PAYUNI_HASH_KEY, validatedData.payuniHashKey)]
        : []),
      ...(validatedData.payuniHashIV
        ? [upsertSetting(SETTING_KEYS.PAYUNI_HASH_IV, validatedData.payuniHashIV)]
        : []),
      upsertSetting(
        SETTING_KEYS.PAYUNI_TEST_MODE,
        String(validatedData.payuniTestMode ?? true)
      ),
    ])

    await logAdminAction(user.id as string, {
      action: 'update_payment_settings',
      gateway: validatedData.gateway,
      shoplineEnabledMethods: mergedShopline.enabledPaymentMethods,
    })

    revalidatePath('/admin/settings/payment')

    return { success: true }
  } catch (error) {
    console.error('更新金流設定失敗:', error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '更新金流設定時發生錯誤' }
  }
}

/**
 * 測試金流連線
 */
export async function testPaymentConnection(
  gateway: 'shopline' | 'stripe' | 'payuni',
  formValues?: {
    shoplineMerchantId?: string
    shoplineApiKey?: string
    shoplineClientKey?: string
    shoplineSignKey?: string
    shoplineTestMode?: boolean
    shoplineEnabledMethods?: ShoplinePaymentMethodCode[]
    stripeSecretKey?: string
    stripeWebhookSecret?: string
    payuniMerchantId?: string
    payuniHashKey?: string
    payuniHashIV?: string
    payuniTestMode?: boolean
  }
): Promise<{ success: boolean; message: string }> {
  try {
    await requireOnlyAdminAuth()

    const { getPaymentGatewaySettings, createGatewayFromSettings } = await import(
      '@/lib/payment/gateway-factory'
    )

    // 從 DB 讀取現有設定，再用表單值覆蓋（表單空值代表不變更）
    const dbSettings = await getPaymentGatewaySettings()
    const mergedSettings = {
      ...dbSettings,
      gateway,
      shopline: {
        merchantId: formValues?.shoplineMerchantId || dbSettings.shopline.merchantId,
        apiKey: formValues?.shoplineApiKey || dbSettings.shopline.apiKey,
        clientKey: formValues?.shoplineClientKey || dbSettings.shopline.clientKey,
        signKey: formValues?.shoplineSignKey || dbSettings.shopline.signKey,
        testMode: formValues?.shoplineTestMode ?? dbSettings.shopline.testMode,
        enabledPaymentMethods: normalizeShoplinePaymentMethods(
          formValues?.shoplineEnabledMethods ||
            dbSettings.shopline.enabledPaymentMethods
        ),
      },
      stripe: {
        secretKey: formValues?.stripeSecretKey || dbSettings.stripe.secretKey,
        webhookSecret: formValues?.stripeWebhookSecret || dbSettings.stripe.webhookSecret,
      },
      payuni: {
        merchantId: formValues?.payuniMerchantId || dbSettings.payuni.merchantId,
        hashKey: formValues?.payuniHashKey || dbSettings.payuni.hashKey,
        hashIV: formValues?.payuniHashIV || dbSettings.payuni.hashIV,
        testMode: formValues?.payuniTestMode ?? dbSettings.payuni.testMode,
      },
    }

    const gw = createGatewayFromSettings(mergedSettings)
    return await gw.testConnection()
  } catch (error) {
    console.error('測試金流連線失敗:', error)
    if (error instanceof Error) {
      return { success: false, message: error.message }
    }
    return { success: false, message: '測試連線時發生錯誤' }
  }
}

/**
 * 向下相容：取得 Stripe 設定（舊介面）
 */
export async function getStripeSettings(): Promise<{
  secretKeyHint: string
  webhookUrl: string
  isConfigured: boolean
  isTestMode: boolean
}> {
  const settings = await getPaymentSettings()
  return {
    secretKeyHint: settings.stripe.secretKeyHint,
    webhookUrl: settings.stripe.webhookUrl,
    isConfigured: settings.stripe.isConfigured,
    isTestMode: settings.stripe.isTestMode,
  }
}

/**
 * 向下相容：測試 Stripe 連線（舊介面）
 */
export async function testStripeConnection(): Promise<{
  success: boolean
  message: string
}> {
  return testPaymentConnection('stripe')
}

/**
 * 取得 Email 設定
 * 優先從資料庫讀取，資料庫沒有才 fallback 到環境變數
 */
export async function getEmailSettings(): Promise<{
  resendApiKeyHint: string
  tosendApiKeyHint: string
  zsendApiKeyHint: string
  zsendDomain: string
  senderName: string
  fromEmail: string
  isConfigured: boolean
  emailProvider: 'resend' | 'smtp' | 'zsend' | 'tosend'
  resendConfigured: boolean
  tosendConfigured: boolean
  zsendConfigured: boolean
  smtp: {
    host: string
    port: string
    user: string
    passHint: string
    secure: boolean
    isConfigured: boolean
  }
  newsletter: {
    senderName: string
    replyTo: string
    footerName: string
    footerAddress: string
    footerEmail: string
    ratePerMinute: string
    lastCronHeartbeatAt: string
    domainStatus: string
  }
}> {
  await requireOnlyAdminAuth()

  const keys = [
    SETTING_KEYS.EMAIL_SENDER_NAME,
    SETTING_KEYS.EMAIL_FROM,
    SETTING_KEYS.EMAIL_PROVIDER,
    SETTING_KEYS.RESEND_API_KEY,
    SETTING_KEYS.TOSEND_API_KEY,
    SETTING_KEYS.ZSEND_API_KEY,
    SETTING_KEYS.ZSEND_DOMAIN,
    SETTING_KEYS.SMTP_HOST,
    SETTING_KEYS.SMTP_PORT,
    SETTING_KEYS.SMTP_USER,
    SETTING_KEYS.SMTP_PASS,
    SETTING_KEYS.SMTP_SECURE,
    SETTING_KEYS.NEWSLETTER_SENDER_NAME,
    SETTING_KEYS.NEWSLETTER_REPLY_TO,
    SETTING_KEYS.NEWSLETTER_FOOTER_NAME,
    SETTING_KEYS.NEWSLETTER_FOOTER_ADDRESS,
    SETTING_KEYS.NEWSLETTER_FOOTER_EMAIL,
    SETTING_KEYS.NEWSLETTER_RATE_PER_MINUTE,
    SETTING_KEYS.NEWSLETTER_LAST_CRON_HEARTBEAT_AT,
    SETTING_KEYS.NEWSLETTER_DOMAIN_STATUS,
  ]

  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  })

  const map = new Map(settings.map((s) => [s.key, s.value]))

  const fromEmail =
    map.get(SETTING_KEYS.EMAIL_FROM) || process.env.EMAIL_FROM || 'noreply@example.com'
  const resendApiKey = map.get(SETTING_KEYS.RESEND_API_KEY) || process.env.RESEND_API_KEY || ''
  const tosendApiKey = map.get(SETTING_KEYS.TOSEND_API_KEY) || process.env.TOSEND_API_KEY || ''
  const zsendApiKey = map.get(SETTING_KEYS.ZSEND_API_KEY) || process.env.ZSEND_API_KEY || ''
  const zsendDomain = map.get(SETTING_KEYS.ZSEND_DOMAIN) || ''
  const providerValue =
    map.get(SETTING_KEYS.EMAIL_PROVIDER) || process.env.EMAIL_PROVIDER || 'resend'
  const provider =
    providerValue === 'smtp' ||
    providerValue === 'zsend' ||
    providerValue === 'tosend'
      ? providerValue
      : 'resend'

  // SMTP 設定（DB 優先，fallback 到 env）
  const smtpHost = map.get(SETTING_KEYS.SMTP_HOST) || process.env.SMTP_HOST || ''
  const smtpPort = map.get(SETTING_KEYS.SMTP_PORT) || process.env.SMTP_PORT || '587'
  const smtpUser = map.get(SETTING_KEYS.SMTP_USER) || process.env.SMTP_USER || ''
  const smtpPass = map.get(SETTING_KEYS.SMTP_PASS) || process.env.SMTP_PASS || ''
  const smtpSecure = (map.get(SETTING_KEYS.SMTP_SECURE) || process.env.SMTP_SECURE) === 'true'

  const smtpIsConfigured = !!smtpHost
  const resendConfigured = !!resendApiKey
  const tosendConfigured = !!tosendApiKey
  const zsendConfigured = !!zsendApiKey

  const passHint = smtpPass
    ? `${'•'.repeat(Math.max(0, smtpPass.length - 4))}${smtpPass.slice(-4)}`
    : ''

  const isConfigured =
    provider === 'zsend'
      ? zsendConfigured
      : provider === 'tosend'
      ? tosendConfigured
      : provider === 'smtp'
      ? smtpIsConfigured
      : resendConfigured

  return {
    resendApiKeyHint: resendApiKey ? maskSecret(resendApiKey) : '',
    tosendApiKeyHint: tosendApiKey ? maskSecret(tosendApiKey) : '',
    zsendApiKeyHint: zsendApiKey ? maskSecret(zsendApiKey) : '',
    zsendDomain,
    senderName: map.get(SETTING_KEYS.EMAIL_SENDER_NAME) || 'WooMin',
    fromEmail,
    isConfigured,
    emailProvider: provider,
    resendConfigured,
    tosendConfigured,
    zsendConfigured,
    smtp: {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      passHint,
      secure: smtpSecure,
      isConfigured: smtpIsConfigured,
    },
    newsletter: {
      senderName: map.get(SETTING_KEYS.NEWSLETTER_SENDER_NAME) || map.get(SETTING_KEYS.EMAIL_SENDER_NAME) || 'WooMin',
      replyTo: map.get(SETTING_KEYS.NEWSLETTER_REPLY_TO) || fromEmail,
      footerName: map.get(SETTING_KEYS.NEWSLETTER_FOOTER_NAME) || map.get(SETTING_KEYS.EMAIL_SENDER_NAME) || 'WooMin',
      footerAddress: map.get(SETTING_KEYS.NEWSLETTER_FOOTER_ADDRESS) || '',
      footerEmail: map.get(SETTING_KEYS.NEWSLETTER_FOOTER_EMAIL) || fromEmail,
      ratePerMinute: map.get(SETTING_KEYS.NEWSLETTER_RATE_PER_MINUTE) || '60',
      lastCronHeartbeatAt: map.get(SETTING_KEYS.NEWSLETTER_LAST_CRON_HEARTBEAT_AT) || '',
      domainStatus: map.get(SETTING_KEYS.NEWSLETTER_DOMAIN_STATUS) || 'unchecked',
    },
  }
}

/**
 * 測試 SMTP 連線
 */
export async function getSocialLoginSettings(): Promise<{
  googleEnabled: boolean
  googleClientId: string
  googleClientSecretHint: string
  googleConfigured: boolean
  appleEnabled: boolean
  appleClientId: string
  appleTeamId: string
  appleKeyId: string
  applePrivateKeyHint: string
  appleConfigured: boolean
}> {
  await requireOnlyAdminAuth()

  const keys = [
    SETTING_KEYS.GOOGLE_OAUTH_ENABLED,
    SETTING_KEYS.GOOGLE_CLIENT_ID,
    SETTING_KEYS.GOOGLE_CLIENT_SECRET,
    SETTING_KEYS.APPLE_OAUTH_ENABLED,
    SETTING_KEYS.APPLE_CLIENT_ID,
    SETTING_KEYS.APPLE_TEAM_ID,
    SETTING_KEYS.APPLE_KEY_ID,
    SETTING_KEYS.APPLE_PRIVATE_KEY,
  ]

  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  })

  const map = new Map(settings.map((setting) => [setting.key, setting.value]))

  const googleClientId = map.get(SETTING_KEYS.GOOGLE_CLIENT_ID) || process.env.AUTH_GOOGLE_ID || ''
  const googleClientSecret = map.get(SETTING_KEYS.GOOGLE_CLIENT_SECRET) || process.env.AUTH_GOOGLE_SECRET || ''
  const appleClientId = map.get(SETTING_KEYS.APPLE_CLIENT_ID) || process.env.AUTH_APPLE_ID || ''
  const appleTeamId = map.get(SETTING_KEYS.APPLE_TEAM_ID) || process.env.AUTH_APPLE_TEAM_ID || ''
  const appleKeyId = map.get(SETTING_KEYS.APPLE_KEY_ID) || process.env.AUTH_APPLE_KEY_ID || ''
  const applePrivateKey = map.get(SETTING_KEYS.APPLE_PRIVATE_KEY) || process.env.AUTH_APPLE_PRIVATE_KEY || ''

  return {
    googleEnabled: map.get(SETTING_KEYS.GOOGLE_OAUTH_ENABLED) === 'true',
    googleClientId,
    googleClientSecretHint: googleClientSecret ? maskSecret(googleClientSecret) : '',
    googleConfigured: !!(googleClientId && googleClientSecret),
    appleEnabled: map.get(SETTING_KEYS.APPLE_OAUTH_ENABLED) === 'true',
    appleClientId,
    appleTeamId,
    appleKeyId,
    applePrivateKeyHint: applePrivateKey ? maskSecret(applePrivateKey) : '',
    appleConfigured: !!(appleClientId && appleTeamId && appleKeyId && applePrivateKey),
  }
}

export async function testSmtpSettings(formValues?: {
  smtpHost?: string
  smtpPort?: string
  smtpUser?: string
  smtpPass?: string
  smtpSecure?: boolean
}): Promise<{ success: boolean; message: string }> {
  try {
    await requireOnlyAdminAuth()

    const { testSmtpConnection } = await import('@/lib/email-transport')

    // 從 DB 讀取現有設定，再用表單值覆蓋
    const keys = [
      SETTING_KEYS.SMTP_HOST,
      SETTING_KEYS.SMTP_PORT,
      SETTING_KEYS.SMTP_USER,
      SETTING_KEYS.SMTP_PASS,
      SETTING_KEYS.SMTP_SECURE,
    ]
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
    })
    const map = new Map(settings.map((s) => [s.key, s.value]))

    const host = formValues?.smtpHost || map.get(SETTING_KEYS.SMTP_HOST) || process.env.SMTP_HOST || ''
    const port = formValues?.smtpPort || map.get(SETTING_KEYS.SMTP_PORT) || process.env.SMTP_PORT || '587'
    // 密碼：如果表單值包含遮蔽字元，使用 DB/env 值
    const passFromForm = formValues?.smtpPass && !formValues.smtpPass.includes('•')
      ? formValues.smtpPass
      : null
    const pass = passFromForm || map.get(SETTING_KEYS.SMTP_PASS) || process.env.SMTP_PASS || ''
    const user = formValues?.smtpUser || map.get(SETTING_KEYS.SMTP_USER) || process.env.SMTP_USER || ''
    const secure = formValues?.smtpSecure ?? (map.get(SETTING_KEYS.SMTP_SECURE) === 'true')

    if (!host) {
      return { success: false, message: '請先填入 SMTP Host' }
    }

    return await testSmtpConnection({
      host,
      port: parseInt(port, 10),
      user,
      pass,
      secure,
    })
  } catch (error) {
    console.error('測試 SMTP 連線失敗:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '測試連線時發生錯誤',
    }
  }
}

export async function getLegalSettings(): Promise<{
  privacyMd: string
  termsMd: string
}> {
  await requireOnlyAdminAuth()

  const [privacy, terms] = await Promise.all([
    prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.LEGAL_PRIVACY_MD },
    }),
    prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.LEGAL_TERMS_MD },
    }),
  ])

  return {
    privacyMd: privacy?.value || '',
    termsMd: terms?.value || '',
  }
}

export async function updateLegalPrivacy(
  markdown: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()
    const parsed = legalMarkdownSchema.safeParse(markdown)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || '輸入驗證失敗' }
    }
    await upsertSetting(SETTING_KEYS.LEGAL_PRIVACY_MD, parsed.data)

    await logAdminAction(user.id as string, {
      action: 'update_legal_privacy',
    })

    revalidatePath('/admin/settings/privacy')
    revalidatePath('/privacy')

    return { success: true }
  } catch (error) {
    console.error('更新隱私權政策失敗:', error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '更新隱私權政策時發生錯誤' }
  }
}

export async function updateLegalTerms(
  markdown: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()
    const parsed = legalMarkdownSchema.safeParse(markdown)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || '輸入驗證失敗' }
    }
    await upsertSetting(SETTING_KEYS.LEGAL_TERMS_MD, parsed.data)

    await logAdminAction(user.id as string, {
      action: 'update_legal_terms',
    })

    revalidatePath('/admin/settings/terms')
    revalidatePath('/terms')

    return { success: true }
  } catch (error) {
    console.error('更新服務條款失敗:', error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '更新服務條款時發生錯誤' }
  }
}

/**
 * 取得 Header / Footer 版面設定
 */
export async function getLayoutSettings(): Promise<{
  headerLeftLinks: string
  headerRightLinks: string
  footerDescription: string
  footerSections: string
}> {
  await requireOnlyAdminAuth()

  const keys = [
    SETTING_KEYS.HEADER_LEFT_LINKS,
    SETTING_KEYS.HEADER_RIGHT_LINKS,
    SETTING_KEYS.FOOTER_DESCRIPTION,
    SETTING_KEYS.FOOTER_SECTIONS,
  ]

  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  })

  const map = new Map(settings.map((s) => [s.key, s.value]))

  return {
    headerLeftLinks: map.get(SETTING_KEYS.HEADER_LEFT_LINKS) || '[]',
    headerRightLinks: map.get(SETTING_KEYS.HEADER_RIGHT_LINKS) || '[]',
    footerDescription: map.get(SETTING_KEYS.FOOTER_DESCRIPTION) || '',
    footerSections: map.get(SETTING_KEYS.FOOTER_SECTIONS) || '[]',
  }
}

/**
 * 更新 Header / Footer 版面設定
 */
export async function updateLayoutSettings(
  data: LayoutSettingsFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()

    const validatedData = layoutSettingsSchema.parse(data)

    await Promise.all([
      upsertSetting(
        SETTING_KEYS.HEADER_LEFT_LINKS,
        JSON.stringify(validatedData.headerLeftLinks)
      ),
      upsertSetting(
        SETTING_KEYS.HEADER_RIGHT_LINKS,
        JSON.stringify(validatedData.headerRightLinks)
      ),
      upsertSetting(
        SETTING_KEYS.FOOTER_DESCRIPTION,
        validatedData.footerDescription || ''
      ),
      upsertSetting(
        SETTING_KEYS.FOOTER_SECTIONS,
        JSON.stringify(validatedData.footerSections)
      ),
    ])

    await logAdminAction(user.id as string, {
      action: 'update_layout_settings',
    })

    revalidatePath('/admin/settings/layout')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('更新版面設定失敗:', error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '更新版面設定時發生錯誤' }
  }
}

export async function getSettingsCompleteness(): Promise<{
  score: number
  total: number
  completed: number
  missing: Array<{ key: string; label: string; suggestion: string }>
}> {
  await requireOnlyAdminAuth()

  const settings = await prisma.siteSetting.findMany()
  const map = new Map(settings.map((s) => [s.key, s.value]))

  const checks = [
    {
      key: SETTING_KEYS.SITE_NAME,
      label: '站點名稱',
      suggestion: '請在基本設定填寫站點名稱',
    },
    {
      key: SETTING_KEYS.SITE_LOGO,
      label: '站點 Logo（也作為 Icon）',
      suggestion: '請上傳/填入 Logo URL，會同步成 favicon',
    },
    {
      key: SETTING_KEYS.CONTACT_EMAIL,
      label: '聯絡 Email',
      suggestion: '請填入客服聯絡 Email',
    },
    {
      key: SETTING_KEYS.EMAIL_SENDER_NAME,
      label: 'Email 發送者名稱',
      suggestion: '請在 Email 設定填入 sender name',
    },
    {
      key: SETTING_KEYS.LEGAL_PRIVACY_MD,
      label: '隱私權政策自訂內容',
      suggestion: '建議填入隱私權政策（可選）',
      optional: true,
    },
    {
      key: SETTING_KEYS.LEGAL_TERMS_MD,
      label: '服務條款自訂內容',
      suggestion: '建議填入服務條款（可選）',
      optional: true,
    },
  ]

  const requiredChecks = checks.filter((c) => !('optional' in c && c.optional))
  const missing = requiredChecks
    .filter((c) => !(map.get(c.key) || '').trim())
    .map((c) => ({ key: c.key, label: c.label, suggestion: c.suggestion }))

  const completed = requiredChecks.length - missing.length
  const total = requiredChecks.length
  const score = Math.round((completed / total) * 100)

  return { score, total, completed, missing }
}

/**
 * 取得 AI 模型設定
 */
export async function getAISettings(): Promise<{
  geminiApiKey: string
  geminiApiKeyHint: string
  geminiModel: string
  isConfigured: boolean
}> {
  await requireOnlyAdminAuth()

  const keys = [SETTING_KEYS.GEMINI_API_KEY, SETTING_KEYS.GEMINI_MODEL]
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  })
  const map = new Map(settings.map((s) => [s.key, s.value]))

  const apiKey = map.get(SETTING_KEYS.GEMINI_API_KEY) || ''
  const model = map.get(SETTING_KEYS.GEMINI_MODEL) || 'gemini-2.5-flash'

  return {
    geminiApiKey: apiKey ? maskSecret(apiKey) : '',
    geminiApiKeyHint: apiKey ? maskSecret(apiKey) : '',
    geminiModel: model,
    isConfigured: !!apiKey,
  }
}

/**
 * 更新 AI 模型設定
 */
export async function updateAISettings(
  data: AISettingsFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()

    const validatedData = aiSettingsSchema.parse(data)

    await Promise.all([
      // API Key：只有實際輸入新值才更新（遮蔽值含 '...' 不存回）
      ...(validatedData.geminiApiKey && !validatedData.geminiApiKey.includes('...')
        ? [upsertSetting(SETTING_KEYS.GEMINI_API_KEY, validatedData.geminiApiKey)]
        : []),
      upsertSetting(SETTING_KEYS.GEMINI_MODEL, validatedData.geminiModel),
    ])

    await logAdminAction(user.id as string, {
      action: 'update_ai_settings',
      settings: {
        geminiApiKey: '[REDACTED]',
        geminiModel: validatedData.geminiModel,
      },
    })

    revalidatePath('/admin/settings')

    return { success: true }
  } catch (error) {
    console.error('更新 AI 設定失敗:', error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '更新 AI 設定時發生錯誤' }
  }
}

// M16：原 getGeminiApiKeyRaw() 已移除 —
// 它是一個無人呼叫（dead code）卻會回傳「未遮蔽明文 Gemini API Key」的 server action，
// 任何具講師權限者皆可直接呼叫竊取金鑰。AI 功能一律改用 getAISettings()（伺服器端內部使用）。
