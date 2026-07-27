'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  submitAssignmentSchema,
  saveAssignmentDraftSchema,
  resubmitAssignmentSchema,
  countWords,
  type SubmitAssignmentData,
  type SaveAssignmentDraftData,
  type ResubmitAssignmentData,
} from '@/lib/validations/assignment'
import type { AssignmentEditorMode } from '@prisma/client'
import { checkRateLimit } from '@/lib/rate-limit'

// ==================== Helper ====================

async function verifyPurchase(userId: string, courseId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { revokedAt: true, expiresAt: true },
  })

  return (
    !!purchase &&
    !purchase.revokedAt &&
    (!purchase.expiresAt || purchase.expiresAt > new Date())
  )
}

// ==================== 前台 ====================

/**
 * 取得作業（學員端）
 */
export async function getAssignmentForStudent(lessonId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: '請先登入' }
  }

  const assignment = await prisma.assignment.findUnique({
    where: { lessonId },
    include: {
      lesson: { include: { chapter: { select: { courseId: true } } } },
    },
  })

  if (!assignment) {
    return { success: true, data: null }
  }

  const hasAccess = await verifyPurchase(
    session.user.id,
    assignment.lesson.chapter.courseId
  )
  if (!hasAccess) {
    return { success: false, error: '您尚未購買此課程' }
  }

  // 取得學員的最新提交
  const submission = await prisma.assignmentSubmission.findFirst({
    where: {
      assignmentId: assignment.id,
      userId: session.user.id,
    },
    include: {
      attachments: true,
      reviews: {
        include: {
          reviewer: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { revisionNumber: 'desc' },
  })

  // 取得 server 端草稿
  const draft = await prisma.assignmentDraft.findUnique({
    where: {
      assignmentId_userId: {
        assignmentId: assignment.id,
        userId: session.user.id,
      },
    },
  })

  return {
    success: true,
    data: {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        submissionType: assignment.submissionType,
        editorMode: assignment.editorMode,
        minWords: assignment.minWords,
        maxWords: assignment.maxWords,
        maxImages: assignment.maxImages,
        maxImageSize: assignment.maxImageSize,
        maxFiles: assignment.maxFiles,
        maxFileSize: assignment.maxFileSize,
        allowedExtensions: assignment.allowedExtensions as string[] | null,
        gradingType: assignment.gradingType,
        passingScore: assignment.passingScore,
        deadline: assignment.deadline,
        allowLateSubmission: assignment.allowLateSubmission,
        allowResubmission: assignment.allowResubmission,
      },
      submission,
      draft,
    },
  }
}

/**
 * 儲存草稿（Server 端）
 */
export async function saveAssignmentDraft(data: SaveAssignmentDraftData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: '請先登入' }
  }

  // Rate limiting: 每分鐘 30 次
  const rl = checkRateLimit(`assignment-draft:${session.user.id}`, {
    windowMs: 60_000,
    maxRequests: 30,
  })
  if (!rl.success) {
    return { success: false, error: '操作過於頻繁，請稍後再試' }
  }

  const validated = saveAssignmentDraftSchema.parse(data)

  const assignment = await prisma.assignment.findUnique({
    where: { id: validated.assignmentId },
    include: { lesson: { include: { chapter: { select: { courseId: true } } } } },
  })

  if (!assignment) {
    return { success: false, error: '找不到指定的作業' }
  }

  const hasAccess = await verifyPurchase(
    session.user.id,
    assignment.lesson.chapter.courseId
  )
  if (!hasAccess) {
    return { success: false, error: '您尚未購買此課程' }
  }

  await prisma.assignmentDraft.upsert({
    where: {
      assignmentId_userId: {
        assignmentId: validated.assignmentId,
        userId: session.user.id,
      },
    },
    create: {
      assignmentId: validated.assignmentId,
      userId: session.user.id,
      content: validated.content ?? null,
      contentFormat: (validated.contentFormat as AssignmentEditorMode) ?? null,
    },
    update: {
      content: validated.content ?? null,
      contentFormat: (validated.contentFormat as AssignmentEditorMode) ?? null,
    },
  })

  return { success: true }
}

/**
 * 送出作業
 */
