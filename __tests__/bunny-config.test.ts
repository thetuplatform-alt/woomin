jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/crypto/settings-encryption', () => ({
  decryptSecret: jest.fn((value: string) => `decrypted:${value}`),
}))

import { prisma } from '@/lib/prisma'
import {
  clearBunnyStreamConfigCache,
  getBunnyStreamConfig,
  getBunnyStreamConfigStatus,
} from '@/lib/bunny-stream-config'
import { decryptSecret } from '@/lib/crypto/settings-encryption'
import { SETTING_KEYS } from '@/lib/validations/settings'

const findMany = prisma.siteSetting.findMany as jest.Mock

describe('Bunny Stream config', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    clearBunnyStreamConfigCache()
    findMany.mockReset()
    jest.mocked(decryptSecret).mockClear()
  })

  afterEach(() => jest.useRealTimers())

  it('reads and decrypts stored credentials including the Read-Only API Key', async () => {
    findMany.mockResolvedValue([
      { key: SETTING_KEYS.BUNNY_LIBRARY_ID, value: '416184' },
      { key: SETTING_KEYS.BUNNY_LIBRARY_API_KEY, value: 'encrypted-api' },
      { key: SETTING_KEYS.BUNNY_READ_ONLY_API_KEY, value: 'encrypted-read-only' },
    ])

    await expect(getBunnyStreamConfig()).resolves.toEqual({
      libraryId: '416184',
      apiKey: 'decrypted:encrypted-api',
      readOnlyApiKey: 'decrypted:encrypted-read-only',
    })
    expect(decryptSecret).toHaveBeenCalledTimes(2)
  })

  it('returns an empty readOnlyApiKey when it is not configured', async () => {
    findMany.mockResolvedValue([
      { key: SETTING_KEYS.BUNNY_LIBRARY_ID, value: '416184' },
      { key: SETTING_KEYS.BUNNY_LIBRARY_API_KEY, value: 'encrypted-api' },
    ])

    await expect(getBunnyStreamConfig()).resolves.toMatchObject({
      readOnlyApiKey: '',
    })
  })

  it('caches for five minutes and refreshes after the TTL', async () => {
    findMany.mockResolvedValue([{ key: SETTING_KEYS.BUNNY_LIBRARY_ID, value: 'one' }])
    await getBunnyStreamConfig()
    await getBunnyStreamConfig()
    expect(findMany).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(5 * 60 * 1000)
    findMany.mockResolvedValue([{ key: SETTING_KEYS.BUNNY_LIBRARY_ID, value: 'two' }])
    await expect(getBunnyStreamConfig()).resolves.toMatchObject({ libraryId: 'two' })
    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it('returns empty values and an incomplete status when settings are missing', async () => {
    findMany.mockResolvedValue([])
    await expect(getBunnyStreamConfigStatus()).resolves.toEqual({
      libraryId: '',
      apiKey: '',
      readOnlyApiKey: '',
      hasLibraryId: false,
      hasApiKey: false,
      isConfigured: false,
    })
  })
})
