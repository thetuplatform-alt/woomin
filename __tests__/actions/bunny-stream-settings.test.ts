jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    adminLog: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/require-admin', () => ({
  requireAdminAuth: jest.fn(),
  requireOnlyAdminAuth: jest.fn(),
}))

jest.mock('@/lib/crypto/settings-encryption', () => ({
  encryptSecret: jest.fn((value: string) => `encrypted:${value}`),
  decryptSecret: jest.fn((value: string) => value.replace(/^encrypted:/, 'decrypted:')),
}))

jest.mock('@/lib/bunny', () => ({
  testLibraryConnection: jest.fn(),
}))

import {
  getBunnyStreamSettings,
  updateBunnyStreamSettings,
} from '@/lib/actions/settings'
import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { clearBunnyStreamConfigCache } from '@/lib/bunny-stream-config'
import { SETTING_KEYS } from '@/lib/validations/settings'

const mockedPrisma = prisma as unknown as {
  siteSetting: { findMany: jest.Mock; upsert: jest.Mock }
  adminLog: { create: jest.Mock }
}
const mockedRequireOnlyAdminAuth = requireOnlyAdminAuth as jest.Mock

describe('Bunny Stream 設定 Read-Only API Key', () => {
  beforeEach(() => {
    clearBunnyStreamConfigCache()
    mockedRequireOnlyAdminAuth.mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
    mockedPrisma.siteSetting.findMany.mockResolvedValue([])
    mockedPrisma.siteSetting.upsert.mockResolvedValue(undefined)
    mockedPrisma.adminLog.create.mockResolvedValue(undefined)
  })

  it('儲存 readOnlyApiKey 時正確加密寫入', async () => {
    const result = await updateBunnyStreamSettings({
      libraryId: '416184',
      apiKey: '',
      apiKeyTouched: false,
      readOnlyApiKey: 'new-read-only-key',
      readOnlyApiKeyTouched: true,
    })

    expect(result.success).toBe(true)
    expect(mockedPrisma.siteSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: SETTING_KEYS.BUNNY_READ_ONLY_API_KEY },
        update: { value: 'encrypted:new-read-only-key' },
        create: { key: SETTING_KEYS.BUNNY_READ_ONLY_API_KEY, value: 'encrypted:new-read-only-key' },
      })
    )
  })

  it('未觸碰（readOnlyApiKeyTouched: false）時保留原值不覆寫', async () => {
    mockedPrisma.siteSetting.findMany.mockResolvedValue([
      { key: SETTING_KEYS.BUNNY_LIBRARY_ID, value: '416184' },
      { key: SETTING_KEYS.BUNNY_READ_ONLY_API_KEY, value: 'encrypted:existing-read-only-key' },
    ])

    const result = await updateBunnyStreamSettings({
      libraryId: '416184',
      apiKey: '',
      apiKeyTouched: false,
      readOnlyApiKey: 'deco...tkey',
      readOnlyApiKeyTouched: false,
    })

    expect(result.success).toBe(true)
    const readOnlyKeyCalls = mockedPrisma.siteSetting.upsert.mock.calls.filter(
      ([args]) => args.where.key === SETTING_KEYS.BUNNY_READ_ONLY_API_KEY
    )
    expect(readOnlyKeyCalls).toHaveLength(0)
  })

  it('getBunnyStreamSettings 回傳正確遮罩的 readOnlyApiKeyHint', async () => {
    mockedPrisma.siteSetting.findMany.mockResolvedValue([
      { key: SETTING_KEYS.BUNNY_LIBRARY_ID, value: '416184' },
      { key: SETTING_KEYS.BUNNY_LIBRARY_API_KEY, value: 'encrypted:library-api-key' },
      { key: SETTING_KEYS.BUNNY_READ_ONLY_API_KEY, value: 'encrypted:read-only-api-key-value' },
    ])

    const view = await getBunnyStreamSettings()

    // decryptSecret mock 把 'encrypted:' 換成 'decrypted:'，
    // maskSecret 只保留前 4 碼與後 4 碼，比照 apiKeyHint 現有遮罩規則。
    expect(view.readOnlyApiKeyHint).toBe('decr...alue')
  })
})
