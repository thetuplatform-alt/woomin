import { prisma } from '@/lib/prisma'
import {
  isInstructorRole,
  requireAdminAuth,
} from '@/lib/require-admin'
import type { Prisma, UserRole } from '@prisma/client'

export type AdminActor = Awaited<ReturnType<typeof requireAdminAuth>>

export function isFullAdmin(role: UserRole | string | null | undefined) {
  return role === 'ADMIN'
}

export function manageableCourseWhereForUser(user: {
  id: string
  role: UserRole | string
}): Prisma.CourseWhereInput {
  if (isFullAdmin(user.role)) return {}

  if (!isInstructorRole(user.role)) {
    return { id: '__no_course_access__' }
  }

  // 非 ADMIN 講師（INSTRUCTOR / EDITOR）可管理的課程為以下三者之一：
  //   1. 自己建立的課程
  //   2. 被明確指派為講師的課程
  //   3.「全講師共管」課程——亦即尚未指派任何講師的課程（instructors 為空）
  //
  // 第 3 項是平台刻意設計的協作語意，與後台 UI 的「全講師共管」徽章
  // （components/admin/courses/course-table.tsx，判定 _count.instructors === 0）
  // 以及新手教學導覽（lib/tours/definitions/course-list.tour.ts）完全一致：
  // 「沒指定講師 = 所有講師都能改」。createCourse 會在講師建立課程時
  // 自動把建立者指派為講師（lib/actions/courses.ts），因此講師自建的課
  // 不會落入此分支、不會被其他講師看到。
  //
  // 安全性：只有受信任的 INSTRUCTOR / EDITOR 角色才會走到這裡（上方已 gate），
  // 一般 USER 不受影響。若 ADMIN 不希望某課程被全講師共管，只需指派任一
  // 講師（含指派 ADMIN 自己），徽章即消失、該課即退出本分支。
  //
  // ⚠️ 此分支務必與 UI 徽章的判定保持一致；若未來調整其一，另一處必須同步，
  // 否則會再次出現「徽章說全講師可管、後端卻過濾掉」的名實不符。
  return {
    OR: [
      { createdById: user.id },
      { instructors: { some: { userId: user.id } } },
      { instructors: { none: {} } },
    ],
  }
}

export async function canManageCourse(user: {
  id: string
  role: UserRole | string
}, courseId: string) {
  if (isFullAdmin(user.role)) return true

  const count = await prisma.course.count({
    where: {
      id: courseId,
      ...manageableCourseWhereForUser(user),
    },
  })

  return count > 0
}

export async function requireCourseManageAccess(courseId: string) {
  const user = await requireAdminAuth()

  if (!(await canManageCourse(user, courseId))) {
    throw new Error('沒有此課程的管理權限')
  }

  return user
}

export async function getManageableCoursesForCurrentUser() {
  const user = await requireAdminAuth()

  return prisma.course.findMany({
    where: manageableCourseWhereForUser(user),
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, slug: true },
  })
}

export async function getManageableCourseIds(user: {
  id: string
  role: UserRole | string
}) {
  if (isFullAdmin(user.role)) return null

  const courses = await prisma.course.findMany({
    where: manageableCourseWhereForUser(user),
    select: { id: true },
  })

  return courses.map((course) => course.id)
}
