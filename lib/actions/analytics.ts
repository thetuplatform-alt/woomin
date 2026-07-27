// lib/actions/analytics.ts
// 銷售分析 Server Actions
// 提供銷售數據統計、趨勢分析、熱門課程排行等功能

'use server'

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import type { PaymentMethod } from '@prisma/client'

/**
 * 將 UTC 時間轉換為台灣時區 (UTC+8) 的日期字串 "YYYY-MM-DD"
 * 避免凌晨 0:00-8:00 的活動被歸類到前一天
 */
function toTWDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

/**
 * 將 UTC 時間轉換為台灣時區的小時 key "YYYY-MM-DD HH:00"
 */
function toTWHourKey(date: Date): string {
  const d = toTWDateString(date)
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    hour12: false,
  }).format(date)
  return `${d} ${h.padStart(2, '0')}:00`
}

// requireAdminAuth 從 @/lib/require-admin 引入（直接查 DB 確保角色即時生效）

/**
 * 銷售分析總覽
 */
export interface SalesAnalytics {
  // 總營收
  totalRevenue: number
  // 總訂單數
  totalOrders: number
  // 本月營收
  thisMonthRevenue: number
  // 上月營收
  lastMonthRevenue: number
  // 月營收成長率（百分比）
  monthlyGrowth: number
  // 本月訂單數
  thisMonthOrders: number
  // 上月訂單數
  lastMonthOrders: number
  // 平均客單價
  averageOrderValue: number
}

/**
 * 每日銷售資料
 */
export interface DailySales {
  date: string
  revenue: number
  orders: number
}

/**
 * 熱門商品資料（課程與組合包）
 */
export interface TopCourse {
  courseId: string
  courseTitle: string
  coverImage: string | null
  totalRevenue: number
  totalOrders: number
  itemType: 'course' | 'bundle'
}

/**
 * 付款方式統計
 */
export interface PaymentMethodStats {
  method: PaymentMethod
  label: string
  count: number
  percentage: number
}

/**
 * 取得銷售分析總覽
 */
