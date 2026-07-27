import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/crypto/settings-encryption'
import { SETTING_KEYS } from '@/lib/validations/settings'

export interface BunnyStreamConfig {
  libraryId: string
  apiKey: string
  readOnlyApiKey: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
let cachedConfig: BunnyStreamConfig | null = null
let cachedAt = 0

function emptyConfig(): BunnyStreamConfig {
  return { libraryId: '', apiKey: '', readOnlyApiKey: '' }
}

export async function getBunnyStreamConfig(options?: {
  forceRefresh?: boolean
}): Promise<BunnyStreamConfig> {
  if (!options?.forceRefresh && cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedConfig
  }

  const settings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: [
          SETTING_KEYS.BUNNY_LIBRARY_ID,
          SETTING_KEYS.BUNNY_LIBRARY_API_KEY,
          SETTING_KEYS.BUNNY_READ_ONLY_API_KEY,
        ],
      },
    },
  })
  const map = new Map(settings.map((setting) => [setting.key, setting.value]))
  const encryptedApiKey = map.get(SETTING_KEYS.BUNNY_LIBRARY_API_KEY) || ''
  const encryptedReadOnlyApiKey = map.get(SETTING_KEYS.BUNNY_READ_ONLY_API_KEY) || ''

  cachedConfig = {
    libraryId: map.get(SETTING_KEYS.BUNNY_LIBRARY_ID) || '',
    apiKey: encryptedApiKey ? decryptSecret(encryptedApiKey) : '',
    readOnlyApiKey: encryptedReadOnlyApiKey ? decryptSecret(encryptedReadOnlyApiKey) : '',
  }
  cachedAt = Date.now()
  return cachedConfig
}

export async function getBunnyStreamConfigStatus() {
  const config = await getBunnyStreamConfig()
  return {
    ...config,
    hasLibraryId: Boolean(config.libraryId),
    hasApiKey: Boolean(config.apiKey),
    isConfigured: Boolean(config.libraryId && config.apiKey),
  }
}

export function clearBunnyStreamConfigCache() {
  cachedConfig = null
  cachedAt = 0
}

export function getEmptyBunnyStreamConfig(): BunnyStreamConfig {
  return emptyConfig()
}
