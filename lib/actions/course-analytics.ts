// lib/actions/course-analytics.ts
// 課程專屬分析 Server Actions
// 提供單一課程的銷售數據、學員統計等

'use server'

import { prisma } from '@/lib/prisma'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import type { PaymentMethod } from '@prisma/client'

/**
 * 課程銷售統計
 */
export interface CourseSalesStats {
  // 總營收
  totalRevenue: number
  // 總訂單數
  totalOrders: number
  // 本月營收
  thisMonthRevenue: number
  // 本月訂單數
  thisMonthOrders: number
  // 上月營收
  lastMonthRevenue: number
  // 上月訂單數
  lastMonthOrders: number
  // 月營收成長率（百分比）
  monthlyGrowth: number
  // 平均客單價
  averageOrderValue: number
}

/**
 * 課程學員資訊
 */
export interface CourseStudent {
  id: string
  name: string | null
  email: string
  image: string | null
  purchasedAt: Date
  orderId: string | null
  orderAmount: number | null
  grantedBy: string | null
  // 學習進度
  completedLessons: number
  totalLessons: number
  progressPercent: number
  lastWatchAt: Date | null
}

/**
 * 每日銷售資料
 */
export interface CourseDailySales {
  date: string
  revenue: number
  orders: number
}

/**
 * 付款方式統計
 */
export interface CoursePaymentStats {
  method: PaymentMethod
  label: string
  count: number
  percentage: number
  revenue: number
}

/**
 * 取得課程銷售統計
 */