export async function getSalesAnalytics(): Promise<SalesAnalytics> {
  await requireOnlyAdminAuth()

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

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
      where: { status: 'PAID' },
      _sum: { amount: true },
    }),
    // 本月營收
    prisma.order.aggregate({
      where: {
        status: 'PAID',
        paidAt: { gte: thisMonthStart },
      },
      _sum: { amount: true },
    }),
    // 上月營收
    prisma.order.aggregate({
      where: {
        status: 'PAID',
        paidAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
      _sum: { amount: true },
    }),
    // 總訂單數
    prisma.order.count({ where: { status: 'PAID' } }),
    // 本月訂單數
    prisma.order.count({
      where: {
        status: 'PAID',
        paidAt: { gte: thisMonthStart },
      },
    }),
    // 上月訂單數
    prisma.order.count({
      where: {
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
    monthlyGrowth = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
  } else if (thisMonthRevenue > 0) {
    monthlyGrowth = 100
  }

  // 計算平均客單價
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return {
    totalRevenue,
    totalOrders,
    thisMonthRevenue,
    lastMonthRevenue,
    monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
    thisMonthOrders,
    lastMonthOrders,
    averageOrderValue: Math.round(averageOrderValue),
  }
}

/**
 * 取得每日銷售數據（在 DB 層聚合，避免大量資料進入 Node.js）
 */
export async function getDailySales(
  startDate: string,
  endDate: string
): Promise<DailySales[]> {
  await requireOnlyAdminAuth()

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  // 在 DB 層直接按日期聚合（使用台灣時區 UTC+8）
  const rows = await prisma.$queryRaw<{ date: string; revenue: bigint; orders: bigint }[]>`
    SELECT
      TO_CHAR("paidAt" AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') AS date,
      COALESCE(SUM(amount), 0) AS revenue,
      COUNT(*) AS orders
    FROM "Order"
    WHERE status = 'PAID'
      AND "paidAt" >= ${start}
      AND "paidAt" <= ${end}
    GROUP BY date
    ORDER BY date
  `

  const dbMap = new Map(rows.map((r) => [r.date, { revenue: Number(r.revenue), orders: Number(r.orders) }]))

  // 補齊日期範圍內沒有資料的日期
  const result: DailySales[] = []
  const current = new Date(start)
  while (current <= end) {
    const dateStr = toTWDateString(current)
    const data = dbMap.get(dateStr)
    result.push({ date: dateStr, revenue: data?.revenue ?? 0, orders: data?.orders ?? 0 })
    current.setDate(current.getDate() + 1)
  }

  return result
}

/**
 * 取得熱門商品排行（課程與組合包，DB 層聚合）
 * @param limit 取前 N 名
 * @param days 可選，限制最近 N 天內的訂單（不傳則統計全部）
 */
export async function getTopCourses(limit: number = 10, days?: number): Promise<TopCourse[]> {
  await requireOnlyAdminAuth()

  let rows: {
    itemId: string
    itemType: 'course' | 'bundle'
    title: string
    coverImage: string | null
    revenue: bigint
    orders: bigint
  }[]

  if (days) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    rows = await prisma.$queryRaw`
      SELECT
        COALESCE(o."courseId", o."bundleId") AS "itemId",
        CASE WHEN o."bundleId" IS NULL THEN 'course' ELSE 'bundle' END AS "itemType",
        COALESCE(c.title, b.title) AS title,
        COALESCE(c."coverImage", b."coverImage") AS "coverImage",
        COALESCE(SUM(o.amount), 0) AS revenue,
        COUNT(*) AS orders
      FROM "Order" o
      LEFT JOIN "Course" c ON c.id = o."courseId"
      LEFT JOIN "Bundle" b ON b.id = o."bundleId"
      WHERE o.status = 'PAID'
        AND o."paidAt" >= ${startDate}
        AND (o."courseId" IS NOT NULL OR o."bundleId" IS NOT NULL)
      GROUP BY COALESCE(o."courseId", o."bundleId"), CASE WHEN o."bundleId" IS NULL THEN 'course' ELSE 'bundle' END, COALESCE(c.title, b.title), COALESCE(c."coverImage", b."coverImage")
      ORDER BY revenue DESC
      LIMIT ${limit}
    `
  } else {
    rows = await prisma.$queryRaw`
      SELECT
        COALESCE(o."courseId", o."bundleId") AS "itemId",
        CASE WHEN o."bundleId" IS NULL THEN 'course' ELSE 'bundle' END AS "itemType",
        COALESCE(c.title, b.title) AS title,
        COALESCE(c."coverImage", b."coverImage") AS "coverImage",
        COALESCE(SUM(o.amount), 0) AS revenue,
        COUNT(*) AS orders
      FROM "Order" o
      LEFT JOIN "Course" c ON c.id = o."courseId"
      LEFT JOIN "Bundle" b ON b.id = o."bundleId"
      WHERE o.status = 'PAID'
        AND (o."courseId" IS NOT NULL OR o."bundleId" IS NOT NULL)
      GROUP BY COALESCE(o."courseId", o."bundleId"), CASE WHEN o."bundleId" IS NULL THEN 'course' ELSE 'bundle' END, COALESCE(c.title, b.title), COALESCE(c."coverImage", b."coverImage")
      ORDER BY revenue DESC
      LIMIT ${limit}
    `
  }

  if (rows.length === 0) return []

  return rows.map((r) => ({
    courseId: r.itemId,
    courseTitle: r.title,
    coverImage: r.coverImage,
    totalRevenue: Number(r.revenue),
    totalOrders: Number(r.orders),
    itemType: r.itemType,
  }))
}

/**
 * 取得付款方式統計
 * @param days 可選，限制最近 N 天內的訂單（不傳則統計全部）
 */
export async function getPaymentMethodStats(days?: number): Promise<PaymentMethodStats[]> {
  await requireOnlyAdminAuth()

  // 查詢各付款方式的訂單數
  const whereClause: { status: 'PAID'; paymentMethod: { not: null }; paidAt?: { gte: Date } } = {
    status: 'PAID',
    paymentMethod: { not: null },
  }
  if (days) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)
    whereClause.paidAt = { gte: startDate }
  }

  const orders = await prisma.order.groupBy({
    by: ['paymentMethod'],
    where: whereClause,
    _count: true,
  })

  // 計算總數
  const total = orders.reduce((sum, item) => sum + item._count, 0)

  // 付款方式標籤對應
  const methodLabels: Record<PaymentMethod, string> = {
    CREDIT_CARD: '信用卡',
    APPLE_PAY: 'Apple Pay',
    GOOGLE_PAY: 'Google Pay',
    ATM: 'ATM 轉帳',
    CVS: '超商代碼',
  }

  // 轉換格式
  const result: PaymentMethodStats[] = orders
    .filter((item) => item.paymentMethod !== null)
    .map((item) => ({
      method: item.paymentMethod as PaymentMethod,
      label: methodLabels[item.paymentMethod as PaymentMethod],
      count: item._count,
      percentage: total > 0 ? Math.round((item._count / total) * 1000) / 10 : 0,
    }))

  // 按數量排序
  result.sort((a, b) => b.count - a.count)

  return result
}

