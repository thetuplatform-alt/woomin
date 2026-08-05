import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { resolveLessonToolOrigin } from '@/lib/tool-embed-access'
import { verifyToolAccessToken } from '@/lib/tool-embed-token'
import { auth } from '@/lib/auth'
import { resolveOriginFromHeaders } from '@/lib/app-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// 驗收標準（正式記錄，取代原本零散的取捨說明；未達成任一項都算 FAIL）
// ============================================================================
// 1. 分享 wrapper URL（/lesson-tool/...）時，必須重新檢查登入與購課資格——
//    這個頁面每次都是真正的伺服器端 checkLessonAccess/isStaff 判斷，不吃 token。
// 2. 直接在瀏覽器網址列打開這條 proxy URL 必須被阻擋——見下面 Sec-Fetch-Dest 檢查
//    （瀏覽器對「使用者直接輸入網址/點連結」的頂層導覽會標示 document）。
// 3. 外站不得直接把這條 proxy URL 當 iframe 嵌入自己的頁面——見下面的
//    Content-Security-Policy: frame-ancestors 'self'（瀏覽器強制執行，檢查整條祖先
//    鏈，比讀 Referer 可靠）與 hasForeignReferer 的輔助判斷。
// 4.【已知並接受的風險】已授權頁面產生的短效 accessToken，在有效期內可能被
//    curl、關掉 Referer 的用戶端等「非瀏覽器一般行為」的請求重放，繞過即時的
//    登入/購課檢查。這是把授權烤進網址（取代會被 Chrome 第三方 cookie 政策擋掉
//    的 cookie）這個方案的結構性代價，無法只靠伺服器端驗證完全杜絕。
//    接受此風險的理由：
//      - 上游工具本身是公開網站，沒有這個 proxy 也能直接訪問，不含 WooMin 的
//        任何機密。
//      - 這個 proxy 不轉發 WooMin 的 session、cookie、Authorization 或任何學員
//        個資給上游，外流的 token 換不到課程內容、金流或會員資料，只能換到
//        「重新看一次原本就公開的工具頁面」。
//      - 已經做的防線（wrapper 頁面即時驗證、Sec-Fetch-Dest 擋直接開網址列、
//        CSP frame-ancestors 擋外站 iframe、Referer 檢查、token 綁定 lessonId+
//        使用者）已經擋掉「一般轉發」的路徑，剩下的是需要刻意用 curl / 手動關
//        Referer 的重放，屬於低機率、低嚴重度的殘留風險。
//      - 繼續緊縮 TTL 或強制每個請求都查 session，只會在「安全門檻」跟「工具
//        可用性」之間來回擺盪：iframe 裡的子資源請求（<script src> 等）結構上
//        就是拿不到 session cookie（Chrome 對 opaque origin 的第三方 cookie
//        封鎖，已實測驗證），逼著每個請求都查 session 只會重現最早那個「JS/CSS
//        全部 401、畫面變白板」的 bug。
//    若未來這些工具開始存取 WooMin 私有資料、產生實質成本、或需要真正的 DRM，
//    才需要投入更大的架構調整（把 proxy 移到獨立子網域，讓 iframe 用真正的
//    allow-same-origin + 該子網域自己的 host-only session，用瀏覽器原生的
//    同源隔離取代現在這個 sandbox + token 的折衷做法）。

const REWRITABLE_CONTENT_TYPES = [
  'text/html',
  'text/css',
  'application/javascript',
  'text/javascript',
  'application/json',
]

const UPSTREAM_TIMEOUT_MS = 15_000
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024 // 20MB，遠高於目前工具的最大 bundle（~560KB），擋掉異常巨大回應
const MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024 // 5MB，這些工具都是文字表單，沒有大檔上傳需求
const MAX_REDIRECT_HOPS = 5

