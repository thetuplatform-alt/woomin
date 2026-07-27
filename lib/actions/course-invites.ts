// lib/actions/course-invites.ts
// 課程邀請連結管理與驗證 helper。

'use server'

import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import { resolveAppUrl } from '@/lib/app-url'
import {
  courseInviteSchema,
  type CourseInviteFormData,
} from '@/lib/validations/course'

export type CourseInviteListItem = {
  id: string
  courseId: string
  email: string | null
  maxUses: number | null
  usedCount: number
  expiresAt: Date | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type CourseInviteInvalidReason =
  | 'MISSING_TOKEN'
  | 'NOT_FOUND'
  | 'COURSE_MISMATCH'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'MAX_USES_REACHED'
  | 'EMAIL_REQUIRED'
  | 'EMAIL_MISMATCH'

export type CourseInviteResolution =
  | {
      valid: true
      inviteId: string
      courseId: string
      courseSlug: string
      email: string | null
      emailRestricted: boolean
      maxUses: number | null
      usedCount: number
      expiresAt: Date | null
    }
  | {
      valid: false
      reason: CourseInviteInvalidReason
    }

function generateInviteToken() {
  return randomBytes(32).toString('base64url')
}

function hashInviteToken(token: string) {
  return createHash('sha256').update(token.trim()).digest('hex')
}

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase()
  return normalized || null
}

function isInviteUsable(
  invite: {
    courseId: string
    email: string | null
    maxUses: number | null
    usedCount: number
    expiresAt: Date | null
    active: boolean
  },
  options: { courseId?: string; userEmail?: string | null }
): CourseInviteInvalidReason | null {
  if (options.courseId && invite.courseId !== options.courseId) {
    return 'COURSE_MISMATCH'
  }

  if (!invite.active) {
    return 'INACTIVE'
  }

  if (invite.expiresAt && invite.expiresAt <= new Date()) {
    return 'EXPIRED'
  }

  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    return 'MAX_USES_REACHED'
  }

  if (invite.email) {
    const userEmail = normalizeEmail(options.userEmail)
    if (!userEmail) {
      return 'EMAIL_REQUIRED'
    }
    if (userEmail !== invite.email.toLowerCase()) {
      return 'EMAIL_MISMATCH'
    }
  }

  return null
}

async function logInviteAction(
  adminId: string,
  courseId: string,
  inviteId: string,
  details: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'UPDATE_COURSE',
        targetType: 'CourseInvite',
        targetId: inviteId,
        details: JSON.parse(JSON.stringify({ courseId, ...details })),
      },
    })
  } catch (error) {
    console.error('記錄課程邀請操作失敗:', error)
  }
}

export async function listCourseInvites(
  courseId: string
): Promise<{ success: boolean; invites?: CourseInviteListItem[]; error?: string }> {
  try {
    await requireCourseManageAccess(courseId)

    const invites = await prisma.courseInvite.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        courseId: true,
        email: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return { success: true, invites }
  } catch (error) {
    console.error('取得課程邀請失敗:', error)
    return { success: false, error: '取得課程邀請失敗' }
  }
}

