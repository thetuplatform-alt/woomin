import {
  signToolAccessToken,
  verifyToolAccessToken,
  TOOL_ACCESS_TOKEN_TTL_SECONDS,
} from '@/lib/tool-embed-token'

const LESSON_A = 'lesson_a'
const LESSON_B = 'lesson_b'

describe('lib/tool-embed-token', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('簽發的 token 對同一個 lessonId 驗證通過', () => {
    const token = signToolAccessToken(LESSON_A)
    expect(verifyToolAccessToken(LESSON_A, token)).not.toBeNull()
  })

  it('簽發時可以綁使用者 id，驗證結果會回傳同一個 subject', () => {
    const token = signToolAccessToken(LESSON_A, 'user_123')
    expect(verifyToolAccessToken(LESSON_A, token)?.subject).toBe('user_123')
  })

  it('沒有帶 userId 時視為匿名（免費試閱單元），一樣驗證通過', () => {
    const token = signToolAccessToken(LESSON_A, null)
    expect(verifyToolAccessToken(LESSON_A, token)).not.toBeNull()
  })

  it('一般（非預覽）核發的 token，previewOrigin 是 null', () => {
    const token = signToolAccessToken(LESSON_A, 'user_1')
    expect(verifyToolAccessToken(LESSON_A, token)?.previewOrigin).toBeNull()
  })

  it('token 綁定 lessonId：拿別堂課的 token 驗證會失敗', () => {
    const token = signToolAccessToken(LESSON_A)
    expect(verifyToolAccessToken(LESSON_B, token)).toBeNull()
  })

  it('竄改過簽章的 token 驗證失敗', () => {
    const token = signToolAccessToken(LESSON_A)
    const [payload] = token.split('.')
    const tampered = `${payload}.forged-signature-that-does-not-match`
    expect(verifyToolAccessToken(LESSON_A, tampered)).toBeNull()
  })

  it('竄改過 payload（例如改成別的 lessonId 再重新拼回去）驗證失敗', () => {
    const token = signToolAccessToken(LESSON_A)
    const separatorIndex = token.lastIndexOf('.')
    const signature = token.slice(separatorIndex + 1)
    const forgedPayload = Buffer.from(
      JSON.stringify({ lessonId: LESSON_B, subject: 'user_1', exp: Date.now() + 999_999 }),
      'utf-8'
    ).toString('base64url')
    expect(verifyToolAccessToken(LESSON_B, `${forgedPayload}.${signature}`)).toBeNull()
  })

  it('竄改過 payload 硬塞 isPreview: true（沒有對應的簽章）驗證失敗', () => {
    const token = signToolAccessToken(LESSON_A, 'user_1') // 一般 token，isPreview 是 false
    const separatorIndex = token.lastIndexOf('.')
    const signature = token.slice(separatorIndex + 1)
    const forgedPayload = Buffer.from(
      JSON.stringify({ lessonId: LESSON_A, subject: 'user_1', exp: Date.now() + 999_999, isPreview: true }),
      'utf-8'
    ).toString('base64url')
    expect(verifyToolAccessToken(LESSON_A, `${forgedPayload}.${signature}`)).toBeNull()
  })

  it('過期的 token 驗證失敗', () => {
    const nowSpy = jest.spyOn(Date, 'now')
    nowSpy.mockReturnValue(1_000_000)
    const token = signToolAccessToken(LESSON_A)

    // 快轉到超過 TTL 之後
    nowSpy.mockReturnValue(1_000_000 + TOOL_ACCESS_TOKEN_TTL_SECONDS * 1000 + 1)
    expect(verifyToolAccessToken(LESSON_A, token)).toBeNull()
  })

  it('還沒過期時（TTL 內）驗證通過', () => {
    const nowSpy = jest.spyOn(Date, 'now')
    nowSpy.mockReturnValue(1_000_000)
    const token = signToolAccessToken(LESSON_A)

    nowSpy.mockReturnValue(1_000_000 + (TOOL_ACCESS_TOKEN_TTL_SECONDS * 1000) / 2)
    expect(verifyToolAccessToken(LESSON_A, token)).not.toBeNull()
  })

  it.each([null, undefined, '', 'not-a-valid-token', 'onlyonepart'])(
    '格式不正確的 token（%p）一律視為驗證失敗，不會拋例外',
    (invalid) => {
      expect(() => verifyToolAccessToken(LESSON_A, invalid as string | null)).not.toThrow()
      expect(verifyToolAccessToken(LESSON_A, invalid as string | null)).toBeNull()
    }
  )

  it('TTL 是 2 小時，token 是現場簽發、烤進網址裡，不是存在瀏覽器的長效憑證', () => {
    expect(TOOL_ACCESS_TOKEN_TTL_SECONDS).toBe(2 * 60 * 60)
  })

  describe('expectedUserId（呼叫端這次請求本身拿得到 session 時才傳）', () => {
    it('不傳 expectedUserId 時，不核對使用者，只看簽章/lessonId/效期', () => {
      const token = signToolAccessToken(LESSON_A, 'user_1')
      expect(verifyToolAccessToken(LESSON_A, token)).not.toBeNull()
    })

    it('傳的 expectedUserId 跟 token 綁定的使用者一致 → 驗證通過', () => {
      const token = signToolAccessToken(LESSON_A, 'user_1')
      expect(verifyToolAccessToken(LESSON_A, token, 'user_1')).not.toBeNull()
    })

    it('傳的 expectedUserId 跟 token 綁定的使用者不一致 → 驗證失敗（擋掉連結被另一個已登入使用者打開）', () => {
      const token = signToolAccessToken(LESSON_A, 'user_1')
      expect(verifyToolAccessToken(LESSON_A, token, 'user_2')).toBeNull()
    })

    it('匿名核發的 token（免費試閱單元），傳了 expectedUserId 一律驗證失敗', () => {
      const token = signToolAccessToken(LESSON_A, null)
      expect(verifyToolAccessToken(LESSON_A, token, 'user_1')).toBeNull()
    })
  })

  describe('previewOrigin（後台「內嵌工具」預覽卡片專用，讓存檔前的即時預覽也能顯示）', () => {
    const PREVIEW_ORIGIN_A = 'https://tool-a.example.com'
    const PREVIEW_ORIGIN_B = 'https://tool-b.example.com'

    it('簽發時綁定 previewOrigin，驗證結果會原樣回傳同一個 origin', () => {
      const token = signToolAccessToken(LESSON_A, 'admin_1', { previewOrigin: PREVIEW_ORIGIN_A })
      expect(verifyToolAccessToken(LESSON_A, token)?.previewOrigin).toBe(PREVIEW_ORIGIN_A)
    })

    it('沒有綁定 previewOrigin 時，驗證結果是 null（不是 undefined，方便呼叫端直接用真假值判斷）', () => {
      const token = signToolAccessToken(LESSON_A, 'user_1')
      expect(verifyToolAccessToken(LESSON_A, token)?.previewOrigin).toBeNull()
    })

    it('previewOrigin token 一樣受 lessonId／效期／簽章驗證約束，不是無條件通過', () => {
      const token = signToolAccessToken(LESSON_A, 'admin_1', { previewOrigin: PREVIEW_ORIGIN_A })
      expect(verifyToolAccessToken(LESSON_B, token)).toBeNull()
    })

    it('同一顆 token 對原本綁定的 origin 驗證通過，換成第二個 origin 不會自動跟著改變——' +
      'previewOrigin 是簽死在 token payload 裡的值，呼叫端（route.ts）必須自己拿網址列解出來的值' +
      '跟這個值比對，不能只看 token 有沒有 previewOrigin 欄位就整個放行任意來源', () => {
      const token = signToolAccessToken(LESSON_A, 'admin_1', { previewOrigin: PREVIEW_ORIGIN_A })
      const verified = verifyToolAccessToken(LESSON_A, token)

      expect(verified?.previewOrigin).toBe(PREVIEW_ORIGIN_A)
      expect(verified?.previewOrigin).not.toBe(PREVIEW_ORIGIN_B)
    })
  })
})