export async function getCourseSalesStats(
  courseId: string
): Promise<CourseSalesStats> {
  await requireCourseManageAccess(courseId)

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999
  )

  // 並行查詢各項統計
  const [
    totalResult,
    thisMonthResult,
    lastMonthResult,
    totalOrders,
    thisMonthOrders,
    lastMonthOrders,
  ] = await Promise.all([
    // 總營收
    prisma.order.aggregate({
      where: { courseId, status: 'PAID' },
      _sum: { amount: true },
    }),
    // 本月營收
    prisma.order.aggregate({
      where: {
        courseId,
        status: 'PAID',
        paidAt: { gte: thisMonthStart },
      },
      _sum: { amount: true },
    }),
    // 上月營收
    prisma.order.aggregate({
      where: {
        courseId,
        status: 'PAID',
        paidAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
      _sum: { amount: true },
    }),
    // 總訂單數
    prisma.order.count({ where: { courseId, status: 'PAID' } }),
    // 本月訂單數
    prisma.order.count({
      where: {
        courseId,
        status: 'PAID',
        paidAt: { gte: thisMonthStart },
      },
    }),
    // 上月訂單數
    prisma.order.count({
      where: {
        courseId,
        status: 'PAID',
        paidAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    }),
  ])

  const totalRevenue = totalResult._sum.amount || 0
  const thisMonthRevenue = thisMonthResult._sum.amount || 0
  const lastMonthRevenue = lastMonthResult._sum.amount || 0

  // 計算月成長率
  let monthlyGrowth = 0
  if (lastMonthRevenue > 0) {
    monthlyGrowth =
      ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
  } else if (thisMonthRevenue > 0) {
    monthlyGrowth = 100
  }

  // 計算平均客單價
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return {
    totalRevenue,
    totalOrders,
    thisMonthRevenue,
    thisMonthOrders,
    lastMonthRevenue,
    lastMonthOrders,
    monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
    averageOrderValue: Math.round(averageOrderValue),
  }
}

/**
 * 取得課程學員列表
 */
export async function getCourseStudents(
  courseId: string
): Promise<CourseStudent[]> {
  await requireCourseManageAccess(courseId)

  // 取得課程的所有單元數量
  const totalLessons = await prisma.lesson.count({
    where: {
      chapter: {
        courseId,
      },
    },
  })

  // 取得購買記錄
  const purchases = await prisma.purchase.findMany({
    where: {
      courseId,
      revokedAt: null, // 排除已撤銷的
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // 取得訂單資訊
  const orderIds = purchases
    .map((p) => p.orderId)
    .filter((id): id is string => id !== null)

  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      status: 'PAID',
    },
    select: {
      id: true,
      amount: true,
    },
  })

  const orderMap = new Map(orders.map((o) => [o.id, o]))

  // 取得所有學員的學習進度
  const userIds = purchases.map((p) => p.userId)

  // 取得課程所有單元 ID
  const lessonIds = await prisma.lesson.findMany({
    where: {
      chapter: {
        courseId,
      },
    },
    select: {
      id: true,
    },
  })

  const lessonIdSet = new Set(lessonIds.map((l) => l.id))

  // 取得學員的進度
  const progresses = await prisma.lessonProgress.findMany({
    where: {
      userId: { in: userIds },
      lessonId: { in: Array.from(lessonIdSet) },
      completed: true,
    },
    select: {
      userId: true,
      lessonId: true,
      lastWatchAt: true,
    },
  })

  // 統計每個學員的完成數量和最後觀看時間
  const userProgressMap = new Map<
    string,
    { completed: number; lastWatchAt: Date | null }
  >()

  for (const progress of progresses) {
    const existing = userProgressMap.get(progress.userId)
    if (existing) {
      existing.completed++
      if (
        progress.lastWatchAt &&
        (!existing.lastWatchAt || progress.lastWatchAt > existing.lastWatchAt)
      ) {
        existing.lastWatchAt = progress.lastWatchAt
      }
    } else {
      userProgressMap.set(progress.userId, {
        completed: 1,
        lastWatchAt: progress.lastWatchAt,
      })
    }
  }

  // 組合結果
  const students: CourseStudent[] = purchases.map((purchase) => {
    const order = purchase.orderId ? orderMap.get(purchase.orderId) : null
    const progress = userProgressMap.get(purchase.userId) || {
      completed: 0,
      lastWatchAt: null,
    }

    return {
      id: purchase.user.id,
      name: purchase.user.name,
      email: purchase.user.email,
      image: purchase.user.image,
      purchasedAt: purchase.createdAt,
      orderId: purchase.orderId,
      orderAmount: order?.amount ?? null,
      grantedBy: purchase.grantedBy,
      completedLessons: progress.completed,
      totalLessons,
      progressPercent:
        totalLessons > 0
          ? Math.round((progress.completed / totalLessons) * 100)
          : 0,
      lastWatchAt: progress.lastWatchAt,
    }
  })

  return students
}

/**
 * 取得課程每日銷售數據
 */
export async function getCourseDailySales(
  courseId: string,
  days: number = 30
): Promise<CourseDailySales[]> {
  await requireCourseManageAccess(courseId)

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days + 1)
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  // 查詢期間內已付款的訂單
  const orders = await prisma.order.findMany({
    where: {
      courseId,
      status: 'PAID',
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      amount: true,
      paidAt: true,
    },
  })

  // L50：以台灣時區（UTC+8）切日，與全站分析（AT TIME ZONE 'Asia/Taipei'）一致，
  // 避免台灣凌晨 0-8 時的付款被歸到前一天。
  const toTaipeiDateStr = (d: Date) =>
    new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

  // 建立日期範圍內的所有日期
  const dateMap = new Map<string, { revenue: number; orders: number }>()
  const current = new Date(startDate)

  while (current <= endDate) {
    const dateStr = toTaipeiDateStr(current)
    dateMap.set(dateStr, { revenue: 0, orders: 0 })
    current.setDate(current.getDate() + 1)
  }

  // 統計每日數據
  orders.forEach((order) => {
    if (order.paidAt) {
      const dateStr = toTaipeiDateStr(order.paidAt)
      const existing = dateMap.get(dateStr)
      if (existing) {
        existing.revenue += order.amount
        existing.orders += 1
      }
    }
  })

  // 轉換為陣列格式
  const result: CourseDailySales[] = []
  dateMap.forEach((value, key) => {
    result.push({
      date: key,
      revenue: value.revenue,
      orders: value.orders,
    })
  })

  // 按日期排序
  result.sort((a, b) => a.date.localeCompare(b.date))

  return result
}

