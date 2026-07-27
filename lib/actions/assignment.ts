'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import { SETTING_KEYS } from '@/lib/validations/settings'
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  reviewSubmissionSchema,
  type CreateAssignmentData,
  type UpdateAssignmentData,
  type ReviewSubmissionData,
} from '@/lib/validations/assignment'
import { sendAssignmentReviewedEmail, sendAssignmentRevisionEmail } from '@/lib/email'
import { Prisma } from '@prisma/client'
import type {
  AssignmentSubmissionType,
  AssignmentEditorMode,
  AssignmentGradingType,
  AssignmentReviewStatus,
  AssignmentSubmissionStatus,
} from '@prisma/client'

// ==================== Helper ====================

async function logAdminAction(
  adminId: string,
  action: 'CREATE_ASSIGNMENT' | 'UPDATE_ASSIGNMENT' | 'DELETE_ASSIGNMENT' | 'REVIEW_ASSIGNMENT',
  targetId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType: 'Assignment',
        targetId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    })
  } catch (error) {
    console.error('記錄操作日誌失敗:', error)
  }
}

// ==================== 後台 CRUD ====================

/**
 * 建立作業
 */
export async function createAssignment(data: CreateAssignmentData) {
  const validated = createAssignmentSchema.parse(data)

  // 確認單元存在且尚未有作業
  const lesson = await prisma.lesson.findUnique({
    where: { id: validated.lessonId },
    include: { assignment: true, chapter: { select: { courseId: true } } },
  })

  if (!lesson) {
    return { success: false, error: '找不到指定的單元' }
  }
  const admin = await requireCourseManageAccess(lesson.chapter.courseId)

  if (lesson.assignment) {
    return { success: false, error: '此單元已有作業，請編輯現有作業' }
  }

  const assignment = await prisma.assignment.create({
    data: {
      lessonId: validated.lessonId,
      title: validated.title,
      description: validated.description,
      submissionType: validated.submissionType as AssignmentSubmissionType,
      editorMode: (validated.editorMode ?? 'MARKDOWN') as AssignmentEditorMode,
      minWords: validated.minWords ?? null,
      maxWords: validated.maxWords ?? null,
      maxImages: validated.maxImages ?? 10,
      maxImageSize: validated.maxImageSize ?? 10485760,
      maxFiles: validated.maxFiles ?? 5,
      maxFileSize: validated.maxFileSize ?? 10485760,
      allowedExtensions: validated.allowedExtensions ?? Prisma.JsonNull,
      gradingType: validated.gradingType as AssignmentGradingType,
      passingScore: validated.passingScore ?? 60,
      deadline: validated.deadline ?? null,
      allowLateSubmission: validated.allowLateSubmission,
      allowResubmission: validated.allowResubmission,
      autoCleanupDays: validated.autoCleanupDays ?? null,
    },
  })

  await logAdminAction(admin.id, 'CREATE_ASSIGNMENT', assignment.id, {
    lessonId: validated.lessonId,
    submissionType: validated.submissionType,
  })

  revalidatePath(`/admin/courses/${lesson.chapter.courseId}`)

  return { success: true, data: assignment }
}

/**
 * 更新作業
 */
export async function updateAssignment(data: UpdateAssignmentData) {
  const validated = updateAssignmentSchema.parse(data)

  const assignment = await prisma.assignment.findUnique({
    where: { id: validated.assignmentId },
    include: {
      lesson: { include: { chapter: { select: { courseId: true } } } },
    },
  })

  if (!assignment) {
    return { success: false, error: '找不到指定的作業' }
  }
  const admin = await requireCourseManageAccess(assignment.lesson.chapter.courseId)

  const updateData: Record<string, unknown> = {}
  const fields = [
    'title', 'description', 'submissionType', 'editorMode',
    'minWords', 'maxWords', 'maxImages', 'maxImageSize',
    'maxFiles', 'maxFileSize', 'allowedExtensions', 'gradingType',
    'passingScore', 'deadline', 'allowLateSubmission',
    'allowResubmission', 'autoCleanupDays',
  ] as const

  for (const field of fields) {
    if (validated[field] !== undefined) {
      updateData[field] = validated[field]
    }
  }

  await prisma.assignment.update({
    where: { id: validated.assignmentId },
    data: updateData,
  })

  await logAdminAction(admin.id, 'UPDATE_ASSIGNMENT', validated.assignmentId)

  revalidatePath(`/admin/courses/${assignment.lesson.chapter.courseId}`)

  return { success: true }
}

