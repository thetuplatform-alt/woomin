import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'

export interface CloudflareStreamConfig {
  accountId: string
  apiToken: string
  customerCode: string
  signingSecret: string
  webhookSecret: string
}

const CACHE_TTL_MS = 5 * 60 * 1000

let cachedConfig: CloudflareStreamConfig | null = null
let cachedAt = 0

function emptyConfig(): CloudflareStreamConfig {
  return {
    accountId: '',
    apiToken: '',
    customerCode: '',
    signingSecret: '',
    webhookSecret: '',
  }
}

export async function getCloudflareStreamConfig(options?: {
  forceRefresh?: boolean
}): Promise<CloudflareStreamConfig> {
  if (!options?.forceRefresh && cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedConfig
  }

  const settings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: [
          SETTING_KEYS.CLOUDFLARE_ACCOUNT_ID,
          SETTING_KEYS.CLOUDFLARE_API_TOKEN,
          SETTING_KEYS.CLOUDFLARE_STREAM_CUSTOMER_CODE,
          SETTING_KEYS.CLOUDFLARE_STREAM_SIGNING_SECRET,
          SETTING_KEYS.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
        ],
      },
    },
  })

  const map = new Map(settings.map((setting) => [setting.key, setting.value]))
  cachedConfig = {
    accountId: map.get(SETTING_KEYS.CLOUDFLARE_ACCOUNT_ID) || '',
    apiToken: map.get(SETTING_KEYS.CLOUDFLARE_API_TOKEN) || '',
    customerCode: map.get(SETTING_KEYS.CLOUDFLARE_STREAM_CUSTOMER_CODE) || '',
    signingSecret: map.get(SETTING_KEYS.CLOUDFLARE_STREAM_SIGNING_SECRET) || '',
    webhookSecret: map.get(SETTING_KEYS.CLOUDFLARE_STREAM_WEBHOOK_SECRET) || '',
  }
  cachedAt = Date.now()

  return cachedConfig
}

export async function getCloudflareStreamConfigStatus() {
  const config = await getCloudflareStreamConfig()

  return {
    ...config,
    hasUploadConfig: Boolean(config.accountId && config.apiToken),
    hasPlaybackConfig: Boolean(config.customerCode),
    hasSigningConfig: Boolean(config.signingSecret),
    hasWebhookConfig: Boolean(config.webhookSecret),
    isConfigured: Boolean(config.accountId && config.apiToken && config.customerCode),
  }
}

export function clearCloudflareStreamConfigCache() {
  cachedConfig = null
  cachedAt = 0
}

export function getEmptyCloudflareStreamConfig(): CloudflareStreamConfig {
  return emptyConfig()
}
