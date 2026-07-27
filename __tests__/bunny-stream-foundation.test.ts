import { SETTING_KEYS } from '@/lib/validations/settings'
import { videoProviderEnum } from '@/lib/validations/curriculum'
import type { AppVideoProvider } from '@/lib/video-source'
import { normalizeLessonVideoFields } from '@/lib/video-source'
import { decryptSecret, encryptSecret } from '@/lib/crypto/settings-encryption'

describe('Bunny Stream foundation contracts', () => {
  it('accepts bunny as a lesson video provider', () => {
    expect(videoProviderEnum.parse('bunny')).toBe('bunny')
    const provider: AppVideoProvider = 'bunny'
    expect(provider).toBe('bunny')
  })

  it('keeps Bunny lessons as Bunny when a source ID is present', () => {
    expect(
      normalizeLessonVideoFields({
        videoProvider: 'bunny',
        videoSourceId: 'bunny-video-id',
      })
    ).toMatchObject({
      videoProvider: 'bunny',
      videoSourceId: 'bunny-video-id',
    })
  })

  it('exposes Bunny credential setting keys without a meaningless securityKey field', () => {
    expect(SETTING_KEYS.BUNNY_LIBRARY_ID).toBe('bunny_library_id')
    expect(SETTING_KEYS.BUNNY_LIBRARY_API_KEY).toBe('bunny_library_api_key')
    // Bunny 官方文件證實 Stream token authentication 就是用 Library API Key 本身，
    // 不存在獨立的「Security Key」欄位，故不應再有 BUNNY_SECURITY_KEY 設定鍵。
    expect('BUNNY_SECURITY_KEY' in SETTING_KEYS).toBe(false)
  })

  it('encrypts and decrypts a secret without storing plaintext', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    const plaintext = 'bunny-secret-value'
    const encrypted = encryptSecret(plaintext)

    expect(encrypted).not.toContain(plaintext)
    expect(decryptSecret(encrypted)).toBe(plaintext)
  })

  it('fails closed when the encryption key is missing', () => {
    const original = process.env.SETTINGS_ENCRYPTION_KEY
    delete process.env.SETTINGS_ENCRYPTION_KEY

    expect(() => encryptSecret('secret')).toThrow('SETTINGS_ENCRYPTION_KEY')
    expect(() => decryptSecret('not-a-ciphertext')).toThrow('SETTINGS_ENCRYPTION_KEY')

    if (original === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY
    else process.env.SETTINGS_ENCRYPTION_KEY = original
  })
})