/**
 * 刪除作業
 */
export async function deleteAssignment(assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      lesson: { include: { chapter: { select: { courseId: true } } } },
      submissions: {
        include: { attachments: true },
      },
    },
  })

  if (!assignment) {
    return { success: false, error: '找不到指定的作業' }
  }
  const admin = await requireCourseManageAccess(assignment.lesson.chapter.courseId)

  // 刪除附件檔案（從儲存後端刪除）
  const { deleteStorageObject } = await import('@/lib/storage')
  for (const submission of assignment.submissions) {
    for (const attachment of submission.attachments) {
      try {
        await deleteStorageObject(
          attachment.storageKey,
          attachment.storageDriver as 'local' | 's3'
        )
      } catch (error) {
        console.error('刪除附件失敗:', error)
      }
    }
  }

  // Cascade 會自動刪除 submissions, attachments, reviews, drafts
  await prisma.assignment.delete({ where: { id: assignmentId } })

  await logAdminAction(admin.id, 'DELETE_ASSIGNMENT', assignmentId, {
    lessonId: assignment.lessonId,
  })

  revalidatePath(`/admin/courses/${assignment.lesson.chapter.courseId}`)

  return { success: true }
}

/**
 * 取得作業詳細（後台）
 */
export async function getAssignmentForAdmin(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { chapter: { select: { courseId: true } } },
  })
  if (!lesson) return { success: true, data: null }
  await requireCourseManageAccess(lesson.chapter.courseId)

  const assignment = await prisma.assignment.findUnique({
    where: { lessonId },
    include: {
      _count: { select: { submissions: true } },
    },
  })

  return { success: true, data: assignment }
}

/**
 * 取得作業提交列表（後台）
 */
export async function getAssignmentSubmissions(
  assignmentId: string,
  statusFilter?: AssignmentSubmissionStatus
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { lesson: { select: { chapter: { select: { courseId: true } } } } },
  })
  if (!assignment) return { success: false, error: '找不到指定的作業' }
  await requireCourseManageAccess(assignment.lesson.chapter.courseId)

  const where: Record<string, unknown> = {
    assignmentId,
    status: { not: 'DRAFT' as const },
  }

  if (statusFilter) {
    where.status = statusFilter
  }

  const submissions = await prisma.assignmentSubmission.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      attachments: true,
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { submittedAt: 'desc' },
  })

  return { success: true, data: submissions }
}

/**
 * 取得單份提交詳情（後台批改用）
 */
