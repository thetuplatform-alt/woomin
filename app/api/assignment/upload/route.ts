import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getMediaUploadTarget,
  getStorageSettings,
  getStorageObjectMetadata,
  writeLocalUpload,
  getPublicUrlForStorageKey,
  deleteStorageObject,
  buildStorageKey,
} from '@/lib/storage'
import {
  validateFileExtension,
  FILE_SIZE_LIMITS,
  BLOCKED_EXTENSIONS,
} from '@/lib/validations/assignment'
import { SETTING_KEYS } from '@/lib/validations/settings'
import {
  checkRateLimit,
  getIdentifier,
  RATE_LIMIT_CONFIGS,
  getRateLimitHeaders,
} from '@/lib/rate-limit'
import { promises as fs } from 'fs'

type AssignmentForUpload = NonNullable<
  Awaited<ReturnType<typeof loadAssignmentForUpload>>
>

async function loadAssignmentForUpload(assignmentId: string) {
  return prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          chapter: {
            select: {
              title: true,
              courseId: true,
              course: { select: { title: true } },
            },
          },
        },
      },
    },
  })
}

async function validateAssignmentUpload(params: {
  assignment: AssignmentForUpload
  userId: string
  filename: string
  size: number
  fileType: string
}) {
  const { assignment, userId, filename, size, fileType } = params

  const purchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId: assignment.lesson.chapter.courseId,
      },
    },
    select: { revokedAt: true, expiresAt: true },
  })

  const hasAccess =
    !!purchase &&
    !purchase.revokedAt &&
    (!purchase.expiresAt || purchase.expiresAt > new Date())

  if (!hasAccess) {
    return { ok: false as const, status: 403, error: '您尚未購買此課程' }
  }

  const extValidation = validateFileExtension(
    filename,
    assignment.allowedExtensions as string[] | null
  )
  if (!extValidation.valid) {
    return {
      ok: false as const,
      status: 400,
      error: extValidation.error || '檔案格式不允許',
    }
  }

  const maxSize =
    fileType === 'image'
      ? assignment.maxImageSize ?? FILE_SIZE_LIMITS.IMAGE_MAX
      : assignment.maxFileSize ?? FILE_SIZE_LIMITS.FILE_MAX

  if (size > maxSize) {
    return {
      ok: false as const,
      status: 400,
      error: `${fileType === 'image' ? '圖片' : '檔案'}大小超過上限 ${Math.round(
        maxSize / 1024 / 1024
      )}MB`,
    }
  }

  return { ok: true as const }
}

async function validateAssignmentCountsAndQuotas(params: {
  assignment: AssignmentForUpload
  userId: string
  assignmentId: string
  fileType: string
  size: number
}) {
  const { assignment, userId, assignmentId, fileType, size } = params

  const quotaSetting = await prisma.siteSetting.findUnique({
    where: { key: SETTING_KEYS.ASSIGNMENT_STORAGE_QUOTA_GB },
  })
  const quotaBytes =
    (quotaSetting ? parseFloat(quotaSetting.value) : 10) * 1024 * 1024 * 1024

  const totalUsage = await prisma.assignmentAttachment.aggregate({
    _sum: { size: true },
  })
  if ((totalUsage._sum.size ?? 0) + size > quotaBytes) {
    return { ok: false as const, status: 507, error: '平台作業儲存空間已滿，請聯繫管理員' }
  }

  const userQuotaSetting = await prisma.siteSetting.findUnique({
    where: { key: SETTING_KEYS.ASSIGNMENT_USER_COURSE_QUOTA_MB },
  })
  const userQuotaBytes =
    (userQuotaSetting ? parseFloat(userQuotaSetting.value) : 200) * 1024 * 1024

  const userCourseUsage = await prisma.assignmentAttachment.aggregate({
    _sum: { size: true },
    where: {
      submission: {
        userId,
        assignment: {
          lesson: { chapter: { courseId: assignment.lesson.chapter.courseId } },
        },
      },
    },
  })
  if ((userCourseUsage._sum.size ?? 0) + size > userQuotaBytes) {
    return {
      ok: false as const,
      status: 507,
      error: `您在此課程的上傳額度已滿（上限 ${Math.round(userQuotaBytes / 1024 / 1024)}MB）`,
    }
  }

  const existingSubmission = await prisma.assignmentSubmission.findFirst({
    where: { assignmentId, userId, status: 'DRAFT' },
    include: { attachments: { select: { type: true } } },
  })

  if (existingSubmission) {
    const imageCount = existingSubmission.attachments.filter((a) => a.type === 'IMAGE').length
    const fileCount = existingSubmission.attachments.filter((a) => a.type === 'FILE').length

    if (
      fileType === 'image' &&
      imageCount >= (assignment.maxImages ?? FILE_SIZE_LIMITS.IMAGE_MAX_COUNT)
    ) {
      return { ok: false as const, status: 400, error: '圖片數量已達上限' }
    }
    if (
      fileType === 'file' &&
      fileCount >= (assignment.maxFiles ?? FILE_SIZE_LIMITS.FILE_MAX_COUNT)
    ) {
      return { ok: false as const, status: 400, error: '檔案數量已達上限' }
    }
  }

  return { ok: true as const }
}

