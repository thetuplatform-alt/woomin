import { z } from 'zod'
import { mediaUrlSchema } from '@/lib/validations/media-url'
import { SHOPLINE_PAYMENT_METHOD_CODES } from '@/lib/payment/shopline-methods'

export const SETTING_KEYS = {
  SITE_NAME: 'site_name',
  SITE_LOGO: 'site_logo',
  SHARE_TITLE: 'share_title',
  SHARE_DESCRIPTION: 'share_description',
  SHARE_LOGO: 'share_logo',
  SHARE_IMAGE: 'share_image',
  SITE_URL: 'site_url',
  CONTACT_EMAIL: 'contact_email',
  BRAND_DISPLAY_NAME: 'brand_display_name',
  BRAND_SUBTITLE: 'brand_subtitle',
  GA_ID: 'ga_id',
  POSTHOG_KEY: 'posthog_key',
  POSTHOG_HOST: 'posthog_host',
  POSTHOG_PERSONAL_API_KEY: 'posthog_personal_api_key',
  META_PIXEL_ID: 'meta_pixel_id',
  META_CAPI_ACCESS_TOKEN: 'meta_capi_access_token',
  EMAIL_SENDER_NAME: 'email_sender_name',
  EMAIL_FROM: 'email_from',
  EMAIL_PROVIDER: 'email_provider',
  RESEND_API_KEY: 'resend_api_key',
  TOSEND_API_KEY: 'tosend_api_key',
  ZSEND_API_KEY: 'zsend_api_key',
  ZSEND_DOMAIN: 'zsend_domain',
  SMTP_HOST: 'smtp_host',
  SMTP_PORT: 'smtp_port',
  SMTP_USER: 'smtp_user',
  SMTP_PASS: 'smtp_pass',
  SMTP_SECURE: 'smtp_secure',
  NEWSLETTER_SENDER_NAME: 'newsletter_sender_name',
  NEWSLETTER_REPLY_TO: 'newsletter_reply_to',
  NEWSLETTER_FOOTER_NAME: 'newsletter_footer_name',
  NEWSLETTER_FOOTER_ADDRESS: 'newsletter_footer_address',
  NEWSLETTER_FOOTER_EMAIL: 'newsletter_footer_email',
  NEWSLETTER_RATE_PER_MINUTE: 'newsletter_rate_per_minute',
  NEWSLETTER_LAST_CRON_HEARTBEAT_AT: 'newsletter_last_cron_heartbeat_at',
  NEWSLETTER_DOMAIN_STATUS: 'newsletter_domain_status',
  LEGAL_PRIVACY_MD: 'legal_privacy_md',
  LEGAL_TERMS_MD: 'legal_terms_md',
  PAYMENT_GATEWAY: 'payment_gateway',
  SHOPLINE_MERCHANT_ID: 'shopline_merchant_id',
  SHOPLINE_API_KEY: 'shopline_api_key',
  SHOPLINE_CLIENT_KEY: 'shopline_client_key',
  SHOPLINE_SIGN_KEY: 'shopline_sign_key',
  SHOPLINE_TEST_MODE: 'shopline_test_mode',
  SHOPLINE_PAYMENT_METHODS: 'shopline_payment_methods',
  STRIPE_SECRET_KEY: 'stripe_secret_key',
  STRIPE_WEBHOOK_SECRET: 'stripe_webhook_secret',
  PAYUNI_MERCHANT_ID: 'payuni_merchant_id',
  PAYUNI_HASH_KEY: 'payuni_hash_key',
  PAYUNI_HASH_IV: 'payuni_hash_iv',
  PAYUNI_TEST_MODE: 'payuni_test_mode',
  // 臺灣電子發票（統一發票）— 加值中心串接
  EINVOICE_ENABLED: 'einvoice_enabled',
  EINVOICE_PROVIDER: 'einvoice_provider',
  EINVOICE_MERCHANT_ID: 'einvoice_merchant_id',
  EINVOICE_HASH_KEY: 'einvoice_hash_key',
  EINVOICE_HASH_IV: 'einvoice_hash_iv',
  EINVOICE_TEST_MODE: 'einvoice_test_mode',
  EINVOICE_AUTO_ISSUE: 'einvoice_auto_issue',
  EINVOICE_SELLER_NAME: 'einvoice_seller_name',
  EINVOICE_SELLER_TAX_ID: 'einvoice_seller_tax_id',
  VIDEO_PROVIDER: 'video_provider',
  CLOUDFLARE_ACCOUNT_ID: 'cloudflare_account_id',
  CLOUDFLARE_API_TOKEN: 'cloudflare_api_token',
  CLOUDFLARE_STREAM_CUSTOMER_CODE: 'cloudflare_stream_customer_code',
  CLOUDFLARE_STREAM_SIGNING_SECRET: 'cloudflare_stream_signing_secret',
  CLOUDFLARE_STREAM_WEBHOOK_SECRET: 'cloudflare_stream_webhook_secret',
  BUNNY_LIBRARY_ID: 'bunny_library_id',
  BUNNY_LIBRARY_API_KEY: 'bunny_library_api_key',
  BUNNY_READ_ONLY_API_KEY: 'bunny_read_only_api_key',
  STORAGE_DRIVER: 'storage_driver',
  LOCAL_STORAGE_ROOT: 'local_storage_root',
  LOCAL_STORAGE_PUBLIC_BASE: 'local_storage_public_base',
  GOOGLE_OAUTH_ENABLED: 'google_oauth_enabled',
  GOOGLE_CLIENT_ID: 'google_client_id',
  GOOGLE_CLIENT_SECRET: 'google_client_secret',
  APPLE_OAUTH_ENABLED: 'apple_oauth_enabled',
  APPLE_CLIENT_ID: 'apple_client_id',
  APPLE_TEAM_ID: 'apple_team_id',
  APPLE_KEY_ID: 'apple_key_id',
  APPLE_PRIVATE_KEY: 'apple_private_key',
  HEADER_LEFT_LINKS: 'header_left_links',
  HEADER_RIGHT_LINKS: 'header_right_links',
  FOOTER_DESCRIPTION: 'footer_description',
  FOOTER_SECTIONS: 'footer_sections',
  GEMINI_API_KEY: 'gemini_api_key',
  GEMINI_MODEL: 'gemini_model',
  ASSIGNMENT_STORAGE_QUOTA_GB: 'assignment_storage_quota_gb',
  ASSIGNMENT_USER_COURSE_QUOTA_MB: 'assignment_user_course_quota_mb',
  // 課程訂閱制 — maintenance tick 心跳（後台據此顯示「排程未運作」告警）
  SUBSCRIPTION_LAST_CRON_HEARTBEAT_AT: 'subscription_last_cron_heartbeat_at',
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

const INTERNAL_SITE_URL_HOSTS = new Set(['0.0.0.0', '::', '[::]', 'localhost', '127.0.0.1', '::1', '[::1]'])

function isPublicSiteUrl(value: string) {
  try {
    const url = new URL(value)
    if (INTERNAL_SITE_URL_HOSTS.has(url.hostname.toLowerCase())) return false
    if (url.port === '8080') return false
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:')
  } catch {
    return false
  }
}

export const siteSettingsSchema = z.object({
  siteName: z
    .string()
    .min(1, '請輸入站點名稱')
    .max(100, '站點名稱不可超過 100 個字'),
  siteLogo: z
    .string()
    .pipe(mediaUrlSchema('請輸入有效的 Logo URL'))
    .optional()
    .nullable()
    .or(z.literal('')),
  shareTitle: z
    .string()
    .max(120, '分享標題不可超過 120 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
  shareDescription: z
    .string()
    .max(300, '分享描述不可超過 300 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
  shareLogo: z
    .string()
    .pipe(mediaUrlSchema('請輸入有效的分享 Logo URL'))
    .optional()
    .nullable()
    .or(z.literal('')),
  shareImage: z
    .string()
    .pipe(mediaUrlSchema('請輸入有效的預設分享圖 URL'))
    .optional()
    .nullable()
    .or(z.literal('')),
  siteUrl: z
    .string()
    .url('請輸入有效的站點網址')
    .refine(isPublicSiteUrl, '請輸入正式公開網址，不能使用 0.0.0.0、localhost、127.0.0.1 或容器內部連接埠')
    .optional()
    .nullable()
    .or(z.literal('')),
  contactEmail: z
    .string()
    .email('請輸入有效的聯絡 Email')
    .optional()
    .nullable()
    .or(z.literal('')),
  brandDisplayName: z
    .string()
    .max(100, '品牌顯示名稱不可超過 100 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
  brandSubtitle: z
    .string()
    .max(100, '品牌副標題不可超過 100 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
  gaId: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, 'GA4 測量 ID 格式需為 G- 開頭的英數字')
    .max(20)
    .optional()
    .nullable()
    .or(z.literal('')),
  posthogKey: z
    .string()
    .max(200, 'PostHog Project API Key 不可超過 200 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
  posthogHost: z
    .string()
    .max(200, 'PostHog Host 不可超過 200 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
  posthogPersonalApiKey: z
    .string()
    .max(200, 'PostHog Personal API Key 不可超過 200 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
  metaPixelId: z
    .string()
    .regex(/^\d{6,20}$/, 'Meta Pixel ID 須為純數字')
    .optional()
    .nullable()
    .or(z.literal('')),
  metaCapiAccessToken: z
    .string()
    .max(500, 'Meta CAPI Access Token 不可超過 500 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
  videoProvider: z.enum(['youtube', 'cloudflare', 'bunny']).default('youtube'),
  confirmVideoProviderSwitch: z.boolean().optional(),
  storageDriver: z.enum(['local', 's3']).default('local'),
  localStorageRoot: z
    .string()
    .max(500, '本地儲存路徑不可超過 500 個字')
    .optional()
    .nullable()
    .or(z.literal('')),
})

export type SiteSettingsFormData = z.infer<typeof siteSettingsSchema>

export const cloudflareStreamSettingsSchema = z.object({
  accountId: z.string().max(100, 'Account ID 不可超過 100 個字').optional().or(z.literal('')),
  apiToken: z.string().max(1000, 'API Token 不可超過 1000 個字').optional().or(z.literal('')),
  apiTokenTouched: z.boolean().optional(),
  customerCode: z
    .string()
    .max(255, 'Customer Code 不可超過 255 個字')
    .optional()
    .or(z.literal('')),
  signingSecret: z
    .string()
    .max(1000, 'Signing Secret 不可超過 1000 個字')
    .optional()
    .or(z.literal('')),
  signingSecretTouched: z.boolean().optional(),
  webhookSecret: z
    .string()
    .max(1000, 'Webhook Secret 不可超過 1000 個字')
    .optional()
    .or(z.literal('')),
  webhookSecretTouched: z.boolean().optional(),
})

export type CloudflareStreamSettingsFormData = z.infer<
  typeof cloudflareStreamSettingsSchema
>

export const bunnyStreamSettingsSchema = z.object({
  libraryId: z.string().max(100, 'Library ID 不可超過 100 個字').optional().or(z.literal('')),
  apiKey: z.string().max(1000, 'Library API Key 不可超過 1000 個字').optional().or(z.literal('')),
  apiKeyTouched: z.boolean().optional(),
  readOnlyApiKey: z.string().max(1000, 'Read-Only API Key 不可超過 1000 個字').optional().or(z.literal('')),
  readOnlyApiKeyTouched: z.boolean().optional(),
})

export type BunnyStreamSettingsFormData = z.infer<typeof bunnyStreamSettingsSchema>

export const emailSettingsSchema = z.object({
  emailProvider: z.enum(['resend', 'smtp', 'zsend', 'tosend']).optional(),
  resendApiKey: z
    .string()
    .max(1000, 'Resend API Key 不可超過 1000 個字')
    .optional()
    .or(z.literal('')),
  tosendApiKey: z
    .string()
    .max(1000, 'ToSend API Key 不可超過 1000 個字')
    .optional()
    .or(z.literal('')),
  zsendApiKey: z
    .string()
    .max(1000, 'Zeabur Email API Key 不可超過 1000 個字')
    .optional()
    .or(z.literal('')),
  zsendDomain: z
    .string()
    .max(255, 'Zeabur Email 網域不可超過 255 個字')
    .optional()
    .or(z.literal('')),
  emailSenderName: z
    .string()
    .min(1, '請輸入寄件人名稱')
    .max(100, '寄件人名稱不可超過 100 個字'),
  emailFrom: z.string().email('請輸入有效的寄件 Email').optional().or(z.literal('')),
  smtpHost: z.string().max(255, 'SMTP Host 不可超過 255 個字').optional().or(z.literal('')),
  smtpPort: z.string().max(5, 'SMTP Port 不可超過 5 個字').optional().or(z.literal('')),
  smtpUser: z.string().max(255, 'SMTP Username 不可超過 255 個字').optional().or(z.literal('')),
  smtpPass: z.string().max(500, 'SMTP Password 不可超過 500 個字').optional().or(z.literal('')),
  smtpSecure: z.boolean().optional(),
  newsletterSenderName: z
    .string()
    .max(100, '電子報寄件人名稱不可超過 100 個字')
    .optional()
    .or(z.literal('')),
  newsletterReplyTo: z
    .string()
    .email('請輸入有效的電子報回信 Email')
    .optional()
    .or(z.literal('')),
  newsletterFooterName: z
    .string()
    .max(120, '寄件人名稱不可超過 120 個字')
    .optional()
    .or(z.literal('')),
  newsletterFooterAddress: z
    .string()
    .max(500, '實體地址不可超過 500 個字')
    .optional()
    .or(z.literal('')),
  newsletterFooterEmail: z
    .string()
    .email('請輸入有效的聯絡 Email')
    .optional()
    .or(z.literal('')),
  newsletterRatePerMinute: z
    .string()
    .regex(/^\d*$/, '每分鐘封數必須是數字')
    .refine((value) => value === '' || (Number(value) >= 1 && Number(value) <= 1200), '每分鐘發送上限需介於 1 到 1200 封')
    .optional()
    .or(z.literal('')),
})

export type EmailSettingsFormData = z.infer<typeof emailSettingsSchema>

export const socialLoginSettingsSchema = z
  .object({
    googleEnabled: z.boolean().default(false),
    googleClientId: z.string().max(500, 'Google Client ID 不可超過 500 個字').optional().or(z.literal('')),
    googleClientSecret: z
      .string()
      .max(2000, 'Google Client Secret 不可超過 2000 個字')
      .optional()
      .or(z.literal('')),
    appleEnabled: z.boolean().default(false),
    appleClientId: z.string().max(500, 'Apple Client ID 不可超過 500 個字').optional().or(z.literal('')),
    appleTeamId: z.string().max(500, 'Apple Team ID 不可超過 500 個字').optional().or(z.literal('')),
    appleKeyId: z.string().max(500, 'Apple Key ID 不可超過 500 個字').optional().or(z.literal('')),
    applePrivateKey: z
      .string()
      .max(10000, 'Apple Private Key 不可超過 10000 個字')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.googleEnabled) {
      if (!data.googleClientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['googleClientId'],
          message: '啟用 Google 登入時必須填寫 Client ID',
        })
      }
      if (!data.googleClientSecret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['googleClientSecret'],
          message: '啟用 Google 登入時必須填寫 Client Secret',
        })
      }
    }

    if (data.appleEnabled) {
      if (!data.appleClientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['appleClientId'],
          message: '啟用 Apple 登入時必須填寫 Client ID',
        })
      }
      if (!data.appleTeamId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['appleTeamId'],
          message: '啟用 Apple 登入時必須填寫 Team ID',
        })
      }
      if (!data.appleKeyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['appleKeyId'],
          message: '啟用 Apple 登入時必須填寫 Key ID',
        })
      }
      if (!data.applePrivateKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applePrivateKey'],
          message: '啟用 Apple 登入時必須填寫 Private Key',
        })
      }
    }
  })