/**
 * 取得課程付款方式統計
 */
export async function getCoursePaymentStats(
  courseId: string
): Promise<CoursePaymentStats[]> {
  await requireCourseManageAccess(courseId)

  // 查詢各付款方式的訂單數和金額
  const orders = await prisma.order.findMany({
    where: {
      courseId,
      status: 'PAID',
      paymentMethod: { not: null },
    },
    select: {
      paymentMethod: true,
      amount: true,
    },
  })

  // 統計每種付款方式
  const statsMap = new Map<
    PaymentMethod,
    { count: number; revenue: number }
  >()

  orders.forEach((order) => {
    if (order.paymentMethod) {
      const existing = statsMap.get(order.paymentMethod)
      if (existing) {
        existing.count++
        existing.revenue += order.amount
      } else {
        statsMap.set(order.paymentMethod, { count: 1, revenue: order.amount })
      }
    }
  })

  // 計算總數
  const total = orders.length

  // 付款方式標籤對應
  const methodLabels: Record<PaymentMethod, string> = {
    CREDIT_CARD: '信用卡',
    APPLE_PAY: 'Apple Pay',
    GOOGLE_PAY: 'Google Pay',
    ATM: 'ATM 轉帳',
    CVS: '超商代碼',
  }

  // 轉換格式
  const result: CoursePaymentStats[] = []
  statsMap.forEach((stats, method) => {
    result.push({
      method,
      label: methodLabels[method],
      count: stats.count,
      percentage: total > 0 ? Math.round((stats.count / total) * 1000) / 10 : 0,
      revenue: stats.revenue,
    })
  })

  // 按數量排序
  result.sort((a, b) => b.count - a.count)

  return result
}

/**
 * 取得課程概覽統計（用於快速顯示）
 */
export interface CourseOverview {
  totalStudents: number
  totalRevenue: number
  averageProgress: number
  completionRate: number
}

export async function getCourseOverview(
  courseId: string
): Promise<CourseOverview> {
  await requireCourseManageAccess(courseId)

  // 並行查詢
  const [studentCount, revenueResult, totalLessons, purchases] =
    await Promise.all([
      // 學員數
      prisma.purchase.count({
        where: { courseId, revokedAt: null },
      }),
      // 總營收
      prisma.order.aggregate({
        where: { courseId, status: 'PAID' },
        _sum: { amount: true },
      }),
      // 總單元數
      prisma.lesson.count({
        where: {
          chapter: { courseId },
        },
      }),
      // 購買記錄（用於計算進度）
      prisma.purchase.findMany({
        where: { courseId, revokedAt: null },
        select: { userId: true },
      }),
    ])

  // 如果沒有學員，返回預設值
  if (studentCount === 0 || totalLessons === 0) {
    return {
      totalStudents: studentCount,
      totalRevenue: revenueResult._sum.amount || 0,
      averageProgress: 0,
      completionRate: 0,
    }
  }

  // 取得所有單元 ID
  const lessonIds = await prisma.lesson.findMany({
    where: { chapter: { courseId } },
    select: { id: true },
  })

  const lessonIdArray = lessonIds.map((l) => l.id)
  const userIds = purchases.map((p) => p.userId)

  // 取得所有學員的完成進度
  const completedProgresses = await prisma.lessonProgress.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      lessonId: { in: lessonIdArray },
      completed: true,
    },
    _count: true,
  })

  // 計算平均進度和完成率
  let totalProgress = 0
  let completedStudents = 0

  const progressMap = new Map(completedProgresses.map((p) => [p.userId, p._count]))

  for (const userId of userIds) {
    const completed = progressMap.get(userId) || 0
    const progress = (completed / totalLessons) * 100
    totalProgress += progress

    if (completed >= totalLessons) {
      completedStudents++
    }
  }

  return {
    totalStudents: studentCount,
    totalRevenue: revenueResult._sum.amount || 0,
    averageProgress: Math.round(totalProgress / studentCount),
    completionRate: Math.round((completedStudents / studentCount) * 100),
  }
}

