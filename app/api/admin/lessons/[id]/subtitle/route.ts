import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import {
  deleteStorageObject,
  getMediaUploadTarget,
  getPublicUrlForStorageKey,
  getStorageObjectRefFromUrl,
  writeLocalUpload,
} from '@/lib/storage'
import { validateSubtitleFile } from '@/lib/subtitle-upload'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function getLessonForEdit(id: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { chapter: { select: { courseId: true } } },
  })
  if (!lesson) return null
  await requireCourseManageAccess(lesson.chapter.courseId)
  return lesson
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const lesson = await getLessonForEdit(id)
    if (!lesson) return NextResponse.json({ success: false, error: '單元不存在' }, { status: 404 })

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > 5 * 1024 * 1024 + 256 * 1024) {
      return NextResponse.json({ success: false, error: '字幕檔不能超過 5MB' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const lang = String(formData.get('lang') || 'zh-TW').trim().slice(0, 20)
    const label = String(formData.get('label') || '繁體中文').trim().slice(0, 100)
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: '請選擇字幕檔' }, { status: 400 })
    }

    const validation = validateSubtitleFile(file.name, file.size)
    if (!validation.valid) return NextResponse.json({ success: false, error: validation.error }, { status: 400 })

    const target = await getMediaUploadTarget(`subtitles/${id}-${file.name}`, 'text/vtt')
    if (!target.success || !target.key || !target.driver) {
      return NextResponse.json({ success: false, error: target.error || '取得上傳位置失敗' }, { status: 500 })
    }

    const body = Buffer.from(await file.arrayBuffer())
    if (target.driver === 'local') {
      const result = await writeLocalUpload(target.key, body)
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    } else {
      const response = await fetch(target.uploadUrl!, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'text/vtt' },
        body,
      })
      if (!response.ok) return NextResponse.json({ success: false, error: '字幕檔上傳失敗' }, { status: 502 })
    }

    const url = await getPublicUrlForStorageKey(target.key)
    const updated = await prisma.lesson.update({
      where: { id },
      data: { subtitleUrl: url, subtitleLang: lang || 'zh-TW', subtitleLabel: label || '字幕' },
      select: { subtitleUrl: true, subtitleLang: true, subtitleLabel: true },
    })

    if (lesson.subtitleUrl) {
      const previous = await getStorageObjectRefFromUrl(lesson.subtitleUrl)
      if (previous) await deleteStorageObject(previous.key, previous.driver)
    }

    return NextResponse.json({ success: true, subtitle: updated })
  } catch (error) {
    console.error('上傳字幕失敗:', error)
    return NextResponse.json({ success: false, error: '上傳字幕失敗' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const lesson = await getLessonForEdit(id)
    if (!lesson) return NextResponse.json({ success: false, error: '單元不存在' }, { status: 404 })

    await prisma.lesson.update({
      where: { id },
      data: { subtitleUrl: null, subtitleLang: null, subtitleLabel: null },
    })
    if (lesson.subtitleUrl) {
      const previous = await getStorageObjectRefFromUrl(lesson.subtitleUrl)
      if (previous) await deleteStorageObject(previous.key, previous.driver)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('移除字幕失敗:', error)
    return NextResponse.json({ success: false, error: '移除字幕失敗' }, { status: 500 })
  }
}