export async function createCourseInvite(
  courseId: string,
  data: Omit<CourseInviteFormData, 'courseId'> & { courseId?: string }
): Promise<{
  success: boolean
  invite?: CourseInviteListItem
  token?: string
  inviteUrl?: string
  error?: string
}> {
  try {
    const validatedData = courseInviteSchema.parse({ ...data, courseId })
    const user = await requireCourseManageAccess(validatedData.courseId)

    const course = await prisma.course.findUnique({
      where: { id: validatedData.courseId },
      select: { id: true, slug: true, title: true },
    })

    if (!course) {
      return { success: false, error: '課程不存在' }
    }

    const token = generateInviteToken()
    const tokenHash = hashInviteToken(token)
    const email = normalizeEmail(validatedData.email)

    const invite = await prisma.courseInvite.create({
      data: {
        courseId: course.id,
        tokenHash,
        email,
        maxUses: validatedData.maxUses ?? null,
        expiresAt: validatedData.expiresAt ?? null,
        active: validatedData.active ?? true,
        createdBy: user.id as string,
      },
      select: {
        id: true,
        courseId: true,
        email: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const baseUrl = await resolveAppUrl()
    const inviteUrl = `${baseUrl}/courses/${course.slug}?invite=${encodeURIComponent(token)}`

    await logInviteAction(user.id as string, course.id, invite.id, {
      action: 'create_course_invite',
      inviteId: invite.id,
      courseTitle: course.title,
      email,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
      active: invite.active,
    })

    revalidatePath(`/admin/courses/${course.id}/invites`)
    revalidatePath(`/admin/courses/${course.id}/info`)

    return { success: true, invite, token, inviteUrl }
  } catch (error) {
    console.error('建立課程邀請失敗:', error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '建立課程邀請失敗' }
  }
}

export async function deactivateCourseInvite(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existingInvite = await prisma.courseInvite.findUnique({
      where: { id: inviteId },
      include: { course: { select: { id: true, title: true } } },
    })

    if (!existingInvite) {
      return { success: false, error: '邀請連結不存在' }
    }
    const user = await requireCourseManageAccess(existingInvite.courseId)

    await prisma.courseInvite.update({
      where: { id: inviteId },
      data: { active: false },
    })

    await logInviteAction(user.id as string, existingInvite.courseId, inviteId, {
      action: 'deactivate_course_invite',
      inviteId,
      courseTitle: existingInvite.course.title,
    })

    revalidatePath(`/admin/courses/${existingInvite.courseId}/invites`)
    revalidatePath(`/admin/courses/${existingInvite.courseId}/info`)

    return { success: true }
  } catch (error) {
    console.error('停用課程邀請失敗:', error)
    return { success: false, error: '停用課程邀請失敗' }
  }
}

export async function resolveCourseInviteToken(options: {
  token?: string | null
  courseId?: string
  courseSlug?: string
  userEmail?: string | null
}): Promise<CourseInviteResolution> {
  const token = options.token?.trim()
  if (!token) {
    return { valid: false, reason: 'MISSING_TOKEN' }
  }

  const courseWhere = options.courseSlug
    ? { course: { slug: options.courseSlug } }
    : options.courseId
      ? { courseId: options.courseId }
      : {}

  const invite = await prisma.courseInvite.findFirst({
    where: {
      tokenHash: hashInviteToken(token),
      ...courseWhere,
    },
    include: {
      course: {
        select: { id: true, slug: true },
      },
    },
  })

  if (!invite) {
    return { valid: false, reason: 'NOT_FOUND' }
  }

  const invalidReason = isInviteUsable(invite, {
    courseId: options.courseId,
    userEmail: options.userEmail,
  })

  if (invalidReason) {
    return { valid: false, reason: invalidReason }
  }

  return {
    valid: true,
    inviteId: invite.id,
    courseId: invite.courseId,
    courseSlug: invite.course.slug,
    email: invite.email,
    emailRestricted: invite.email !== null,
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    expiresAt: invite.expiresAt,
  }
}

export async function consumeCourseInviteToken(options: {
  token?: string | null
  courseId: string
  userEmail?: string | null
}): Promise<CourseInviteResolution> {
  const resolution = await resolveCourseInviteToken(options)
  if (!resolution.valid) {
    return resolution
  }

  const updated = await prisma.courseInvite.updateMany({
    where: {
      id: resolution.inviteId,
      active: true,
      OR: [{ maxUses: null }, { usedCount: { lt: resolution.maxUses ?? 0 } }],
      AND: [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      ],
    },
    data: {
      usedCount: { increment: 1 },
    },
  })

  if (updated.count === 0) {
    return { valid: false, reason: 'MAX_USES_REACHED' }
  }

  return {
    ...resolution,
    usedCount: resolution.usedCount + 1,
  }
}