/**
 * 學員進度分佈資料（用於長條圖/分佈圖）
 */
export interface ProgressDistribution {
  // 進度區間 (例如: "0-10%", "11-20%", ...)
  range: string
  // 該區間的學員數
  count: number
  // 該區間的百分比
  percentage: number
}

/**
 * 各單元完成率資料（用於曲線圖）
 */
export interface LessonCompletionData {
  lessonId: string
  lessonTitle: string
  chapterTitle: string
  order: number
  completedCount: number
  totalStudents: number
  completionRate: number
}

/**
 * 學員觀看時間分佈
 */
export interface WatchTimeDistribution {
  range: string
  count: number
  percentage: number
}

/**
 * 取得學員進度分佈
 * 顯示各進度區間的學員數量
 */
export async function getStudentProgressDistribution(
  courseId: string
): Promise<ProgressDistribution[]> {
  await requireCourseManageAccess(courseId)

  // 取得課程單元數
  const totalLessons = await prisma.lesson.count({
    where: { chapter: { courseId } },
  })

  if (totalLessons === 0) {
    return []
  }

  // 取得所有購買學員
  const purchases = await prisma.purchase.findMany({
    where: { courseId, revokedAt: null },
    select: { userId: true },
  })

  if (purchases.length === 0) {
    return []
  }

  const userIds = purchases.map((p) => p.userId)

  // 取得課程所有單元 ID
  const lessonIds = await prisma.lesson.findMany({
    where: { chapter: { courseId } },
    select: { id: true },
  })

  const lessonIdArray = lessonIds.map((l) => l.id)

  // 取得每個學員的完成數量
  const completedProgresses = await prisma.lessonProgress.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      lessonId: { in: lessonIdArray },
      completed: true,
    },
    _count: true,
  })

  const progressMap = new Map(
    completedProgresses.map((p) => [p.userId, p._count])
  )

  // 建立進度分佈區間 (0%, 1-25%, 26-50%, 51-75%, 76-99%, 100%)
  const ranges = [
    { label: '尚未開始', min: 0, max: 0 },
    { label: '1-25%', min: 1, max: 25 },
    { label: '26-50%', min: 26, max: 50 },
    { label: '51-75%', min: 51, max: 75 },
    { label: '76-99%', min: 76, max: 99 },
    { label: '已完成', min: 100, max: 100 },
  ]

  const distribution = ranges.map((r) => ({
    range: r.label,
    count: 0,
    percentage: 0,
  }))

  // 統計各區間學員數
  for (const userId of userIds) {
    const completed = progressMap.get(userId) || 0
    const progressPercent = Math.round((completed / totalLessons) * 100)

    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      if (progressPercent >= range.min && progressPercent <= range.max) {
        distribution[i].count++
        break
      }
    }
  }

  // 計算百分比
  const totalStudents = userIds.length
  for (const item of distribution) {
    item.percentage =
      totalStudents > 0
        ? Math.round((item.count / totalStudents) * 1000) / 10
        : 0
  }

  return distribution
}

/**
 * 取得各單元完成率
 * 用於顯示學員在哪個單元流失
 */