export async function getSubmissionForReview(submissionId: string) {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      attachments: true,
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      assignment: {
        include: {
          lesson: {
            include: {
              chapter: {
                include: {
                  course: { select: { id: true, title: true, slug: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (submission) {
    await requireCourseManageAccess(submission.assignment.lesson.chapter.course.id)
  }
  return { success: true, data: submission }
}

/**
 * 批改作業
 */
export async function reviewSubmission(data: ReviewSubmissionData) {
  const validated = reviewSubmissionSchema.parse(data)

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: validated.submissionId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      assignment: {
        include: {
          lesson: {
            include: {
              chapter: {
                include: {
                  course: { select: { id: true, title: true, slug: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!submission) {
    return { success: false, error: '找不到指定的提交' }
  }
  const admin = await requireCourseManageAccess(submission.assignment.lesson.chapter.course.id)

  // 建立批改紀錄
  await prisma.assignmentReview.create({
    data: {
      submissionId: validated.submissionId,
      reviewerId: admin.id,
      status: validated.status as AssignmentReviewStatus,
      feedback: validated.feedback ?? null,
      score: validated.score ?? null,
      letterGrade: validated.letterGrade ?? null,
    },
  })

  // 更新提交狀態
  const newStatus: AssignmentSubmissionStatus =
    validated.status === 'APPROVED'
      ? 'APPROVED'
      : validated.status === 'NEEDS_REVISION'
        ? 'NEEDS_REVISION'
        : 'REJECTED'

  await prisma.assignmentSubmission.update({
    where: { id: validated.submissionId },
    data: { status: newStatus },
  })

  await logAdminAction(admin.id, 'REVIEW_ASSIGNMENT', validated.submissionId, {
    status: validated.status,
    score: validated.score,
  })

  // 發送 Email 通知
  const course = submission.assignment.lesson.chapter.course
  const lessonTitle = submission.assignment.lesson.title

  try {
    if (validated.status === 'NEEDS_REVISION') {
      await sendAssignmentRevisionEmail({
        toEmail: submission.user.email,
        userName: submission.user.name ?? '學員',
        courseName: course.title,
        lessonTitle,
        feedback: validated.feedback ?? undefined,
        courseSlug: course.slug,
        lessonId: submission.assignment.lesson.id,
      })
    } else {
      await sendAssignmentReviewedEmail({
        toEmail: submission.user.email,
        userName: submission.user.name ?? '學員',
        courseName: course.title,
        lessonTitle,
        result: validated.status === 'APPROVED' ? '通過' : '未通過',
        feedback: validated.feedback ?? undefined,
        score: validated.score ?? undefined,
        letterGrade: validated.letterGrade ?? undefined,
        courseSlug: course.slug,
        lessonId: submission.assignment.lesson.id,
      })
    }
  } catch (error) {
    console.error('發送批改通知 Email 失敗:', error)
  }

  revalidatePath(`/admin/courses/${course.id}`)

  return { success: true }
}

/**
 * 取得作業附件儲存用量（後台）
 */
export async function getAssignmentStorageUsage() {
  await requireAdminAuth()

  const totalUsage = await prisma.assignmentAttachment.aggregate({
    _sum: { size: true },
  })

  const quotaSetting = await prisma.siteSetting.findUnique({
    where: { key: SETTING_KEYS.ASSIGNMENT_STORAGE_QUOTA_GB },
  })
  const quotaGB = quotaSetting ? parseFloat(quotaSetting.value) : 10
  const quotaBytes = quotaGB * 1024 * 1024 * 1024
  const usedBytes = totalUsage._sum.size ?? 0
  const usagePercent = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0

  return {
    success: true,
    data: {
      usedBytes,
      quotaBytes,
      quotaGB,
      usagePercent,
      isWarning: usagePercent >= 80,
    },
  }
}

/**
 * 取得作業統計（後台）
 */
export async function getAssignmentStatistics(assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { lesson: { select: { chapter: { select: { courseId: true } } } } },
  })
  if (!assignment) return { success: false, error: '找不到指定的作業' }
  await requireCourseManageAccess(assignment.lesson.chapter.courseId)

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId, status: { not: 'DRAFT' } },
    include: {
      reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  const total = submissions.length
  const pending = submissions.filter(
    (s) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW'
  ).length
  const approved = submissions.filter((s) => s.status === 'APPROVED').length
  const revision = submissions.filter(
    (s) => s.status === 'NEEDS_REVISION'
  ).length
  const rejected = submissions.filter((s) => s.status === 'REJECTED').length

  // 平均分數（百分制時）
  const scores = submissions
    .flatMap((s) => s.reviews)
    .map((r) => r.score)
    .filter((s): s is number => s !== null)

  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null

  return {
    success: true,
    data: {
      total,
      pending,
      approved,
      revision,
      rejected,
      averageScore,
    },
  }
}