// iframe 拿掉了 allow-same-origin（見 lesson-content.tsx 的 sandbox 設定），內容會是 opaque origin，
// 瀏覽器對它發出的 fetch/XHR 一律視為跨源請求。這裡明確允許 opaque origin（Origin: null）
// 帶憑證存取，讓工具內部（例如 Vite RSC 框架自身的導覽/刷新 fetch）能正常運作。
// 這份清單同時用來（1）在 CORS 預檢裡宣告可以帶哪些 header，（2）實際把這些 header
// 轉發給上游——只做 (1) 不做 (2) 的話，瀏覽器雖然放行了請求，上游卻收不到這些語意
// 標頭（例如 RSC 導覽用的 x-rsc-action），一樣會壞。
const FORWARDABLE_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'rsc',
  'next-router-state-tree',
  'next-router-prefetch',
  'next-router-segment-prefetch',
  'next-url',
  'x-vinext-params',
  'x-vinext-mounted-slots',
  'x-vinext-interception-context',
  'x-vinext-rsc-render-mode',
  'x-rsc-action',
]
const DEFAULT_ALLOWED_HEADERS = FORWARDABLE_REQUEST_HEADERS.join(', ')

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': 'null',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
    // 瀏覽器強制執行：只有同源頁面可以把這個回應內嵌成 iframe，比讀 Referer 可靠
    // （Referer 可以被拿掉/偽造；CSP frame-ancestors 由瀏覽器在建立 frame 時直接
    // 檢查整條祖先鏈，外站沒辦法繞過）。
    'Content-Security-Policy': "frame-ancestors 'self'",
    // 避免這條帶著 accessToken 的網址，因為頁面裡的外部連結／資源請求而被當成
    // Referer 洩漏給第三方網站。
    'Referrer-Policy': 'no-referrer',
  }
}

// 簡易的記憶體內 rate limit，鍵是「lessonId + 來源 IP」（不是用 token 當鍵：每次
// 頁面載入都會拿到新 token）。只適合單一常駐 process 的部署方式（例如目前這種
// next start）；如果之後改成多實例或 serverless 部署，要換成 Redis/Upstash 之類
// 的共用儲存才能跨實例生效。
//
// 鍵是 token 的 fingerprint，不是 IP：一開始用「lessonId + X-Forwarded-For」當鍵，
// 但 X-Forwarded-For 是用戶端可以任意偽造的標頭——在還沒驗證 token 有效性之前就
// 拿它來計數，等於任何人都能偽造成任意受害者的 IP，把對方的配額洗爆（新增了一個
// DoS 破口），共用 NAT/公司網路的正常使用者彼此之間也會誤觸。改成：只有先驗證過
// token 簽章/lessonId/效期都對，才會被計入 rate limit，鍵是這個 token 的
// fingerprint（沒有合法 token 就不可能算出同一個 fingerprint，也就沒辦法用偽造的
// IP 去洗爆別人的桶）。另外設定 RATE_LIMIT_MAX_TRACKED_KEYS 這個容量上限，確保
// 這個 Map 的大小有確定的上界，不會被大量不同的合法 token 撐爆記憶體。
export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX_REQUESTS = 120 // 一次頁面載入含 HTML/JS/CSS/圖片通常數個到二十幾個請求，留足夠緩衝
export const RATE_LIMIT_MAX_TRACKED_KEYS = 10_000

interface RateLimitBucket {
  count: number
  windowStart: number
}
const rateLimitBuckets = new Map<string, RateLimitBucket>()

function tokenFingerprint(accessToken: string): string {
  return crypto.createHash('sha256').update(accessToken).digest('hex').slice(0, 16)
}

function isRateLimited(accessToken: string): boolean {
  const now = Date.now()

  // 順便機率性地清掉過期的 bucket；不用 setInterval 是為了避免 Next dev 的 HMR
  // 重新載入這個模組時疊加出多個計時器。
  if (Math.random() < 0.01) {
    for (const [key, bucket] of rateLimitBuckets) {
      if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitBuckets.delete(key)
    }
  }

  const key = tokenFingerprint(accessToken)
  const bucket = rateLimitBuckets.get(key)
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    // 硬上限：新 key 而且已經到容量上限時，踢掉最舊的一筆騰出空間
    // （Map 保留插入順序，第一個 key 就是最舊的）。
    if (!rateLimitBuckets.has(key) && rateLimitBuckets.size >= RATE_LIMIT_MAX_TRACKED_KEYS) {
      const oldestKey = rateLimitBuckets.keys().next().value
      if (oldestKey !== undefined) rateLimitBuckets.delete(oldestKey)
    }
    rateLimitBuckets.set(key, { count: 1, windowStart: now })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX_REQUESTS
}

