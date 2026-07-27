import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolvePdfAccess, readPdfMediaBuffer } from '@/lib/pdf-access'
import { applyPdfWatermark } from '@/lib/pdf-watermark'
import { resolveAppUrl } from '@/lib/app-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getPdfParams(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  return {
    lessonId: searchParams.get('lessonId'),
    mediaId: searchParams.get('mediaId'),
    url: searchParams.get('url'),
    metadata: searchParams.get('metadata') === '1',
    download: searchParams.get('download') === '1',
  }
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

function buildDisposition(filename: string, download: boolean) {
  const cleanFilename = filename.replace(/["\r\n]/g, '')
  const safeFilename = cleanFilename.replace(/[^\x20-\x7E]/g, '_')
  const encoded = encodeURIComponent(cleanFilename)
  const mode = download ? 'attachment' : 'inline'

  return `${mode}; filename="${safeFilename}"; filename*=UTF-8''${encoded}`
}

export async function GET(request: NextRequest) {
  const session = await auth()
  const params = getPdfParams(request)
  const access = await resolvePdfAccess({
    lessonId: params.lessonId,
    mediaId: params.mediaId,
    url: params.url,
    user: {
      id: session?.user?.id,
      role: session?.user?.role,
      name: session?.user?.name,
      email: session?.user?.email,
    },
  })

  if (!access.success) {
    return errorResponse(access.error, access.status)
  }

  const { context } = access
  if (params.download && !context.canDownload) {
    return errorResponse('這份 PDF 已設定為僅線上閱讀，無法下載。', 403)
  }

  if (params.metadata) {
    return NextResponse.json({
      success: true,
      media: {
        id: context.media.id,
        title: context.media.originalName,
        allowDownload: context.canDownload,
        dynamicWatermarkEnabled: context.dynamicWatermarkEnabled,
      },
      lesson: {
        id: context.lesson.id,
        title: context.lesson.title,
        courseTitle: context.lesson.chapter.course.title,
      },
    })
  }

  try {
    const input = await readPdfMediaBuffer(context.media)
    const appUrl = await resolveAppUrl()
    const output = context.dynamicWatermarkEnabled
      ? await applyPdfWatermark(input, {
          sourceUrl: appUrl,
          dynamic: {
            courseTitle: context.lesson.chapter.course.title,
            fileTitle: context.media.originalName,
            userName: session?.user?.name,
            userEmail: session?.user?.email,
            userId: session?.user?.id,
            timestamp: new Date(),
          },
        })
      : input

    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(output.length),
        'Content-Disposition': buildDisposition(
          context.media.originalName || 'lesson.pdf',
          params.download
        ),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Protected PDF render failed:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'PDF 載入失敗',
      500
    )
  }
}