export async function getLessonCompletionRates(
  courseId: string
): Promise<LessonCompletionData[]> {
  await requireCourseManageAccess(courseId)

  // 取得課程所有章節和單元
  const chapters = await prisma.chapter.findMany({
    where: { courseId },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          order: true,
        },
      },
    },
    orderBy: { order: 'asc' },
  })

  // 取得學員總數
  const totalStudents = await prisma.purchase.count({
    where: { courseId, revokedAt: null },
  })

  if (totalStudents === 0) {
    return []
  }

  // 取得所有單元的完成數量
  const lessonIds = chapters.flatMap((c) => c.lessons.map((l) => l.id))

  const completionCounts = await prisma.lessonProgress.groupBy({
    by: ['lessonId'],
    where: {
      lessonId: { in: lessonIds },
      completed: true,
    },
    _count: true,
  })

  const completionMap = new Map(
    completionCounts.map((c) => [c.lessonId, c._count])
  )

  // 組合結果
  const result: LessonCompletionData[] = []
  let globalOrder = 0

  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      globalOrder++
      const completedCount = completionMap.get(lesson.id) || 0

      result.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        chapterTitle: chapter.title,
        order: globalOrder,
        completedCount,
        totalStudents,
        completionRate: Math.round((completedCount / totalStudents) * 100),
      })
    }
  }

  return result
}

/**
 * 取得學員觀看時間統計
 */
export async function getStudentWatchTimeStats(courseId: string): Promise<{
  averageWatchTime: number
  totalWatchTime: number
  distribution: WatchTimeDistribution[]
}> {
  await requireCourseManageAccess(courseId)

  // 取得課程所有單元 ID
  const lessonIds = await prisma.lesson.findMany({
    where: { chapter: { courseId } },
    select: { id: true },
  })

  const lessonIdArray = lessonIds.map((l) => l.id)

  // 取得購買學員
  const purchases = await prisma.purchase.findMany({
    where: { courseId, revokedAt: null },
    select: { userId: true },
  })

  if (purchases.length === 0) {
    return {
      averageWatchTime: 0,
      totalWatchTime: 0,
      distribution: [],
    }
  }

  const userIds = purchases.map((p) => p.userId)

  // 取得每個學員的總觀看時間
  const watchTimes = await prisma.lessonProgress.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      lessonId: { in: lessonIdArray },
    },
    _sum: {
      watchedSec: true,
    },
  })

  const watchTimeMap = new Map(
    watchTimes.map((w) => [w.userId, w._sum.watchedSec || 0])
  )

  // 計算總觀看時間和平均
  let totalWatchTime = 0
  const userWatchTimes: number[] = []

  for (const userId of userIds) {
    const watchTime = watchTimeMap.get(userId) || 0
    totalWatchTime += watchTime
    userWatchTimes.push(watchTime)
  }

  const averageWatchTime = Math.round(totalWatchTime / userIds.length)

  // 建立觀看時間分佈區間（以分鐘為單位）
  const ranges = [
    { label: '0 分鐘', min: 0, max: 0 },
    { label: '1-30 分鐘', min: 1, max: 30 * 60 },
    { label: '31-60 分鐘', min: 30 * 60 + 1, max: 60 * 60 },
    { label: '1-2 小時', min: 60 * 60 + 1, max: 2 * 60 * 60 },
    { label: '2-5 小時', min: 2 * 60 * 60 + 1, max: 5 * 60 * 60 },
    { label: '5 小時以上', min: 5 * 60 * 60 + 1, max: Infinity },
  ]

  const distribution: WatchTimeDistribution[] = ranges.map((r) => ({
    range: r.label,
    count: 0,
    percentage: 0,
  }))

  // 統計各區間
  for (const watchTime of userWatchTimes) {
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      if (watchTime >= range.min && watchTime <= range.max) {
        distribution[i].count++
        break
      }
    }
  }

  // 計算百分比
  for (const item of distribution) {
    item.percentage =
      userIds.length > 0
        ? Math.round((item.count / userIds.length) * 1000) / 10
        : 0
  }

  return {
    averageWatchTime,
    totalWatchTime,
    distribution,
  }
}
