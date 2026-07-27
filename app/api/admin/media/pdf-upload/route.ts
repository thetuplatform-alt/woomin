import { NextRequest, NextResponse } from 'next/server'
import { createMedia } from '@/lib/actions/media'
import { requireAdminAuth } from '@/lib/require-admin'
import { canManageCourse, isFullAdmin } from '@/lib/course-permissions'
import { prisma } from '@/lib/prisma'
import {
  getMediaUploadTarget,
  getPublicUrlForStorageKey,
  writeLocalUpload,
} from '@/lib/storage'
import { applyPdfWatermark } from '@/lib/pdf-watermark'

export const runtime = 'nodejs'

function sanitizeFilename(filename: string) {
  return filename.replace(/[/\\]+/g, '-')
}

async function uploadBuffer(params: {
  filename: string
  mimeType: string
  buffer: Buffer
}) {
  const target = await getMediaUploadTarget(params.filename, params.mimeType)
  if (!target.success || !target.key || !target.uploadUrl || !target.driver) {
    return {
      success: false,
      error: target.error || '取得上傳位置失敗',
    }
  }

  if (target.driver === 'local') {
    const result = await writeLocalUpload(target.key, params.buffer)
    if (!result.success) {
      return { success: false, error: result.error || 'PDF 儲存失敗' }
    }
  } else {
    const upload = await fetch(target.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': params.mimeType },
      body: new Uint8Array(params.buffer),
    })
    if (!upload.ok) {
      return { success: false, error: 'PDF 儲存失敗' }
    }
  }

  const url = await getPublicUrlForStorageKey(target.key)
  return {
    success: true,
    key: target.key,
    url,
  }
}

export async function POST(request: NextRequest) {
  // 權限檢查（直接查 DB 角色，確保即時生效）
  let actor: Awaited<ReturnType<typeof requireAdminAuth>>
  try {
    actor = await requireAdminAuth()
  } catch {
    return NextResponse.json({ success: false, error: '權限不足' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const watermark = formData.get('watermark') !== 'false'
  const allowDownload = formData.get('allowDownload') !== 'false'
  const dynamicWatermarkEnabled = formData.get('dynamicWatermarkEnabled') === 'true'
  const sourceId = formData.get('sourceId')?.toString() || null
  const sourceUrl = formData.get('sourceUrl')?.toString() || null

  // 講師只能把 PDF 講義掛到自己可管理課程的單元
  if (sourceId && !isFullAdmin(actor.role)) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: sourceId },
      select: { chapter: { select: { courseId: true } } },
    })
    if (!lesson || !(await canManageCourse(actor, lesson.chapter.courseId))) {
      return NextResponse.json(
        { success: false, error: '沒有此單元所屬課程的管理權限' },
        { status: 403 }
      )
    }
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: '缺少 PDF 檔案' }, { status: 400 })
  }

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ success: false, error: '請上傳 PDF 檔案' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'PDF 大小不能超過 50MB' }, { status: 400 })
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer())
  const outputBuffer = watermark
    ? await applyPdfWatermark(originalBuffer, { sourceUrl })
    : originalBuffer
  const originalName = sanitizeFilename(file.name)
  const storageName = watermark
    ? `watermarked-${originalName}`
    : originalName

  const uploaded = await uploadBuffer({
    filename: storageName,
    mimeType: 'application/pdf',
    buffer: outputBuffer,
  })

  if (!uploaded.success || !uploaded.key || !uploaded.url) {
    return NextResponse.json(
      { success: false, error: uploaded.error || 'PDF 上傳失敗' },
      { status: 500 }
    )
  }

  const mediaResult = await createMedia({
    type: 'ATTACHMENT',
    filename: uploaded.key,
    originalName,
    mimeType: 'application/pdf',
    size: outputBuffer.length,
    url: uploaded.url,
    sourceType: 'LESSON_CONTENT',
    sourceId,
    sourceLabel: watermark
      ? `PDF 講義（已後製浮水印）: ${originalName}`
      : `PDF 講義: ${originalName}`,
    sourceUrl,
    allowDownload,
    dynamicWatermarkEnabled,
  })

  if (!mediaResult.success) {
    return NextResponse.json(
      { success: false, error: mediaResult.error || '建立 PDF 紀錄失敗' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    media: mediaResult.media,
    url: uploaded.url,
    watermarked: watermark,
  })
}
