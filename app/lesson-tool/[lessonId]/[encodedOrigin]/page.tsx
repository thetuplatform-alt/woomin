// app/lesson-tool/[lessonId]/[encodedOrigin]/page.tsx
// 內嵌工具「新分頁」目的地：一個受存取權限保護、只包一個 sandboxed iframe 的 WooMin 頁面。
// 不可以讓「新分頁」直接連到代理路由或原始工具網址——前者是同源全頁導覽、完全脫離
// iframe sandbox 保護；後者會讓真正的工具網址整個出現在網址列/DOM，還會完全繞過這裡的
// 存取權檢查（分享出去的連結就永久不受未來的購買狀態變化影響）。這個頁面本身一樣會
// 檢查 checkLessonAccess，並且只把工具放進跟卡片內嵌一致的 sandboxed iframe 裡。

import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { checkLessonAccess } from '@/lib/actions/lesson'
import { resolveLessonToolConfig } from '@/lib/tool-embed-access'
import { encodeToolOrigin, buildToolEmbedSrc } from '@/lib/tool-embed'
import { signToolAccessToken } from '@/lib/tool-embed-token'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ lessonId: string; encodedOrigin: string }>
}

export default async function LessonToolPage({ params }: PageProps) {
  const { lessonId, encodedOrigin } = await params

  const session = await auth()
  const isStaff = session?.user?.role === 'ADMIN' || session?.user?.role === 'EDITOR'

  if (!isStaff) {
    const access = await checkLessonAccess(lessonId)
    if (access === 'not_logged_in') {
      redirect(`/login?callbackUrl=${encodeURIComponent(`/lesson-tool/${lessonId}/${encodedOrigin}`)}`)
    }
    if (access !== 'granted' && access !== 'free') {
      notFound()
    }
  }

  const config = await resolveLessonToolConfig(lessonId)
  if (!config) notFound()

  let allowedOrigin: string
  try {
    allowedOrigin = new URL(config.toolUrl).origin
  } catch {
    notFound()
  }

  let requestedOrigin: string | null = null
  try {
    requestedOrigin = Buffer.from(encodedOrigin, 'base64url').toString('utf-8')
  } catch {
    requestedOrigin = null
  }
  // 網址裡的 encodedOrigin 只用來確認跟這堂課目前設定的工具一致；實際嵌入網址一律以
  // 資料庫當下的 toolUrl 為準（見下方 buildToolEmbedSrc），encodedOrigin 本身不是信任來源。
  if (requestedOrigin !== allowedOrigin || encodeToolOrigin(allowedOrigin) !== encodedOrigin) {
    notFound()
  }

  const accessToken = signToolAccessToken(lessonId, session?.user?.id)
  const embedSrc = buildToolEmbedSrc(lessonId, config.toolUrl, accessToken)
  if (!embedSrc) notFound()

  const title = config.toolTitle || '課程工具'

  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        src={embedSrc}
        title={title}
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-forms allow-popups allow-downloads"
      />
    </div>
  )
}
