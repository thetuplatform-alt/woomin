// lib/tool-embed.ts
// 課程內嵌工具共用邏輯：origin 編碼、代理路由網址組裝
// 同時給伺服器端（app/lesson-tool 頁面）與客戶端（ToolEmbed 元件）使用

/**
 * 將工具來源網域編碼為 base64url，對應 /api/lesson/tool-embed 代理路由的 decodeOrigin()
 */
export function encodeToolOrigin(origin: string): string {
  const base64 =
    typeof window === 'undefined'
      ? Buffer.from(origin, 'utf-8').toString('base64')
      : btoa(origin)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 組出代理路由的網址，保留 toolUrl 原本的路徑／查詢字串，讓工具從指定的入口頁開始，
 * 而不是永遠從網域根目錄開始（代理路由本身仍以來源網域為授權範圍）。
 *
 * accessToken 是呼叫端（getLessonContent()、app/lesson-tool 頁面、後台預覽面板）在
 * 已經確認過存取權限之後現場簽發的短效 token（見 lib/tool-embed-token.ts），直接烤
 * 進網址路徑裡，不是放 cookie——sandboxed iframe 是 opaque origin，Chrome 的第三方
 * cookie 封鎖會把它當第三方，不管 cookie 是不是 SameSite=None 都不會送出去；網址
 * 本身則不受任何 cookie 政策影響。
 */
export function buildToolEmbedSrc(lessonId: string, toolUrl: string, accessToken: string): string | null {
  try {
    const parsed = new URL(toolUrl)
    const encodedOrigin = encodeToolOrigin(parsed.origin)
    const entryPath = parsed.pathname.replace(/^\//, '')
    return `/api/lesson/tool-embed/${lessonId}/${encodedOrigin}/${accessToken}/${entryPath}${parsed.search}`
  } catch {
    return null
  }
}
