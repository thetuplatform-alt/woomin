// lib/tool-embed-token.ts
// 課程內嵌工具的存取權杖：簽發／驗證一個綁定 lessonId（+ 使用者，若能核對）的短效 token。
//
// 背景：iframe 拿掉 allow-same-origin 之後變成 opaque origin。原本試過用一顆
// SameSite=None 的 cookie 頂替 session cookie，結果實測發現行不通——Chrome 的
// 第三方 cookie 封鎖（Privacy Sandbox）判斷「是不是第三方」是看 frame 自己的
// origin 跟頂層頁面是否相同，opaque origin 永遠不等於任何東西，所以 Chrome
// 直接把這個 sandboxed iframe 當成第三方，不管 cookie 是不是 SameSite=None 都
// 不送出去（DevTools 可以看到 cookie 有存下來，但 Request Headers 裡完全沒有
// Cookie）。
//
// 改成 token 直接烤進網址本身（見 lib/tool-embed.ts 的 buildToolEmbedSrc）。網址是
// 請求的一部分，不受任何 cookie 政策影響，瀏覽器一定會把完整網址送出去。
//
// 殘留風險（誠實揭露，這是這個做法本身的結構性代價，不是漏改）：
// 網址本身就是一個 bearer credential，把完整代理網址分享出去，另一個瀏覽器／curl
// 在 token 效期內還是能直接用，不會重新檢查登入或購課——這是「用網址取代 cookie
// 繞過 opaque-origin 限制」這個方案必然的取捨，沒有辦法只靠簽章驗證完全杜絕。
// 能做的：(1) 這裡把 userId 綁進 token、代理路由在「這次請求本身就帶得到 session」時
// （例如 iframe 載入本身那次頂層導覽）順便核對是不是同一個人，擋掉「連結被另一個
// 已登入自己帳號的人打開」這種情況；(2) 把 TTL 訂在合理範圍內，界定沒有 session
// 可核對時（匿名 curl／embed 在別的頁面）最壞情況的暴露時間。
import 'server-only'
import crypto from 'crypto'
import { getAuthSecret } from '@/lib/auth-secret'

// 2 小時：權衡過兩件事——訂太短，使用者在工具裡待稍微久一點，token 過期後續資源／
// 互動就會開始 401（沒有辦法在不重新整理 iframe 的前提下做續期，因為第三方工具
// 已經載入的程式碼不會知道要用新網址，重新整理又會遺失使用者已經輸入的內容）；
// 訂太長則放大「token 外流後可以用多久」的風險。2 小時大致涵蓋一次正常的上課／
// 使用時段，同時有 userId 核對機制（見 verifyToolAccessToken）縮小實際能被濫用的情境。
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

// 匿名／免費試閱單元沒有真正的 userId 可綁，用固定字串標記，
// 純粹只是讓 payload 格式一致，不代表任何實質權限。
const ANONYMOUS_SUBJECT = 'anon'

interface TokenPayload {
  lessonId: string
  subject: string
  exp: number
  // 只有後台「內嵌工具」預覽卡片核發的 token 才會有這個欄位（見
  // app/api/admin/lessons/[id]/tool-embed-token/route.ts）。這個卡片會即時反映
  // 講師正在輸入、還沒存檔的網址，跟資料庫裡實際存的 toolUrl 可能暫時對不上，
  // 所以允許代理路由跳過「網址要對得上資料庫」的檢查——但絕對不能整個放行任意
  // origin：previewOrigin 把「這個 token 可以代理哪一個網址」直接簽死在 token
  // 本身裡，代理路由要求網址列的 encodedOrigin 解出來的值必須跟這裡完全一致。
  // 少了這一步，同一顆 token 會變成任意 https 網址的萬用鑰匙——外流後就不只是
  // 「重放這堂課設定的那個公開工具」，而是整台伺服器變成任意站台的開放代理，
  // 遠超過原本評估、已接受的風險範圍。
  previewOrigin?: string
}

export interface VerifiedToolAccessToken {
  subject: string
  previewOrigin: string | null
}

export function signToolAccessToken(
  lessonId: string,
  userId?: string | null,
  options?: { previewOrigin?: string }
): string {
  const payload: TokenPayload = {
    lessonId,
    subject: userId || ANONYMOUS_SUBJECT,
    exp: Date.now() + TOKEN_TTL_MS,
    ...(options?.previewOrigin ? { previewOrigin: options.previewOrigin } : {}),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')
  const signature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encodedPayload)
    .digest('base64url')
  return `${encodedPayload}.${signature}`
}

/**
 * 回傳 null 代表驗證失敗（簽章不對／lessonId 不符／過期／格式錯誤）。
 * expectedUserId 只在呼叫端「這次請求本身就拿得到 session」時才傳——多數子資源
 * 請求拿不到 session（那正是需要這個 token 的原因），這種情況下只驗證簽章／
 * lessonId／效期，不強制核對使用者。傳了 expectedUserId 卻對不上，一律視為失敗。
 */
export function verifyToolAccessToken(
  lessonId: string,
  token: string | null | undefined,
  expectedUserId?: string | null
): VerifiedToolAccessToken | null {
  if (!token) return null

  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex === -1) return null

  const encodedPayload = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)

  const expectedSignature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encodedPayload)
    .digest('base64url')

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  let payload: TokenPayload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'))
  } catch {
    return null
  }

  if (typeof payload.lessonId !== 'string' || payload.lessonId !== lessonId) return null
  if (typeof payload.subject !== 'string') return null
  if (expectedUserId && payload.subject !== expectedUserId) return null

  if (!Number.isFinite(payload.exp) || Date.now() > payload.exp) return null

  return { subject: payload.subject, previewOrigin: payload.previewOrigin ?? null }
}

export const TOOL_ACCESS_TOKEN_TTL_SECONDS = Math.floor(TOKEN_TTL_MS / 1000)