// 只放行這堂課在後台實際設定的那一個工具網址（見 resolveLessonToolOrigin），
// 而不是全域白名單，避免任何登入使用者把這條路由當成任意網址的開放代理（SSRF）。
function decodeOrigin(encoded: string, allowedOrigin: string | null): string | null {
  if (!allowedOrigin) return null
  try {
    const origin = Buffer.from(encoded, 'base64url').toString('utf-8')
    return origin === allowedOrigin ? origin : null
  } catch {
    return null
  }
}

// 只解析格式（用 new URL(...).origin 正規化再跟解碼結果原樣比對，擋掉解出一堆垃圾
// 字串的情況），不是安全邊界本身——真正決定「這顆 token 只能代理哪一個 origin」的
// 是呼叫端把解出來的值跟 verified.previewOrigin 比對是否相等（見 resolveOrigin）。
function decodePreviewOrigin(encoded: string): string | null {
  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    const parsed = new URL(decoded)
    if (parsed.protocol !== 'https:') return null
    return parsed.origin === decoded ? parsed.origin : null
  } catch {
    return null
  }
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: corsHeaders() })
}

function rewriteBody(body: string, origin: string, proxyBase: string) {
  return body
    .split(origin)
    .join(proxyBase) // 內文中出現的完整第三方網址（含通訊協定）一律換成同源代理路徑
    .replace(/((?:src|href)=["'])\/(?!\/)/g, `$1${proxyBase}/`) // <script src="/...">、<link href="/...">
    .replace(/(url\(["']?)\/(?!\/)/g, `$1${proxyBase}/`) // CSS 內的 url(/...)
    .replace(/(["'])\/assets\//g, `$1${proxyBase}/assets/`) // Vite 動態 import 的 chunk 路徑
}

// 手動逐跳驗證重新導向目標，避免上游把請求導去允許網域以外的地方（SSRF）。
// 同時要照 HTTP 語意處理 method/body：303 一律轉成 GET；301/302 遇到非 GET/HEAD
// 也要轉成 GET（拿掉 body）；只有 307/308 規定要完整保留原本的 method 與 body。
// 全部沿用原本 method/body 的話，POST 遇到上游 303（很常見的「送出表單→導去結果頁」
// pattern）會變成對新網址重複 POST，可能是 405，也可能是重複觸發一次 mutation。
async function fetchWithValidatedRedirects(
  url: string,
  init: RequestInit,
  allowedOrigin: string
): Promise<Response> {
  let currentUrl = url
  let currentInit = init

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const res = await fetch(currentUrl, { ...currentInit, redirect: 'manual' })
    const isRedirect = res.status >= 300 && res.status < 400
    if (!isRedirect) return res

    const location = res.headers.get('location')
    if (!location) return res

    const nextUrl = new URL(location, currentUrl)
    if (nextUrl.origin !== allowedOrigin) {
      throw new Error('redirect_blocked')
    }

    // WHATWG Fetch Standard 的 HTTP-redirect fetch 演算法：301/302 只有 method 是
    // POST 時才轉成 GET（歷史上瀏覽器對 POST 的相容處理）；303 才是不管原本方法一律
    // 轉 GET（GET/HEAD 除外）。PUT/PATCH/DELETE 遇到 301/302 必須維持原本 method/body，
    // 否則會靜默地讓更新/刪除操作沒有真的執行，比明確報錯還糟。
    const currentMethod = (currentInit.method ?? 'GET').toUpperCase()
    const shouldDowngradeToGet =
      res.status === 303 ||
      ((res.status === 301 || res.status === 302) && currentMethod === 'POST')

    if (shouldDowngradeToGet && currentMethod !== 'GET') {
      const restHeaders: Record<string, string> = {}
      for (const [key, value] of Object.entries((currentInit.headers as Record<string, string>) ?? {})) {
        if (key.toLowerCase() !== 'content-type') restHeaders[key] = value
      }
      currentInit = { ...currentInit, method: 'GET', body: undefined, headers: restHeaders }
    }

    currentUrl = nextUrl.toString()
  }

  throw new Error('too_many_redirects')
}

// 邊讀邊計算位元組數，超過上限就中止，避免耗盡記憶體。同時吃 Response 或 Request，
// 因為兩者在 fetch 標準裡都只是「有 body: ReadableStream」的物件。
async function readBodyWithLimit(
  source: { body: ReadableStream<Uint8Array> | null },
  maxBytes: number
): Promise<Uint8Array> {
  if (!source.body) return new Uint8Array()

  const reader = source.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      total += value.byteLength
      if (total > maxBytes) {
        throw new Error('body_too_large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

// 存取權完全靠網址裡的 accessToken（見 lib/tool-embed-token.ts），不再讀 session／cookie：
// 這個 token 是呼叫端（getLessonContent()、app/lesson-tool 頁面、後台預覽面板）在已經
// 用真正的 session 確認過權限之後才現場簽發、烤進網址裡的，不是存在瀏覽器的長效憑證。
// 一開始的作法是核發一顆 SameSite=None cookie 頂替 session cookie，但實測發現行不通：
// sandbox 拿掉 allow-same-origin 之後 iframe 是 opaque origin，Chrome 的第三方 cookie
// 封鎖（Privacy Sandbox）會把它當第三方，不管 cookie 是不是 SameSite=None 都不送出去。
// 網址則不受任何 cookie 政策影響，一定會被完整送出。
async function resolveOrigin(
  lessonId: string,
  encodedOrigin: string,
  accessToken: string
): Promise<{ origin: string } | { error: NextResponse }> {
  const verified = verifyToolAccessToken(lessonId, accessToken)
  if (!verified) {
    return { error: errorResponse('invalid_or_expired_token', 401) }
  }

  // rate limit 要放在「確認 token 有效」之後才算——鍵是 token 的 fingerprint，
  // 沒有合法 token 就不可能算出同一把鑰匙，也就沒辦法拿偽造的請求去洗爆別人的配額
  // （見 isRateLimited 的說明）。
  if (isRateLimited(accessToken)) {
    return {
      error: NextResponse.json(
        { success: false, error: 'rate_limited' },
        { status: 429, headers: { ...corsHeaders(), 'Retry-After': String(RATE_LIMIT_WINDOW_MS / 1000) } }
      ),
    }
  }

  // token 本身無法阻止「網址被分享出去、在完全沒有 session 的瀏覽器/curl 裡直接用」——
  // 這是把授權烤進網址本身必然的取捨。但只要這次請求本身「拿得到」session（例如
  // iframe 載入本身那次頂層導覽，這類請求本來就帶得到 cookie），就順便核對一下：
  // 目前登入的人是不是跟這個 token 原本核發給的人是同一個。這樣至少擋掉「連結被
  // 另一個已經登入自己帳號的人打開」這種情況——雖然沒辦法擋掉完全匿名的重放。
  const session = await auth()
  if (session?.user?.id && verified.subject !== session.user.id) {
    return { error: errorResponse('token_user_mismatch', 401) }
  }

  // previewOrigin（只有後台「內嵌工具」預覽卡片核發的 token 才會有）：這張卡片即時
  // 反映講師正在輸入、還沒存檔的網址，資料庫裡的 toolUrl 這時候可能還是舊的，拿舊值
  // 去比對一定會一直 unsupported_origin，逼講師「先存檔才能預覽」。但這裡絕對不能
  // 只驗證格式就整個放行——那樣同一顆 token 就能拿去代理任意 https 網址，變成開放
  // 代理。一定要跟 mint 時簽死在 token 裡的那個特定 origin 完全比對相等。
  if (verified.previewOrigin) {
    const origin = decodePreviewOrigin(encodedOrigin)
    if (!origin || origin !== verified.previewOrigin) {
      return { error: errorResponse('unsupported_origin', 400) }
    }
    return { origin }
  }

  const allowedOrigin = await resolveLessonToolOrigin(lessonId)
  const origin = decodeOrigin(encodedOrigin, allowedOrigin)
  if (!origin) {
    return { error: errorResponse('unsupported_origin', 400) }
  }

  return { origin }
}

// 只是「盡量提高門檻」，不是完整防線：curl 或手動組出來的請求可以隨便偽造/省略
// Referer，這裡擋不住蓄意的重放。但如果有人把偷到的網址嵌進「自己的另一個網頁」
// 當 iframe，瀏覽器會如實送出那個頁面的 Referer，這種情況擋得下來。
//
// 不能只拿 request.nextUrl.origin 當「自己」的基準：Zeabur 等反代不會把外部
// https://真實網域 原樣轉給容器內的 Next.js，container 收到的 scheme/host
// 常常是內部位址（例如 http://0.0.0.0:8080），導致合法的同站 Referer 被誤判成
// foreign_referer（見 next.config.ts 的 getAllowedOrigins 同一類反代問題）。
// 優先用 lib/app-url.ts 既有的 x-forwarded-proto/x-forwarded-host 解析（跟平台
// 其餘判斷「自己網域」的地方共用同一套邏輯），沒有這兩個標頭（本機開發、或反代
// 沒轉送）才退回 nextUrl.origin——刻意不查 DB 的 SiteSetting：這是高頻的 proxy
// 路徑，不該為了這個檢查多一次資料庫往返。
function hasForeignReferer(request: NextRequest): boolean {
  const referer = request.headers.get('referer')
  if (!referer) return false
  try {
    const selfOrigin = resolveOriginFromHeaders(request.headers) ?? request.nextUrl.origin
    return new URL(referer).origin !== new URL(selfOrigin).origin
  } catch {
    return false
  }
}

type ProxyMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function proxyRequest(
  request: NextRequest,
  {
    lessonId,
    encodedOrigin,
    accessToken,
    path,
  }: { lessonId: string; encodedOrigin: string; accessToken: string; path?: string[] },
  method: ProxyMethod
) {
  // 只有明確標示「這是頂層文件導覽」（例如有人直接把這條網址貼到網址列打開）才擋。
  // 我們自己的 iframe 內嵌（Sec-Fetch-Dest: iframe）、工具內部的 fetch/XHR（empty）、
  // 資源載入（script/style/image 等）都要放行；瀏覽器沒送這個標頭時也放行，避免誤傷。
  if (request.headers.get('sec-fetch-dest') === 'document') {
    return errorResponse('must_be_embedded', 403)
  }

  if (hasForeignReferer(request)) {
    return errorResponse('foreign_referer', 403)
  }

  const resolved = await resolveOrigin(lessonId, encodedOrigin, accessToken)
  if ('error' in resolved) return resolved.error
  const { origin } = resolved

  const proxyBase = `/api/lesson/tool-embed/${lessonId}/${encodedOrigin}/${accessToken}`
  const upstreamPath = (path ?? []).join('/')
  const upstreamUrl = `${origin}/${upstreamPath}${request.nextUrl.search}`

  const headers: Record<string, string> = {
    'User-Agent': request.headers.get('user-agent') ?? 'Mozilla/5.0',
  }
  for (const name of FORWARDABLE_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers[name] = value
  }

  let requestBody: Uint8Array | undefined
  if (method !== 'GET') {
    if (!headers['content-type']) {
      headers['Content-Type'] = 'application/octet-stream'
    }
    try {
      requestBody = await readBodyWithLimit(request, MAX_REQUEST_BODY_BYTES)
    } catch {
      return errorResponse('request_too_large', 413)
    }
  }

  // 同一個 controller 要蓋住「發出請求」到「讀完整個回應 body」的全程，
  // 只到收到 response headers 就 clearTimeout 的話，上游可以 headers 秒回、body 用龜速滴、卡住連線不放。
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    let upstreamRes: Response
    try {
      upstreamRes = await fetchWithValidatedRedirects(
        upstreamUrl,
        {
          method,
          headers,
          body: requestBody as BodyInit | undefined,
          cache: 'no-store',
          signal: controller.signal,
        },
        origin
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return errorResponse('upstream_timeout', 504)
      }
      if (error instanceof Error && error.message === 'redirect_blocked') {
        return errorResponse('redirect_blocked', 502)
      }
      console.error('Tool embed proxy upstream fetch failed:', error)
      return errorResponse('upstream_unreachable', 502)
    }

    // 這幾個狀態碼依 fetch 標準規定不能帶 body，Response/NextResponse 建構子只要收到
    // 非 null 的 body（就算是空字串／空 buffer）就會直接丟出 "Invalid response status
    // code" 例外，把整個請求弄成 500。PUT/PATCH/DELETE 上線後很容易遇到 204。
    // （101/103 不需要列在這裡：fetch() 本身就不會把 1xx informational response 當成
    // 最終回應交給呼叫端；而且 Response 建構子規定 status 本來就要在 200-599 之間，
    // 就算真的收到 101/103，傳 null body 一樣會因為 status 本身不合法而丟例外，
    // 列進這個集合並不能真的防住什麼。）
    const NULL_BODY_STATUSES = new Set([204, 205, 304])
    if (NULL_BODY_STATUSES.has(upstreamRes.status)) {
      return new NextResponse(null, { status: upstreamRes.status, headers: corsHeaders() })
    }

    const contentType = upstreamRes.headers.get('content-type') ?? 'application/octet-stream'
    const isRewritable = REWRITABLE_CONTENT_TYPES.some((type) => contentType.includes(type))

    let bodyBytes: Uint8Array
    try {
      bodyBytes = await readBodyWithLimit(upstreamRes, MAX_RESPONSE_BYTES)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return errorResponse('upstream_timeout', 504)
      }
      return errorResponse('response_too_large', 502)
    }

    if (isRewritable) {
      const rewritten = rewriteBody(Buffer.from(bodyBytes).toString('utf-8'), origin, proxyBase)

      return new NextResponse(rewritten, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
          ...corsHeaders(),
        },
      })
    }

    return new NextResponse(Buffer.from(bodyBytes), {
      status: upstreamRes.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store, max-age=0',
        ...corsHeaders(),
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

type RouteContext = {
  params: Promise<{ lessonId: string; encodedOrigin: string; accessToken: string; path?: string[] }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { lessonId, encodedOrigin, accessToken, path } = await params
  return proxyRequest(request, { lessonId, encodedOrigin, accessToken, path }, 'GET')
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { lessonId, encodedOrigin, accessToken, path } = await params
  return proxyRequest(request, { lessonId, encodedOrigin, accessToken, path }, 'POST')
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { lessonId, encodedOrigin, accessToken, path } = await params
  return proxyRequest(request, { lessonId, encodedOrigin, accessToken, path }, 'PUT')
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { lessonId, encodedOrigin, accessToken, path } = await params
  return proxyRequest(request, { lessonId, encodedOrigin, accessToken, path }, 'PATCH')
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { lessonId, encodedOrigin, accessToken, path } = await params
  return proxyRequest(request, { lessonId, encodedOrigin, accessToken, path }, 'DELETE')
}

// CORS 預檢：瀏覽器不會在 preflight 帶 cookie，這裡無法（也不需要）做存取權檢查——
// 之後真正的 GET/POST 一樣會走完整的 token 驗證，preflight 本身不外洩任何資料。
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': DEFAULT_ALLOWED_HEADERS,
      'Access-Control-Max-Age': '600',
    },
  })
}
