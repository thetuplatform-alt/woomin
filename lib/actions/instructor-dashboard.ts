// lib/actions/instructor-dashboard.ts
// 講師專屬儀表板 Server Action
// 僅彙總「當前講師可管理課程」的統計，避免講師看到全站營收與其他講師課程資料

'use server'

import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { getManageableCourseIds } from '@/lib/course-permissions'
import type { CourseStatus } from '@prisma/client'

export interface InstructorCourseStat {
  id: string
  title: string
  slug: string
  status: CourseStatus
  studentCount: number
  revenue: number
}

export interface InstructorRecentOrder {
  id: string
  orderNo: string
  amount: number
  createdAt: Date
  courseTitle: string
  userName: string
}

export interface InstructorDashboardData {
  totalCourses: number
  totalStudents: number
  totalRevenue: number
  courses: InstructorCourseStat[]
  recentOrders: InstructorRecentOrder[]
}

/**
 * 取得講師專屬儀表板資料（僅涵蓋自己可管理的課程）
 */
export async function getInstructorDashboard(): Promise<InstructorDashboardData> {
  const actor = await requireAdminAuth()
  const manageableCourseIds = await getManageableCourseIds(actor)

  // ADMIN 會回傳 null（代表全部），但 ADMIN 走的是全站儀表板；
  // 這裡保險處理：null 時退回擷取全部課程 id
  const courseIdList =
    manageableCourseIds ??
    (await prisma.course.findMany({ select: { id: true } })).map((c) => c.id)

  if (courseIdList.length === 0) {
    return {
      totalCourses: 0,
      totalStudents: 0,
      totalRevenue: 0,
      courses: [],
      recentOrders: [],
    }
  }

  const [courses, revenueGroups, studentGroups, distinctStudents, recentOrders] =
    await Promise.all([
      prisma.course.findMany({
        where: { id: { in: courseIdList } },
        select: { id: true, title: true, slug: true, status: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courseIdList }, status: 'PAID' },
        _sum: { amount: true },
      }),
      prisma.purchase.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courseIdList }, revokedAt: null },
        _count: { userId: true },
      }),
      prisma.purchase.findMany({
        where: { courseId: { in: courseIdList }, revokedAt: null },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Order 沒有 course/user 關聯（僅有 scalar id），需手動 join
      prisma.order.findMany({
        where: { courseId: { in: courseIdList }, status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNo: true,
          amount: true,
          createdAt: true,
          courseId: true,
          userId: true,
        },
      }),
    ])

  // 手動取得最近訂單的課程名稱與買家資訊
  const recentCourseIds = [
    ...new Set(
      recentOrders
        .map((o) => o.courseId)
        .filter((id): id is string => !!id)
    ),
  ]
  const recentUserIds = [...new Set(recentOrders.map((o) => o.userId))]
  const [recentCourseRows, recentUserRows] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: recentCourseIds } },
      select: { id: true, title: true },
    }),
    prisma.user.findMany({
      where: { id: { in: recentUserIds } },
      select: { id: true, name: true, email: true },
    }),
  ])
  const recentCourseMap = new Map(recentCourseRows.map((c) => [c.id, c.title]))
  const recentUserMap = new Map(recentUserRows.map((u) => [u.id, u]))

  const revenueByCourse = new Map(
    revenueGroups.map((g) => [g.courseId, g._sum.amount ?? 0])
  )
  const studentsByCourse = new Map(
    studentGroups.map((g) => [g.courseId, g._count.userId])
  )

  const courseStats: InstructorCourseStat[] = courses.map((course) => ({
    id: course.id,
    title: course.title,
    slug: course.slug,
    status: course.status,
    studentCount: course.id ? studentsByCourse.get(course.id) ?? 0 : 0,
    revenue: revenueByCourse.get(course.id) ?? 0,
  }))

  const totalRevenue = revenueGroups.reduce(
    (sum, g) => sum + (g._sum.amount ?? 0),
    0
  )

  return {
    totalCourses: courses.length,
    totalStudents: distinctStudents.length,
    totalRevenue,
    courses: courseStats,
    recentOrders: recentOrders.map((o) => {
      const buyer = recentUserMap.get(o.userId)
      return {
        id: o.id,
        orderNo: o.orderNo,
        amount: o.amount,
        createdAt: o.createdAt,
        courseTitle: o.courseId ? recentCourseMap.get(o.courseId) ?? '—' : '—',
        userName: buyer?.name || buyer?.email || '匿名',
      }
    }),
  }
}