/**
 * 取得最近 N 天的銷售數據（快速查詢）
 */
export async function getRecentSales(days: number = 30): Promise<DailySales[]> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days + 1)

  return getDailySales(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  )
}

/**
 * 用戶成長趨勢資料
 */
export interface UserGrowthData {
  date: string
  newUsers: number
  cumulativeUsers: number
}

/**
 * 取得用戶成長趨勢（最近 N 天，DB 層聚合）
 */
export async function getUserGrowthTrend(days: number = 30): Promise<UserGrowthData[]> {
  await requireOnlyAdminAuth()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days + 1)
  startDate.setHours(0, 0, 0, 0)

  const [baseCountResult, rows] = await Promise.all([
    prisma.user.count({
      where: { role: 'USER', createdAt: { lt: startDate } },
    }),
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT
        TO_CHAR("createdAt" AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') AS date,
        COUNT(*) AS count
      FROM "User"
      WHERE role = 'USER' AND "createdAt" >= ${startDate}
      GROUP BY date
      ORDER BY date
    `,
  ])

  const dbMap = new Map(rows.map((r) => [r.date, Number(r.count)]))

  const result: UserGrowthData[] = []
  let cumulative = baseCountResult
  const current = new Date(startDate)
  const now = new Date()

  while (current <= now) {
    const dateStr = toTWDateString(current)
    const count = dbMap.get(dateStr) || 0
    cumulative += count
    result.push({ date: dateStr, newUsers: count, cumulativeUsers: cumulative })
    current.setDate(current.getDate() + 1)
  }

  return result
}

/**
 * 平台完課率統計
 */
export interface PlatformCompletionStats {
  totalPurchases: number
  completedCourses: number
  completionRate: number
  averageProgress: number
}

/**
 * 純查詢 + 60 秒快取：完課率為全站數據（無 per-user / 隱私問題）、不需即時，
 * 而此查詢跨 Lesson/Chapter/LessonProgress/Purchase 多表 join 且無 LIMIT，成本高。
 * 快取後儀表板首屏不再每次都重算。
 * 注意：權限檢查（requireOnlyAdminAuth）必須留在快取外層 —— unstable_cache 內不可存取 cookies/headers。
 */
const getCachedPlatformCompletionStats = unstable_cache(
  async (): Promise<PlatformCompletionStats> => {
    // 在 DB 層計算每個 purchase 的完課進度
    const rows = await prisma.$queryRaw<{
      total_purchases: bigint
      completed_courses: bigint
      avg_progress: number | null
    }[]>`
    WITH course_lessons AS (
      SELECT c."courseId", COUNT(*) AS total_lessons
      FROM "Lesson" l
      JOIN "Chapter" c ON l."chapterId" = c.id
      GROUP BY c."courseId"
    ),
    user_course_completed AS (
      SELECT lp."userId", ch."courseId", COUNT(*) AS completed_lessons
      FROM "LessonProgress" lp
      JOIN "Lesson" le ON lp."lessonId" = le.id
      JOIN "Chapter" ch ON le."chapterId" = ch.id
      WHERE lp.completed = true
      GROUP BY lp."userId", ch."courseId"
    ),
    purchase_progress AS (
      SELECT
        p."userId",
        p."courseId",
        COALESCE(uc.completed_lessons, 0)::float / NULLIF(cl.total_lessons, 0) AS progress,
        CASE WHEN COALESCE(uc.completed_lessons, 0) >= cl.total_lessons AND cl.total_lessons > 0
             THEN 1 ELSE 0 END AS is_completed
      FROM "Purchase" p
      JOIN course_lessons cl ON p."courseId" = cl."courseId"
      LEFT JOIN user_course_completed uc ON p."userId" = uc."userId" AND p."courseId" = uc."courseId"
      WHERE p."revokedAt" IS NULL
    )
    SELECT
      COUNT(*) AS total_purchases,
      SUM(is_completed) AS completed_courses,
      AVG(progress) AS avg_progress
    FROM purchase_progress
  `

    const row = rows[0]
    if (!row || Number(row.total_purchases) === 0) {
      return { totalPurchases: 0, completedCourses: 0, completionRate: 0, averageProgress: 0 }
    }

    const totalPurchases = Number(row.total_purchases)
    const completedCourses = Number(row.completed_courses)

    return {
      totalPurchases,
      completedCourses,
      completionRate: Math.round((completedCourses / totalPurchases) * 1000) / 10,
      averageProgress: Math.round((row.avg_progress ?? 0) * 1000) / 10,
    }
  },
  ['platform-completion-stats'],
  { revalidate: 60 }
)

/**
 * 取得平台整體完課率統計（DB 層聚合，60 秒快取）
 */
export async function getPlatformCompletionStats(): Promise<PlatformCompletionStats> {
  await requireOnlyAdminAuth()
  return getCachedPlatformCompletionStats()
}

/**
 * 轉換漏斗步驟資料
 */
export interface FunnelStep {
  name: string
  count: number
  /** 步進轉換率：相對於上一步驟的轉換百分比 */
  conversionRate: number
  /** 整體轉換率：相對於第一步驟的轉換百分比 */
  overallConversionRate: number
}

/**
 * 每日活躍用戶資料
 */
export interface DailyActiveUsers {
  date: string
  activeUsers: number
}

/**
 * 取得每日活躍學習用戶（DB 層聚合，使用 COUNT DISTINCT）
 * 使用 WatchTimeLog 心跳記錄，在 DB 層直接統計每日不重複用戶數
 */
export async function getDailyActiveUsers(days: number = 30): Promise<DailyActiveUsers[]> {
  await requireOnlyAdminAuth()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days + 1)
  startDate.setHours(0, 0, 0, 0)

  const rows = await prisma.$queryRaw<{ date: string; active_users: bigint }[]>`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') AS date,
      COUNT(DISTINCT "userId") AS active_users
    FROM "WatchTimeLog"
    WHERE "createdAt" >= ${startDate}
    GROUP BY date
    ORDER BY date
  `

  const dbMap = new Map(rows.map((r) => [r.date, Number(r.active_users)]))

  const result: DailyActiveUsers[] = []
  const current = new Date(startDate)
  const now = new Date()

  while (current <= now) {
    const dateStr = toTWDateString(current)
    result.push({ date: dateStr, activeUsers: dbMap.get(dateStr) ?? 0 })
    current.setDate(current.getDate() + 1)
  }

  return result
}

/**
 * 精度類型：
 * - hourly: 當日，精確到小時
 * - daily: 本週/最近一個月，精確到天
 * - weekly: 最近一年，精確到週
 */
export type Granularity = 'hourly' | 'daily' | 'weekly'

/**
 * 根據天數自動決定精度
 */
function getGranularity(days: number): Granularity {
  if (days <= 1) return 'hourly'
  if (days <= 30) return 'daily'
  return 'weekly'
}

/**
 * 將日期轉為指定精度的 key（使用台灣時區）
 */
function toGranularityKey(date: Date, granularity: Granularity): string {
  if (granularity === 'hourly') {
    return toTWHourKey(date)
  }
  if (granularity === 'weekly') {
    // 取該週的週一作為 key（基於台灣時區的日期）
    const twDateStr = toTWDateString(date)
    const d = new Date(twDateStr + 'T00:00:00+08:00')
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return toTWDateString(d)
  }
  return toTWDateString(date)
}

/**
 * 建立時間桶（根據精度）
 */
function buildTimeBuckets(startDate: Date, endDate: Date, granularity: Granularity): string[] {
  const buckets: string[] = []
  const current = new Date(startDate)

  if (granularity === 'hourly') {
    current.setMinutes(0, 0, 0)
    while (current <= endDate) {
      buckets.push(toGranularityKey(current, granularity))
      current.setHours(current.getHours() + 1)
    }
  } else if (granularity === 'weekly') {
    // 對齊到週一
    const day = current.getDay()
    const diff = current.getDate() - day + (day === 0 ? -6 : 1)
    current.setDate(diff)
    while (current <= endDate) {
      buckets.push(toGranularityKey(current, granularity))
      current.setDate(current.getDate() + 7)
    }
  } else {
    while (current <= endDate) {
      buckets.push(toGranularityKey(current, granularity))
      current.setDate(current.getDate() + 1)
    }
  }

  return buckets
}

/**
 * 取得銷售趨勢（支援精度，DB 層聚合）
 */
export async function getSalesTrend(days: number): Promise<DailySales[]> {
  await requireOnlyAdminAuth()

  const granularity = getGranularity(days)
  const endDate = new Date()
  const startDate = new Date()
  if (granularity === 'hourly') {
    startDate.setHours(startDate.getHours() - 24)
  } else {
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)
  }

  // 根據精度選擇 SQL 的 date_trunc / to_char 格式
  const dateFormat = granularity === 'hourly'
    ? "YYYY-MM-DD HH24:00"
    : "YYYY-MM-DD"

  const rows = await prisma.$queryRaw<{ date: string; revenue: bigint; orders: bigint }[]>`
    SELECT
      TO_CHAR("paidAt" AT TIME ZONE 'Asia/Taipei', ${dateFormat}) AS date,
      COALESCE(SUM(amount), 0) AS revenue,
      COUNT(*) AS orders
    FROM "Order"
    WHERE status = 'PAID'
      AND "paidAt" >= ${startDate}
      AND "paidAt" <= ${endDate}
    GROUP BY date
    ORDER BY date
  `

  const dbMap = new Map(rows.map((r) => [r.date, { revenue: Number(r.revenue), orders: Number(r.orders) }]))
  const buckets = buildTimeBuckets(startDate, endDate, granularity)

  // 週精度需要合併同一週的資料
  if (granularity === 'weekly') {
    const weekMap = new Map<string, { revenue: number; orders: number }>()
    for (const [dateKey, data] of dbMap) {
      const d = new Date(dateKey + 'T00:00:00+08:00')
      const weekKey = toGranularityKey(d, 'weekly')
      const existing = weekMap.get(weekKey)
      if (existing) {
        existing.revenue += data.revenue
        existing.orders += data.orders
      } else {
        weekMap.set(weekKey, { ...data })
      }
    }
    return buckets.map((key) => ({
      date: key,
      revenue: weekMap.get(key)?.revenue ?? 0,
      orders: weekMap.get(key)?.orders ?? 0,
    }))
  }

  return buckets.map((key) => ({
    date: key,
    revenue: dbMap.get(key)?.revenue ?? 0,
    orders: dbMap.get(key)?.orders ?? 0,
  }))
}

/**
 * 取得用戶成長趨勢（支援精度，DB 層聚合）
 */
export async function getUserGrowthTrendWithGranularity(days: number): Promise<UserGrowthData[]> {
  await requireOnlyAdminAuth()

  const granularity = getGranularity(days)
  const endDate = new Date()
  const startDate = new Date()
  if (granularity === 'hourly') {
    startDate.setHours(startDate.getHours() - 24)
  } else {
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)
  }

  const dateFormat = granularity === 'hourly'
    ? "YYYY-MM-DD HH24:00"
    : "YYYY-MM-DD"

  const [baseCount, rows] = await Promise.all([
    prisma.user.count({
      where: { role: 'USER', createdAt: { lt: startDate } },
    }),
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT
        TO_CHAR("createdAt" AT TIME ZONE 'Asia/Taipei', ${dateFormat}) AS date,
        COUNT(*) AS count
      FROM "User"
      WHERE role = 'USER' AND "createdAt" >= ${startDate}
      GROUP BY date
      ORDER BY date
    `,
  ])

  const dbMap = new Map(rows.map((r) => [r.date, Number(r.count)]))
  const buckets = buildTimeBuckets(startDate, endDate, granularity)

  // 週精度需要合併
  if (granularity === 'weekly') {
    const weekMap = new Map<string, number>()
    for (const [dateKey, count] of dbMap) {
      const d = new Date(dateKey + 'T00:00:00+08:00')
      const weekKey = toGranularityKey(d, 'weekly')
      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + count)
    }
    const result: UserGrowthData[] = []
    let cumulative = baseCount
    buckets.forEach((key) => {
      const count = weekMap.get(key) || 0
      cumulative += count
      result.push({ date: key, newUsers: count, cumulativeUsers: cumulative })
    })
    return result
  }

  const result: UserGrowthData[] = []
  let cumulative = baseCount
  buckets.forEach((key) => {
    const count = dbMap.get(key) || 0
    cumulative += count
    result.push({ date: key, newUsers: count, cumulativeUsers: cumulative })
  })

  return result
}

