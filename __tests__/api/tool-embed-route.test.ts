jest.mock('@/lib/tool-embed-access', () => ({
  resolveLessonToolOrigin: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { NextRequest } from 'next/server'
import {
  GET,
  RATE_LIMIT_MAX_REQUESTS,
} from '@/app/api/lesson/tool-embed/[lessonId]/[encodedOrigin]/[accessToken]/[[...path]]/route'
import { resolveLessonToolOrigin } from '@/lib/tool-embed-access'
import { auth } from '@/lib/auth'
import { signToolAccessToken, TOOL_ACCESS_TOKEN_TTL_SECONDS } from '@/lib/tool-embed-token'

const mockedResolveLessonToolOrigin = resolveLessonToolOrigin as jest.Mock
const mockedAuth = auth as jest.Mock

const LESSON_ID = 'lesson_1'
const OTHER_LESSON_ID = 'lesson_2'
const ORIGIN = 'https://tool.example.com'
const ENCODED_ORIGIN = Buffer.from(ORIGIN, 'utf-8').toString('base64url')

function callGet(
  accessToken: string,
  options: { path?: string[]; headers?: Record<string, string>; encodedOrigin?: string; requestOrigin?: string } = {}
) {
  const path = options.path ?? []
  const encodedOrigin = options.encodedOrigin ?? ENCODED_ORIGIN
  const requestOrigin = options.requestOrigin ?? 'https://woomin.test'
  const request = new NextRequest(
    `${requestOrigin}/api/lesson/tool-embed/${LESSON_ID}/${encodedOrigin}/${accessToken}/${path.join('/')}`,
    { headers: { 'user-agent': 'jest', ...options.headers } }
  )
  return GET(request, {
    params: Promise.resolve({ lessonId: LESSON_ID, encodedOrigin, accessToken, path }),
  })
}

describe('GET /api/lesson/tool-embed — token-in-URL 授權', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    mockedResolveLessonToolOrigin.mockResolvedValue(ORIGIN)
    // 多數子資源請求（<script src>/<link> 之類）本來就拿不到 session cookie，
    // 這是預設值；個別測試需要時再覆寫成有 session。
    mockedAuth.mockResolvedValue(null)
    global.fetch = jest.fn().mockResolvedValue(
      new Response('<html>ok</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    )
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('綁定這堂課、未過期的 token → 放行', async () => {
    const token = signToolAccessToken(LESSON_ID, 'user_1')
    const response = await callGet(token)
    expect(response.status).toBe(200)
  })

  it('回應帶 CSP frame-ancestors 與 Referrer-Policy：no-referrer（擋外站 iframe 內嵌、避免網址外洩）', async () => {
    const token = signToolAccessToken(LESSON_ID, 'user_1')
    const response = await callGet(token, { headers: { 'x-forwarded-for': '10.0.0.1' } })

    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'self'")
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('免費試閱單元核發的匿名 token（沒有 userId）→ 一樣放行', async () => {
    const token = signToolAccessToken(LESSON_ID, null)
    const response = await callGet(token)
    expect(response.status).toBe(200)
  })

  it('token 是綁別堂課的 → 401，不會呼叫上游', async () => {
    const token = signToolAccessToken(OTHER_LESSON_ID, 'user_1')
    const response = await callGet(token)
    expect(response.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('偽造的 token → 401', async () => {
    const response = await callGet('forged.token')
    expect(response.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('過期的 token → 401（登出/購買被撤銷後，重新整理頁面才會拿到新 token；舊網址頂多沿用到 token 自然過期為止）', async () => {
    const nowSpy = jest.spyOn(Date, 'now')
    nowSpy.mockReturnValue(1_000_000)
    const token = signToolAccessToken(LESSON_ID, 'user_1')
    nowSpy.mockReturnValue(1_000_000 + TOOL_ACCESS_TOKEN_TTL_SECONDS * 1000 + 1)

    const response = await callGet(token)

    expect(response.status).toBe(401)
    nowSpy.mockRestore()
  })

  it('token 有效，但這堂課目前設定的工具來源跟網址裡的 encodedOrigin 對不上 → 400', async () => {
    mockedResolveLessonToolOrigin.mockResolvedValue('https://different-tool.example.com')
    const token = signToolAccessToken(LESSON_ID, 'user_1')

    const response = await callGet(token)

    expect(response.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  describe('previewOrigin（後台「內嵌工具」預覽卡片：存檔前的即時預覽不用等資料庫先更新）', () => {
    const PREVIEW_ORIGIN = 'https://preview-tool.example.com'
    const PREVIEW_ENCODED_ORIGIN = Buffer.from(PREVIEW_ORIGIN, 'utf-8').toString('base64url')
    const OTHER_ORIGIN = 'https://a-completely-different-site.example.com'
    const OTHER_ENCODED_ORIGIN = Buffer.from(OTHER_ORIGIN, 'utf-8').toString('base64url')

    it('一般 token 遇到「資料庫還是舊網址、網址列是新網址」的落差 → 400（跟上面同一情境的一般 token 版本）', async () => {
      mockedResolveLessonToolOrigin.mockResolvedValue('https://saved-in-db.example.com')
      const token = signToolAccessToken(LESSON_ID, 'admin_1')

      const response = await callGet(token)

      expect(response.status).toBe(400)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('previewOrigin token 對「mint 時綁定的那一個 origin」放行，不查資料庫', async () => {
      const token = signToolAccessToken(LESSON_ID, 'admin_1', { previewOrigin: PREVIEW_ORIGIN })

      const response = await callGet(token, { encodedOrigin: PREVIEW_ENCODED_ORIGIN })

      expect(response.status).toBe(200)
      expect(mockedResolveLessonToolOrigin).not.toHaveBeenCalled()
    })

    it('同一顆 previewOrigin token，網址列換成第二個 origin 必須失敗——' +
      '不能讓同一顆 token 變成任意 https 來源的萬用鑰匙（這就是這次修的核心漏洞）', async () => {
      const token = signToolAccessToken(LESSON_ID, 'admin_1', { previewOrigin: PREVIEW_ORIGIN })

      // 先確認對原本綁定的 origin 是通的
      const originalResponse = await callGet(token, { encodedOrigin: PREVIEW_ENCODED_ORIGIN })
      expect(originalResponse.status).toBe(200)

      // 同一顆 token，換成另一個完全不相干的 origin，必須被拒絕
      const swappedResponse = await callGet(token, { encodedOrigin: OTHER_ENCODED_ORIGIN })
      expect(swappedResponse.status).toBe(400)
    })

    it('previewOrigin token 仍然要求解出來的字串本身是合法的 https origin', async () => {
      const token = signToolAccessToken(LESSON_ID, 'admin_1', { previewOrigin: PREVIEW_ORIGIN })
      const garbageEncodedOrigin = Buffer.from('not a url', 'utf-8').toString('base64url')

      const response = await callGet(token, { encodedOrigin: garbageEncodedOrigin })

      expect(response.status).toBe(400)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  it('Sec-Fetch-Dest: document（有人把代理網址直接貼到網址列打開）→ 403，不管 token 有沒有效', async () => {
    const token = signToolAccessToken(LESSON_ID, 'user_1')
    const request = new NextRequest(
      `https://woomin.test/api/lesson/tool-embed/${LESSON_ID}/${ENCODED_ORIGIN}/${token}/`,
      { headers: { 'user-agent': 'jest', 'sec-fetch-dest': 'document' } }
    )

    const response = await GET(request, {
      params: Promise.resolve({ lessonId: LESSON_ID, encodedOrigin: ENCODED_ORIGIN, accessToken: token, path: [] }),
    })

    expect(response.status).toBe(403)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  describe('這次請求本身拿得到 session 時，順便核對 token 綁定的使用者', () => {
    it('session 存在且跟 token 綁定的使用者一致 → 放行', async () => {
      mockedAuth.mockResolvedValue({ user: { id: 'user_1', role: 'USER' } })
      const token = signToolAccessToken(LESSON_ID, 'user_1')

      const response = await callGet(token)

      expect(response.status).toBe(200)
    })

    it('session 存在但跟 token 綁定的使用者不同 → 401（擋掉連結被另一個已登入使用者打開）', async () => {
      mockedAuth.mockResolvedValue({ user: { id: 'user_2', role: 'USER' } })
      const token = signToolAccessToken(LESSON_ID, 'user_1')

      const response = await callGet(token)

      expect(response.status).toBe(401)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('Referer 檢查（盡量提高門檻，不是完整防線）', () => {
    it('Referer 是自己網站的網址 → 放行', async () => {
      const token = signToolAccessToken(LESSON_ID, 'user_1')
      const response = await callGet(token, { headers: { referer: 'https://woomin.test/courses/x/lessons/y' } })
      expect(response.status).toBe(200)
    })

    it('Referer 是別的網站（例如把偷到的網址嵌進別人自己的網頁）→ 403', async () => {
      const token = signToolAccessToken(LESSON_ID, 'user_1')
      const response = await callGet(token, { headers: { referer: 'https://evil.example.com/page' } })
      expect(response.status).toBe(403)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('沒有帶 Referer（瀏覽器隱私設定可能會省略）→ 不強制要求，照樣放行', async () => {
      const token = signToolAccessToken(LESSON_ID, 'user_1')
      const response = await callGet(token)
      expect(response.status).toBe(200)
    })

    it('反代（例如 Zeabur）把請求轉給容器時 nextUrl 是內部位址，但帶了 x-forwarded-proto/host → 用轉送標頭判斷同站，照樣放行', async () => {
      const token = signToolAccessToken(LESSON_ID, 'user_1')
      const response = await callGet(token, {
        requestOrigin: 'http://0.0.0.0:8080',
        headers: {
          referer: 'https://woomin.test/courses/x/lessons/y',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'woomin.test',
        },
      })
      expect(response.status).toBe(200)
    })

    it('反代情境下 Referer 其實是別的網站（轉送標頭跟 Referer 網域不同）→ 403', async () => {
      const token = signToolAccessToken(LESSON_ID, 'user_1')
      const response = await callGet(token, {
        requestOrigin: 'http://0.0.0.0:8080',
        headers: {
          referer: 'https://evil.example.com/page',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'woomin.test',
        },
      })
      expect(response.status).toBe(403)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('rate limit（單一 process 記憶體內計數，鍵是「已驗證過的 token」fingerprint，不是 IP）', () => {
    it(`同一個 token 超過 ${RATE_LIMIT_MAX_REQUESTS} 次/分鐘 → 429`, async () => {
      const token = signToolAccessToken(LESSON_ID, 'user_rate_1')

      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const response = await callGet(token)
        expect(response.status).toBe(200)
      }

      const limited = await callGet(token)
      expect(limited.status).toBe(429)
      expect(limited.headers.get('retry-after')).toBeTruthy()
    })

    it('不同 token 各自計數，互不影響（同一個使用者換頁重新整理會拿到新 token，不會被舊配額卡住）', async () => {
      const tokenA = signToolAccessToken(LESSON_ID, 'user_rate_2')
      const tokenB = signToolAccessToken(LESSON_ID, 'user_rate_3')
      const responseA = await callGet(tokenA)
      const responseB = await callGet(tokenB)
      expect(responseA.status).toBe(200)
      expect(responseB.status).toBe(200)
    })

    it('鍵是「驗證過的 token」，不是可偽造的 X-Forwarded-For：拿偽造/無效 token 洗、洗不到別人合法 token 的配額', async () => {
      const legitToken = signToolAccessToken(LESSON_ID, 'user_rate_4')
      const victimIp = '198.51.100.9'

      // 攻擊者偽造成受害者的 IP，狂送一堆偽造 token——如果 rate limit 是用 IP 當鍵，
      // 這些請求會消耗掉「這個 IP」的配額，連帶把受害者用合法 token 的請求也洗到
      // 429；現在改成只有驗證通過的 token 才會被計數，偽造的請求連 counter 都碰不到。
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const forgedResponse = await callGet(`forged-${i}.token`, {
          headers: { 'x-forwarded-for': victimIp },
        })
        expect(forgedResponse.status).toBe(401)
      }

      const legitResponse = await callGet(legitToken, { headers: { 'x-forwarded-for': victimIp } })
      expect(legitResponse.status).toBe(200)
    })
  })
})