export type SocialLoginSettingsFormData = z.infer<typeof socialLoginSettingsSchema>

export const testEmailSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
})

export type TestEmailFormData = z.infer<typeof testEmailSchema>

export const paymentSettingsSchema = z
  .object({
    gateway: z.enum(['shopline', 'stripe', 'payuni']),
    shoplineMerchantId: z.string().optional().or(z.literal('')),
    shoplineApiKey: z.string().optional().or(z.literal('')),
    shoplineClientKey: z.string().optional().or(z.literal('')),
    shoplineSignKey: z.string().optional().or(z.literal('')),
    shoplineTestMode: z.boolean().default(true),
    shoplineEnabledMethods: z
      .array(z.enum(SHOPLINE_PAYMENT_METHOD_CODES))
      .min(1, '請至少選擇一種 SHOPLINE 付款方式')
      .optional(),
    stripeSecretKey: z.string().optional().or(z.literal('')),
    stripeWebhookSecret: z.string().optional().or(z.literal('')),
    payuniMerchantId: z.string().optional().or(z.literal('')),
    payuniHashKey: z.string().optional().or(z.literal('')),
    payuniHashIV: z.string().optional().or(z.literal('')),
    payuniTestMode: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.gateway === 'shopline') {
        return (
          !!data.shoplineMerchantId &&
          !!data.shoplineApiKey
        )
      }
      if (data.gateway === 'stripe') {
        return !!data.stripeSecretKey && !!data.stripeWebhookSecret
      }
      if (data.gateway === 'payuni') {
        return !!data.payuniMerchantId && !!data.payuniHashKey && !!data.payuniHashIV
      }
      return false
    },
    {
      message: '請填寫所選金流方案的必要設定',
    }
  )
  .refine(
    (data) => {
      if (data.gateway === 'payuni' && data.payuniHashKey) {
        return data.payuniHashKey.length === 32
      }
      return true
    },
    {
      message: 'PAYUNi Hash Key 必須為 32 個字',
      path: ['payuniHashKey'],
    }
  )
  .refine(
    (data) => {
      if (data.gateway === 'payuni' && data.payuniHashIV) {
        return data.payuniHashIV.length === 16
      }
      return true
    },
    {
      message: 'PAYUNi Hash IV 必須為 16 個字',
      path: ['payuniHashIV'],
    }
  )

