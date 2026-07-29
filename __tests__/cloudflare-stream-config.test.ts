import { readFileSync } from 'node:fs'
import { join } from 'node:path'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  clearCloudflareStreamConfigCache,
  getCloudflareStreamConfig,
  getCloudflareStreamConfigStatus,
} from '@/lib/cloudflare-stream-config'

describe('Cloudflare Stream runtime env fallback', () => {
  const envKeys = [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_STREAM_CUSTOMER_CODE',
    'CLOUDFLARE_STREAM_SIGNING_SECRET',
    'CLOUDFLARE_STREAM_WEBHOOK_SECRET',
  ] as const

  afterEach(() => {
    clearCloudflareStreamConfigCache()
    for (const key of envKeys) delete process.env[key]
    jest.clearAllMocks()
  })

  test('只設定環境變數時仍能產生完整設定', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account'
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = 'customer'
    process.env.CLOUDFLARE_STREAM_SIGNING_SECRET = 'signing'
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = 'webhook'

    await expect(getCloudflareStreamConfig()).resolves.toEqual({
      accountId: 'account',
      apiToken: 'token',
      customerCode: 'customer',
      signingSecret: 'signing',
      webhookSecret: 'webhook',
    })
    expect(prisma.siteSetting.findMany).toHaveBeenCalled()
  })

  test('狀態結果只公開布林值，不回傳任何密鑰', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account'
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = 'customer'
    process.env.CLOUDFLARE_STREAM_SIGNING_SECRET = 'signing'
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = 'webhook'

    const status = await getCloudflareStreamConfigStatus()

    expect(status).toEqual({
      hasUploadConfig: true,
      hasPlaybackConfig: true,
      hasSigningConfig: true,
      hasWebhookConfig: true,
      isConfigured: true,
    })
    expect(JSON.stringify(status)).not.toContain('token')
    expect(JSON.stringify(status)).not.toContain('signing')
    expect(JSON.stringify(status)).not.toContain('webhook')
  })

  test('需要完整設定的伺服器頁面不誤用公開狀態結果', () => {
    const mediaPage = readFileSync(join(process.cwd(), 'app/(admin)/admin/media/page.tsx'), 'utf8')
    const videosPage = readFileSync(join(process.cwd(), 'app/(admin)/admin/media/videos/page.tsx'), 'utf8')
    const settingsAction = readFileSync(join(process.cwd(), 'lib/actions/settings.ts'), 'utf8')

    expect(mediaPage).toContain('await getCloudflareStreamConfig()')
    expect(videosPage).toContain('await getCloudflareStreamConfig()')
    expect(settingsAction).toMatch(
      /getCloudflareStreamSettings[\s\S]*?const config = await getCloudflareStreamConfig\(\)/
    )
  })
})