async function createMediaForAssignmentAttachment(params: {
  assignment: AssignmentForUpload
  userId: string
  attachmentId: string
  filename: string
  mimeType: string
  size: number
  url: string
  fileType: string
}) {
  const { assignment, userId, attachmentId, filename, mimeType, size, url, fileType } = params

  await prisma.media.create({
    data: {
      type: fileType === 'image' ? 'IMAGE' : 'ATTACHMENT',
      filename,
      originalName: filename,
      mimeType,
      size,
      url,
      uploadedBy: userId,
      sourceType: 'ASSIGNMENT',
      sourceId: attachmentId,
      sourceLabel: `${assignment.lesson.chapter.course.title} / ${assignment.title}`,
      sourceUrl: `/admin/courses/${assignment.lesson.chapter.courseId}/curriculum`,
    },
  })
}

async function rejectS3Upload(
  key: string,
  body: { success: false; error: string },
  status: number
) {
  await deleteStorageObject(key, 's3')
  return NextResponse.json(body, { status })
}

/**
 * GET — 取得上傳目標（presigned URL 或 local upload URL）
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '請先登入' },
      { status: 401 }
    )
  }

  // Rate limiting
  const identifier = getIdentifier(request, session.user.id)
  const rateLimitResult = checkRateLimit(
    `assignment-upload:${identifier}`,
    RATE_LIMIT_CONFIGS.api
  )
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: '請求過於頻繁，請稍後再試' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const assignmentId = searchParams.get('assignmentId')
  const filename = searchParams.get('filename')
  const mimeType = searchParams.get('mimeType')
  const fileSize = searchParams.get('fileSize')
  const fileType = searchParams.get('fileType') // 'image' | 'file'

  if (!assignmentId || !filename || !mimeType || !fileSize || !fileType) {
    return NextResponse.json(
      { success: false, error: '缺少必要參數' },
      { status: 400 }
    )
  }

  const size = parseInt(fileSize, 10)
  if (isNaN(size) || size <= 0) {
    return NextResponse.json(
      { success: false, error: '無效的檔案大小' },
      { status: 400 }
    )
  }

  // 取得作業設定
  const assignment = await loadAssignmentForUpload(assignmentId)

  if (!assignment) {
    return NextResponse.json(
      { success: false, error: '找不到指定的作業' },
      { status: 404 }
    )
  }

  const uploadValidation = await validateAssignmentUpload({
    assignment,
    userId: session.user.id,
    filename,
    size,
    fileType,
  })
  if (!uploadValidation.ok) {
    return NextResponse.json(
      { success: false, error: uploadValidation.error },
      { status: uploadValidation.status }
    )
  }

  // 容量檢查 — 全站配額
  const quotaSetting = await prisma.siteSetting.findUnique({
    where: { key: SETTING_KEYS.ASSIGNMENT_STORAGE_QUOTA_GB },
  })
  const quotaBytes =
    (quotaSetting ? parseFloat(quotaSetting.value) : 10) * 1024 * 1024 * 1024

  const totalUsage = await prisma.assignmentAttachment.aggregate({
    _sum: { size: true },
  })
  if ((totalUsage._sum.size ?? 0) + size > quotaBytes) {
    return NextResponse.json(
      { success: false, error: '平台作業儲存空間已滿，請聯繫管理員' },
      { status: 507 }
    )
  }

  // 容量檢查 — 單用戶單課程配額
  const userQuotaSetting = await prisma.siteSetting.findUnique({
    where: { key: SETTING_KEYS.ASSIGNMENT_USER_COURSE_QUOTA_MB },
  })
  const userQuotaBytes =
    (userQuotaSetting ? parseFloat(userQuotaSetting.value) : 200) *
    1024 *
    1024

  const userCourseUsage = await prisma.assignmentAttachment.aggregate({
    _sum: { size: true },
    where: {
      submission: {
        userId: session.user.id,
        assignment: {
          lesson: { chapter: { courseId: assignment.lesson.chapter.courseId } },
        },
      },
    },
  })
  if ((userCourseUsage._sum.size ?? 0) + size > userQuotaBytes) {
    return NextResponse.json(
      {
        success: false,
        error: `您在此課程的上傳額度已滿（上限 ${Math.round(userQuotaBytes / 1024 / 1024)}MB）`,
      },
      { status: 507 }
    )
  }

  // 容量檢查 — 本地儲存空間預檢
  const storageSettings = await getStorageSettings()
  if (storageSettings.driver === 'local') {
    try {
      const stats = await fs.statfs(storageSettings.localRoot)
      const freeBytes = stats.bfree * stats.bsize
      if (freeBytes < 1024 * 1024 * 1024) {
        // < 1GB
        return NextResponse.json(
          { success: false, error: '伺服器儲存空間不足，請聯繫管理員' },
          { status: 507 }
        )
      }
    } catch {
      // statfs 失敗時不阻擋上傳
    }
  }

  // 已有附件數量檢查
  const existingSubmission = await prisma.assignmentSubmission.findFirst({
    where: {
      assignmentId,
      userId: session.user.id,
      status: 'DRAFT',
    },
    include: {
      _count: {
        select: { attachments: true },
      },
      attachments: {
        select: { type: true },
      },
    },
  })

  if (existingSubmission) {
    const imageCount = existingSubmission.attachments.filter(
      (a) => a.type === 'IMAGE'
    ).length
    const fileCount = existingSubmission.attachments.filter(
      (a) => a.type === 'FILE'
    ).length

    if (
      fileType === 'image' &&
      imageCount >= (assignment.maxImages ?? FILE_SIZE_LIMITS.IMAGE_MAX_COUNT)
    ) {
      return NextResponse.json(
        { success: false, error: '圖片數量已達上限' },
        { status: 400 }
      )
    }
    if (
      fileType === 'file' &&
      fileCount >= (assignment.maxFiles ?? FILE_SIZE_LIMITS.FILE_MAX_COUNT)
    ) {
      return NextResponse.json(
        { success: false, error: '檔案數量已達上限' },
        { status: 400 }
      )
    }
  }

  // 取得上傳目標
  const uploadFilename = `assignments/${assignmentId}/${session.user.id}/${filename}`
  const target = await getMediaUploadTarget(uploadFilename, mimeType)

  if (!target.success) {
    return NextResponse.json(
      { success: false, error: target.error || '取得上傳資訊失敗' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    uploadUrl: target.uploadUrl,
    key: target.key,
    driver: target.driver,
  })
}

/**
 * POST — 上傳完成後記錄附件（local driver 直接上傳 + 記錄）
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '請先登入' },
      { status: 401 }
    )
  }

  const contentType = request.headers.get('content-type') || ''

  // 判斷是 local 直接上傳 (multipart) 還是 S3 上傳後的記錄 (json)
  if (contentType.includes('multipart/form-data')) {
    // 本地儲存：直接接收檔案
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const assignmentId = formData.get('assignmentId') as string | null
    const fileType = formData.get('fileType') as string | null // 'image' | 'file'

    if (!file || !assignmentId || !fileType) {
      return NextResponse.json(
        { success: false, error: '缺少必要參數' },
        { status: 400 }
      )
    }

    const assignment = await loadAssignmentForUpload(assignmentId)
    if (!assignment) {
      return NextResponse.json(
        { success: false, error: '找不到指定的作業' },
        { status: 404 }
      )
    }

    // 副檔名二次驗證（伺服器端）
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext && BLOCKED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `不允許上傳 .${ext} 格式的檔案` },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadValidation = await validateAssignmentUpload({
      assignment,
      userId: session.user.id,
      filename: file.name,
      size: buffer.length,
      fileType,
    })
    if (!uploadValidation.ok) {
      return NextResponse.json(
        { success: false, error: uploadValidation.error },
        { status: uploadValidation.status }
      )
    }

    const quotaValidation = await validateAssignmentCountsAndQuotas({
      assignment,
      userId: session.user.id,
      assignmentId,
      fileType,
      size: buffer.length,
    })
    if (!quotaValidation.ok) {
      return NextResponse.json(
        { success: false, error: quotaValidation.error },
        { status: quotaValidation.status }
      )
    }

    // M19：本地儲存 key 必須符合 assertValidLocalStorageKey 要求的
    // `media/<單層安全字元>` 格式（見 lib/storage.ts），不能帶路徑分隔符。
    // 沿用既有的 buildStorageKey（getMediaUploadTarget 本地分支也是用這個），
    // assignmentId／userId 已經透過 assignmentAttachment.submissionId 存在
    // 資料庫關聯裡，key 本身不需要重複帶這些資訊。
    const key = buildStorageKey(file.name)

    const writeResult = await writeLocalUpload(key, buffer)
    if (!writeResult.success) {
      return NextResponse.json(
        { success: false, error: writeResult.error || '上傳失敗' },
        { status: 500 }
      )
    }

    const url = await getPublicUrlForStorageKey(key)

    // 確保有 DRAFT submission
    let submission = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId, userId: session.user.id, status: 'DRAFT' },
    })

    if (!submission) {
      submission = await prisma.assignmentSubmission.create({
        data: { assignmentId, userId: session.user.id, status: 'DRAFT' },
      })
    }

    const attachment = await prisma.assignmentAttachment.create({
      data: {
        submissionId: submission.id,
        filename: file.name,
        mimeType: file.type,
        size: buffer.length,
        url,
        storageKey: key,
        storageDriver: 'local',
        type: fileType === 'image' ? 'IMAGE' : 'FILE',
      },
    })

    await createMediaForAssignmentAttachment({
      assignment,
      userId: session.user.id,
      attachmentId: attachment.id,
      filename: file.name,
      mimeType: file.type,
      size: buffer.length,
      url,
      fileType,
    })

    return NextResponse.json({ success: true, data: attachment })
  }

  // S3 上傳完成後的記錄
  const body = await request.json()
  const { assignmentId, key, filename, mimeType, size, fileType } = body

  if (!assignmentId || !key || !filename || !mimeType || !size || !fileType) {
    return NextResponse.json(
      { success: false, error: '缺少必要參數' },
      { status: 400 }
    )
  }

  const assignment = await loadAssignmentForUpload(assignmentId)
  if (!assignment) {
    return NextResponse.json(
      { success: false, error: '找不到指定的作業' },
      { status: 404 }
    )
  }

  const metadata = await getStorageObjectMetadata(key, 's3')
  if (!metadata.success || typeof metadata.size !== 'number') {
    return rejectS3Upload(
      key,
      { success: false, error: metadata.error || '無法確認上傳檔案大小' },
      400
    )
  }

  if (metadata.size !== size) {
    return rejectS3Upload(
      key,
      { success: false, error: '上傳檔案大小與紀錄不一致，請重新上傳' },
      400
    )
  }

  const uploadValidation = await validateAssignmentUpload({
    assignment,
    userId: session.user.id,
    filename,
    size: metadata.size,
    fileType,
  })
  if (!uploadValidation.ok) {
    return rejectS3Upload(
      key,
      { success: false, error: uploadValidation.error },
      uploadValidation.status
    )
  }

  const quotaValidation = await validateAssignmentCountsAndQuotas({
    assignment,
    userId: session.user.id,
    assignmentId,
    fileType,
    size: metadata.size,
  })
  if (!quotaValidation.ok) {
    return rejectS3Upload(
      key,
      { success: false, error: quotaValidation.error },
      quotaValidation.status
    )
  }

  const url = await getPublicUrlForStorageKey(key)

  let submission = await prisma.assignmentSubmission.findFirst({
    where: { assignmentId, userId: session.user.id, status: 'DRAFT' },
  })

  if (!submission) {
    submission = await prisma.assignmentSubmission.create({
      data: { assignmentId, userId: session.user.id, status: 'DRAFT' },
    })
  }

  const attachment = await prisma.assignmentAttachment.create({
    data: {
      submissionId: submission.id,
      filename,
      mimeType,
      size,
      url,
      storageKey: key,
      storageDriver: 's3',
      type: fileType === 'image' ? 'IMAGE' : 'FILE',
    },
  })

  await createMediaForAssignmentAttachment({
    assignment,
    userId: session.user.id,
    attachmentId: attachment.id,
    filename,
    mimeType,
    size,
    url,
    fileType,
  })

  return NextResponse.json({ success: true, data: attachment })
}

/**
 * DELETE — 刪除附件
 */
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '請先登入' },
      { status: 401 }
    )
  }

  const { attachmentId } = await request.json()

  const attachment = await prisma.assignmentAttachment.findUnique({
    where: { id: attachmentId },
    include: { submission: { select: { userId: true, status: true } } },
  })

  if (!attachment) {
    return NextResponse.json(
      { success: false, error: '找不到指定的附件' },
      { status: 404 }
    )
  }

  if (attachment.submission.userId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: '無權限刪除此附件' },
      { status: 403 }
    )
  }

  if (attachment.submission.status !== 'DRAFT') {
    return NextResponse.json(
      { success: false, error: '已送出的作業無法刪除附件' },
      { status: 400 }
    )
  }

  // 刪除儲存
  const { deleteStorageObject } = await import('@/lib/storage')
  try {
    await deleteStorageObject(
      attachment.storageKey,
      attachment.storageDriver as 'local' | 's3'
    )
  } catch (error) {
    console.error('刪除儲存物件失敗:', error)
  }

  await prisma.assignmentAttachment.delete({ where: { id: attachmentId } })
  await prisma.media.deleteMany({
    where: { sourceType: 'ASSIGNMENT', sourceId: attachmentId },
  })

  return NextResponse.json({ success: true })
}
