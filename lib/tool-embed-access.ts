// lib/tool-embed-access.ts
// 課程內嵌工具的存取資料查詢——刻意不放進 lib/actions/lesson.ts（'use server' 模組）。
// 'use server' 檔案裡每一個 export 的函式，Next.js 都會註冊成可以直接從網路呼叫的
// Server Action，不管程式碼裡有沒有意圖讓它被外部呼叫、也不管呼叫端有沒有先做過權限
// 檢查。這裡的函式會回傳完整 toolUrl（後台設定的真實網址），一旦被 build 進 client
// reference manifest，任何人都能繞過 checkLessonAccess 直接要到它。用 server-only
// 標記成一般伺服器端工具函式，只能被我們自己的伺服器端程式碼（route handler／
// server component）import 呼叫，不會被註冊成獨立可呼叫的 action。
//
// 呼叫端（app/api/lesson/tool-embed 路由、app/lesson-tool 頁面）都必須先自行完成
// checkLessonAccess／isStaff 檢查，這裡的函式本身不重複檢查存取權。

import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * 取得單元設定的內嵌工具來源網域
 * 用於 /api/lesson/tool-embed 代理路由驗證：只放行這堂課實際設定的那一個網址，
 * 而不是全域白名單，避免任何登入使用者把代理路由當成任意網址的開放代理
 */
export async function resolveLessonToolOrigin(lessonId: string): Promise<string | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { toolUrl: true },
  })
  if (!lesson?.toolUrl) return null

  try {
    return new URL(lesson.toolUrl).origin
  } catch {
    return null
  }
}

/**
 * 取得單元設定的內嵌工具完整網址與標題
 */
export async function resolveLessonToolConfig(
  lessonId: string
): Promise<{ toolUrl: string; toolTitle: string | null } | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { toolUrl: true, toolTitle: true },
  })
  if (!lesson?.toolUrl) return null

  return { toolUrl: lesson.toolUrl, toolTitle: lesson.toolTitle }
}
