// app/api/admin/lessons/[id]/tool-embed-token/route.ts
// 後台課程編輯器「預覽」面板是 client component，沒辦法自己簽發 token（簽章要用到
// server-only 的密鑰），所以在這裡開一個小端點讓它現場要一個。
//
// 核發的 token 帶著 previewOrigin——預覽卡片即時反映講師正在輸入、還沒存檔的網址，
// 資料庫裡的 toolUrl 這時候可能還是舊的，用一般 token 會因為新舊網址對不上資料庫
// 而一直顯示 unsupported_origin，逼講師「先存檔才能預覽」。previewOrigin 讓代理
// 路由略過資料庫比對，但只放行 mint 當下這一個特定 origin，不是任意網址：
//   - 只驗證 isStaff（跟其他 tool-embed 端點一致的寬鬆判斷）不夠——這個端點會把
//     「client 傳來的網址」直接簽進 token，權限範圍比其他地方大，所以額外要求
//     這個使用者對「這堂課所屬的課程」有管理權限（requireCourseManageAccess），
//     而不是任何 ADMIN/EDITOR 都能對任何課程的任何 lesson id 核發任意 origin 的
//     token。
//   - previewOrigin 只能是這裡驗證過、正規化過的 origin，不是 client 傳來的原始
//     字串——避免夾帶多餘路徑/查詢字串或格式怪異的值進 token。

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import { signToolAccessToken } from '@/lib/tool-embed-token'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: lessonId } = await params

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { chapter: { select: { courseId: true } } },
  })
  if (!lesson) {
    return NextResponse.json({ success: false, error: '單元不存在' }, { status: 404 })
  }

  let user: { id: string }
  try {
    user = await requireCourseManageAccess(lesson.chapter.courseId)
  } catch {
    return NextResponse.json({ success: false, error: '權限不足' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const rawUrl = typeof body?.url === 'string' ? body.url : null
  if (!rawUrl) {
    return NextResponse.json({ success: false, error: '缺少要預覽的工具網址' }, { status: 400 })
  }

  let previewOrigin: string
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') {
      return NextResponse.json({ success: false, error: '工具網址必須是 https' }, { status: 400 })
    }
    previewOrigin = parsed.origin
  } catch {
    return NextResponse.json({ success: false, error: '工具網址格式不正確' }, { status: 400 })
  }

  const token = signToolAccessToken(lessonId, user.id, { previewOrigin })
  return NextResponse.json({ success: true, token })
}