/**
 * 取得活躍學習用戶趨勢（支援精度，DB 層 COUNT DISTINCT）
 */
export async function getActiveUsersTrend(days: number): Promise<DailyActiveUsers[]> {
  await requireOnlyAdminAuth()

  const granularity = getGranularity(days)
  const endDate = new Date()
  const startDate = new Date()
  if (granularity === 'hourly') {
    startDate.setHours(startDate.getHours() - 24)
  } else {
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)
  }

  const dateFormat = granularity === 'hourly'
    ? "YYYY-MM-DD HH24:00"
    : "YYYY-MM-DD"

  const rows = await prisma.$queryRaw<{ date: string; active_users: bigint }[]>`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'Asia/Taipei', ${dateFormat}) AS date,
      COUNT(DISTINCT "userId") AS active_users
    FROM "WatchTimeLog"
    WHERE "createdAt" >= ${startDate}
    GROUP BY date
    ORDER BY date
  `

  const dbMap = new Map(rows.map((r) => [r.date, Number(r.active_users)]))
  const buckets = buildTimeBuckets(startDate, endDate, granularity)

  // 週精度：需要注意 COUNT DISTINCT 跨日不能簡單加總
  // 但以 daily 粒度做 DISTINCT 再按週合併，會比原本拉全部心跳進 Node.js 好很多
  // 精確的跨週 DISTINCT 需要更複雜的 SQL，此處用近似值（各日 DAU 取最大值）
  if (granularity === 'weekly') {
    const weekMap = new Map<string, number>()
    for (const [dateKey, count] of dbMap) {
      const d = new Date(dateKey + 'T00:00:00+08:00')
      const weekKey = toGranularityKey(d, 'weekly')
      // 取該週各日的最大值作為近似 WAU
      weekMap.set(weekKey, Math.max(weekMap.get(weekKey) || 0, count))
    }
    return buckets.map((key) => ({
      date: key,
      activeUsers: weekMap.get(key) ?? 0,
    }))
  }

  return buckets.map((key) => ({
    date: key,
    activeUsers: dbMap.get(key) ?? 0,
  }))
}
