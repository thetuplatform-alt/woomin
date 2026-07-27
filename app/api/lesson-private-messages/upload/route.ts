import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  deleteStorageObject,
  getMediaUploadTarget,
  getPublicUrlForStorageKey,
  getStorageSettings,
  writeLocalUpload,
} from '@/lib/storage'
import { uploadToR2 } from '@/lib/cloudflare'
import {
  checkRateLimit,
  getIdentifier,
  getRateLimitHeaders,
} from '@/lib/rate-limit'
import { validateFileExtension } from '@/lib/validations/assignment'

export const runtime = 'nodejs'

const MAX_PRIVATE_ATTACHMENT_SIZE = 10 * 1024 * 1024
const PRIVATE_ATTACHMENT_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 10,
}
const PRIVATE_ATTACHMENT_RETENTION_MS = 24 * 60 * 60 * 1000
const PRIVATE_ATTACHMENT_USER_QUOTA_BYTES = 200 * 1024 * 1024

async function requireLessonAccess(params: {
  lessonId: string
  userId: string
}) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      chapter: {
        include: {
          course: { select: { id: true, status: true } },
        },
      },
    },
  })

  if (!lesson || lesson.chapter.course.status === 'DRAFT') {
    return { ok: false as const, status: 404, error: '單元不存在' }
  }

  if (lesson.isFree) {
    return { ok: true as const, lesson }
  }

  const purchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId: params.userId,
        courseId: lesson.chapter.course.id,
      },
    },
  })

  if (
    purchase &&
    !purchase.revokedAt &&
    (!purchase.expiresAt || purchase.expiresAt > new Date())
  ) {
    return { ok: true as const, lesson }
  }

  return { ok: false as const, status: 403, error: '您尚未購買此課程' }
}

function getMediaType(mimeType: string) {
  return mimeType.startsWith('image/') ? 'IMAGE' : 'ATTACHMENT'
}

async function cleanupStalePrivateAttachments(userId: string) {
  const cutoff = new Date(Date.now() - PRIVATE_ATTACHMENT_RETENTION_MS)
  const stale = await prisma.media.findMany({
    where: {
      uploadedBy: userId,
      sourceType: 'PRIVATE_MESSAGE',
      sourceId: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, filename: true },
    take: 50,
  })

  for (const item of stale) {
    await deleteStorageObject(item.filename).catch(() => undefined)
    await prisma.media.delete({ where: { id: item.id } }).catch(() => undefined)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const rateLimitResult = checkRateLimit(
      `private-message-upload:${getIdentifier(request, session.user.id)}`,
      PRIVATE_ATTACHMENT_RATE_LIMIT
    )
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: '上傳太頻繁，請稍後再試' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const formData = await request.formData()
    const lessonId = String(formData.get('lessonId') || '')
    const file = formData.get('file')

    if (!lessonId || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: '缺少必要參數' },
        { status: 400 }
      )
    }

    if (file.size > MAX_PRIVATE_ATTACHMENT_SIZE) {
      return NextResponse.json(
        { success: false, error: '私訊附件不能超過 10MB' },
        { status: 400 }
      )
    }

    const extensionValidation = validateFileExtension(file.name, null)
    if (!extensionValidation.valid) {
      return NextResponse.json(
        { success: false, error: extensionValidation.error || '檔案格式不允許' },
        { status: 400 }
      )
    }

    // 老師（ADMIN / INSTRUCTOR / EDITOR）可在收件匣回覆任一單元的私訊並夾帶附件，
    // 不需購買該課程；與 POST /api/lesson-private-messages 的權限判斷一致。
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isTeacher =
      currentUser?.role === 'ADMIN' ||
      currentUser?.role === 'INSTRUCTOR' ||
      currentUser?.role === 'EDITOR'

    if (!isTeacher) {
      const access = await requireLessonAccess({
        lessonId,
        userId: session.user.id,
      })
      if (!access.ok) {
        return NextResponse.json(
          { success: false, error: access.error },
          { status: access.status }
        )
      }
    }

    await cleanupStalePrivateAttachments(session.user.id)

    const usage = await prisma.media.aggregate({
      _sum: { size: true },
      where: {
        uploadedBy: session.user.id,
        sourceType: 'PRIVATE_MESSAGE',
      },
    })

    if ((usage._sum.size ?? 0) + file.size > PRIVATE_ATTACHMENT_USER_QUOTA_BYTES) {
      return NextResponse.json(
        { success: false, error: '私訊附件儲存額度已滿，請先請老師處理既有附件' },
        { status: 507 }
      )
    }

    const mimeType = file.type || 'application/octet-stream'
    const buffer = Buffer.from(await file.arrayBuffer())
    const settings = await getStorageSettings()

    let key: string
    let url: string

    if (settings.driver === 'local') {
      const target = await getMediaUploadTarget(file.name, mimeType)
      if (!target.success || !target.key) {
        throw new Error(target.error || '取得上傳資訊失敗')
      }

      const writeResult = await writeLocalUpload(target.key, buffer)
      if (!writeResult.success) {
        throw new Error(writeResult.error || '檔案寫入失敗')
      }

      key = target.key
      url = await getPublicUrlForStorageKey(key)
    } else {
      const uploadResult = await uploadToR2(buffer, file.name, mimeType)
      if (!uploadResult.success || !uploadResult.key || !uploadResult.url) {
        throw new Error(uploadResult.error || '檔案上傳失敗')
      }

      key = uploadResult.key
      url = uploadResult.url
    }

    const media = await prisma.media.create({
      data: {
        type: getMediaType(mimeType),
        filename: key,
        originalName: file.name,
        mimeType,
        size: file.size,
        url,
        uploadedBy: session.user.id,
        sourceType: 'PRIVATE_MESSAGE',
        sourceLabel: `私訊附件: ${file.name}`,
        sourceUrl: '/admin/messages',
      },
    })

    return NextResponse.json({
      success: true,
      media: {
        id: media.id,
        url: media.url,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: media.size,
      },
    })
  } catch (error) {
    console.error('私訊附件上傳失敗:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '私訊附件上傳失敗' },
      { status: 500 }
    )
  }
}