export type PaymentSettingsFormData = z.infer<typeof paymentSettingsSchema>

export const legalMarkdownSchema = z
  .string()
  .max(200000, '內容不可超過 200,000 個字')

export type LegalMarkdownInput = z.infer<typeof legalMarkdownSchema>

export const navLinkSchema = z.object({
  label: z.string().min(1, '請輸入標籤').max(50, '標籤不可超過 50 個字'),
  url: z.string().min(1, '請輸入 URL').max(500, 'URL 不可超過 500 個字'),
  openInNewTab: z.boolean().default(false),
})

export type NavLink = z.infer<typeof navLinkSchema>

export const footerLinkSchema = z.object({
  label: z.string().min(1, '請輸入標籤').max(50, '標籤不可超過 50 個字'),
  url: z.string().min(1, '請輸入 URL').max(500, 'URL 不可超過 500 個字'),
  icon: z.string().max(50, '圖示名稱不可超過 50 個字').optional().or(z.literal('')),
})

export type FooterLink = z.infer<typeof footerLinkSchema>

export const footerSectionSchema = z.object({
  title: z.string().min(1, '請輸入區塊標題').max(50, '區塊標題不可超過 50 個字'),
  links: z.array(footerLinkSchema).max(10, '單一區塊最多 10 個連結'),
})

export type FooterSection = z.infer<typeof footerSectionSchema>

export const layoutSettingsSchema = z.object({
  headerLeftLinks: z.array(navLinkSchema).max(10, 'Header 左側最多 10 個連結').default([]),
  headerRightLinks: z.array(navLinkSchema).max(10, 'Header 右側最多 10 個連結').default([]),
  footerDescription: z.string().max(500, 'Footer 描述不可超過 500 個字').optional().or(z.literal('')),
  footerSections: z.array(footerSectionSchema).max(5, 'Footer 最多 5 個區塊').default([]),
})

export type LayoutSettingsFormData = z.infer<typeof layoutSettingsSchema>

export const aiSettingsSchema = z.object({
  geminiApiKey: z
    .string()
    .min(1, '請輸入 Gemini API Key')
    .max(500, 'Gemini API Key 不可超過 500 個字'),
  geminiModel: z
    .string()
    .min(1, '請輸入 Gemini 模型名稱')
    .default('gemini-2.5-flash'),
})

export type AISettingsFormData = z.infer<typeof aiSettingsSchema>
