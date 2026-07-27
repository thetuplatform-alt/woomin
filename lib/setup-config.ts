import { z } from 'zod'

export const setupFormSchema = z
  .object({
    videoProvider: z.enum(['youtube', 'cloudflare', 'bunny']).default('youtube'),
    cloudflareAccountId: z.string().max(100).optional().or(z.literal('')),
    cloudflareApiToken: z.string().max(1000).optional().or(z.literal('')),
    cloudflareStreamCustomerCode: z.string().max(255).optional().or(z.literal('')),
    cloudflareStreamSigningSecret: z.string().max(1000).optional().or(z.literal('')),
    cloudflareStreamWebhookSecret: z.string().max(1000).optional().or(z.literal('')),
    storageDriver: z.enum(['local', 's3']).default('local'),
    localStorageRoot: z.string().max(500).optional().or(z.literal('')),
    contactEmail: z.string().email().optional().or(z.literal('')),

    emailMode: z.enum(['skip', 'smtp', 'auto']).default('skip'),
    emailSenderName: z.string().max(100).optional().or(z.literal('')),
    emailFrom: z.string().email().optional().or(z.literal('')),
    smtpHost: z.string().max(255).optional().or(z.literal('')),
    smtpPort: z.string().max(5).optional().or(z.literal('')),
    smtpUser: z.string().max(255).optional().or(z.literal('')),
    smtpPass: z.string().max(500).optional().or(z.literal('')),
    smtpSecure: z.boolean().optional(),

    googleMode: z.enum(['skip', 'enable']).default('skip'),
    googleClientId: z.string().max(255).optional().or(z.literal('')),
    googleClientSecret: z.string().max(500).optional().or(z.literal('')),

    appleMode: z.enum(['skip', 'enable']).default('skip'),
    appleClientId: z.string().max(255).optional().or(z.literal('')),
    appleTeamId: z.string().max(50).optional().or(z.literal('')),
    appleKeyId: z.string().max(50).optional().or(z.literal('')),
    applePrivateKey: z.string().max(10000).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.emailMode === 'smtp') {
      if (!data.emailSenderName) {
        ctx.addIssue({
          code: 'custom',
          path: ['emailSenderName'],
          message: '啟用 Email 功能時必須提供寄件者名稱',
        })
      }
      if (!data.emailFrom) {
        ctx.addIssue({
          code: 'custom',
          path: ['emailFrom'],
          message: '啟用 Email 功能時必須提供寄件 Email',
        })
      }
      if (!data.smtpHost) {
        ctx.addIssue({
          code: 'custom',
          path: ['smtpHost'],
          message: '啟用 Email 功能時必須提供 SMTP Host',
        })
      }
    }

    if (data.googleMode === 'enable') {
      if (!data.googleClientId || !data.googleClientSecret) {
        ctx.addIssue({
          code: 'custom',
          path: ['googleClientId'],
          message: '啟用 Google 登入時必須提供 Client ID 與 Client Secret',
        })
      }
    }

    if (data.appleMode === 'enable') {
      if (
        !data.appleClientId ||
        !data.appleTeamId ||
        !data.appleKeyId ||
        !data.applePrivateKey
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['appleClientId'],
          message: '啟用 Apple 登入時必須提供完整 Apple 憑證',
        })
      }
    }

    if (data.videoProvider === 'cloudflare') {
      if (
        !data.cloudflareAccountId ||
        !data.cloudflareApiToken ||
        !data.cloudflareStreamCustomerCode
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['cloudflareAccountId'],
          message:
            '選擇 Cloudflare Stream 作為預設影片方案時，至少要填入 Account ID、API Token 與 Customer Code',
        })
      }
    }
  })

export type SetupFormData = z.infer<typeof setupFormSchema>