export async function submitAssignment(data: SubmitAssignmentData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: '請先登入' }
  }

  // Rate limiting: 每小時 10 次
  const rl = checkRateLimit(`assignment-submit:${session.user.id}`, {
    windowMs: 3600_000,
    maxRequests: 10,
  })
  if (!rl.success) {
    return { success: false, error: '提交過於頻繁，請稍後再試' }
  }

  const validated = submitAssignmentSchema.parse(data)

  const assignment = await prisma.assignment.findUnique({
    where: { id: validated.assignmentId },
    include: { lesson: { include: { chapter: { select: { courseId: true } } } } },
  })

  if (!assignment) {
    return { success: false, error: '找不到指定的作業' }
  }

  const hasAccess = await verifyPurchase(
    session.user.id,
    assignment.lesson.chapter.courseId
  )
  if (!hasAccess) {
    return { success: false, error: '您尚未購買此課程' }
  }

  // 檢查截止日
  const now = new Date()
  const isLate = assignment.deadline ? now > assignment.deadline : false
  if (isLate && !assignment.allowLateSubmission) {
    return { success: false, error: '已超過截止日期，無法提交' }
  }

  // 字數驗證
  const wordCount = validated.content ? countWords(validated.content) : 0
  if (
    assignment.submissionType === 'TEXT' ||
    assignment.submissionType === 'MIXED'
  ) {
    if (assignment.minWords && wordCount < assignment.minWords) {
      return {
        success: false,
        error: `字數不足，最少需要 ${assignment.minWords} 字（目前 ${wordCount} 字）`,
      }
    }
    if (assignment.maxWords && wordCount > assignment.maxWords) {
      return {
        success: false,
        error: `字數超過上限 ${assignment.maxWords} 字（目前 ${wordCount} 字）`,
      }
    }
  }

  // 檢查是否已有 DRAFT 提交（由上傳附件時建立）
  let submission = await prisma.assignmentSubmission.findFirst({
    where: {
      assignmentId: validated.assignmentId,
      userId: session.user.id,
      status: 'DRAFT',
    },
  })

  if (submission) {
    // 更新現有的 DRAFT
    submission = await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        content: validated.content ?? null,
        contentFormat:
          (validated.contentFormat as AssignmentEditorMode) ?? null,
        wordCount,
        status: 'SUBMITTED',
        isLate,
        submittedAt: now,
      },
    })
  } else {
    // 建立新的提交
    submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: validated.assignmentId,
        userId: session.user.id,
        content: validated.content ?? null,
        contentFormat:
          (validated.contentFormat as AssignmentEditorMode) ?? null,
        wordCount,
        status: 'SUBMITTED',
        isLate,
        submittedAt: now,
      },
    })
  }

  // 清除草稿
  await prisma.assignmentDraft
    .delete({
      where: {
        assignmentId_userId: {
          assignmentId: validated.assignmentId,
          userId: session.user.id,
        },
      },
    })
    .catch(() => {
      // 草稿可能不存在，忽略錯誤
    })

  revalidatePath(
    `/courses/${assignment.lesson.chapter.courseId}/lessons/${assignment.lessonId}`
  )

  return { success: true, data: { submissionId: submission.id } }
}

/**
 * 重新提交（退回修改後）
 */
export async function resubmitAssignment(data: ResubmitAssignmentData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: '請先登入' }
  }

  const validated = resubmitAssignmentSchema.parse(data)

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: validated.submissionId },
    include: {
      assignment: {
        include: {
          lesson: { include: { chapter: { select: { courseId: true } } } },
        },
      },
    },
  })

  if (!submission) {
    return { success: false, error: '找不到指定的提交' }
  }

  if (submission.userId !== session.user.id) {
    return { success: false, error: '無權限修改此提交' }
  }

  if (submission.status !== 'NEEDS_REVISION') {
    return { success: false, error: '此提交不在「退回修改」狀態' }
  }

  if (!submission.assignment.allowResubmission) {
    return { success: false, error: '此作業不允許重新提交' }
  }

  const wordCount = validated.content ? countWords(validated.content) : 0

  // 更新提交
  await prisma.assignmentSubmission.update({
    where: { id: validated.submissionId },
    data: {
      content: validated.content ?? submission.content,
      contentFormat:
        (validated.contentFormat as AssignmentEditorMode) ??
        submission.contentFormat,
      wordCount,
      status: 'SUBMITTED',
      revisionNumber: { increment: 1 },
      submittedAt: new Date(),
    },
  })

  // 清除草稿
  await prisma.assignmentDraft
    .delete({
      where: {
        assignmentId_userId: {
          assignmentId: submission.assignmentId,
          userId: session.user.id,
        },
      },
    })
    .catch(() => {})

  return { success: true }
}
