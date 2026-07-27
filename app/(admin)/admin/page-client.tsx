// app/(admin)/admin/page-client.tsx
// 後台儀表板客戶端元件
// 每張圖表卡片有獨立的時間選擇器

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { StatCard } from '@/components/admin/stat-card'
import { ChartCardWrapper, type TimePeriodDays } from '@/components/admin/analytics/chart-card-wrapper'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DollarSign,
  ShoppingCart,
  Users,
  BookOpen,
  Plus,
  ArrowRight,
  Package,
  GraduationCap,
  TrendingUp,
  Activity,
  Trophy,
  CreditCard,
  Filter,
  Boxes,
} from 'lucide-react'
import {
  getSalesTrend,
  getUserGrowthTrendWithGranularity,
  getActiveUsersTrend,
  getTopCourses,
  getPaymentMethodStats,
} from '@/lib/actions/analytics'
import { getPostHogFunnel } from '@/lib/actions/posthog-analytics'

import dynamic from 'next/dynamic'

import { UpdateBanner } from '@/components/admin/update-banner'
import type { PlatformUpdateInfo } from '@/lib/actions/platform-update'
import type { DashboardStats, RecentOrder } from '@/lib/actions/admin'
import type {
  SalesAnalytics,
  DailySales,
  TopCourse,
  PaymentMethodStats,
  UserGrowthData,
  PlatformCompletionStats,
  DailyActiveUsers,
  FunnelStep,
} from '@/lib/actions/analytics'

// 動態載入 recharts 圖表（ssr:false）：把 recharts（含 d3 依賴）移出 admin route 初始 chunk。
// 圖表資料本來就延後到 client 載入，圖表元件一併延後，首屏外殼與統計卡片不被阻塞。
const ChartFallback = ({ height }: { height: number }) => (
  <div className="flex items-center justify-center text-caption" style={{ height }}>載入中...</div>
)
const SalesTrendChart = dynamic(() => import('./dashboard-charts').then((m) => m.SalesTrendChart), {
  ssr: false,
  loading: () => <ChartFallback height={300} />,
})
const PaymentPieChart = dynamic(() => import('./dashboard-charts').then((m) => m.PaymentPieChart), {
  ssr: false,
  loading: () => <ChartFallback height={250} />,
})
const UserGrowthChart = dynamic(() => import('./dashboard-charts').then((m) => m.UserGrowthChart), {
  ssr: false,
  loading: () => <ChartFallback height={300} />,
})
const DauChart = dynamic(() => import('./dashboard-charts').then((m) => m.DauChart), {
  ssr: false,
  loading: () => <ChartFallback height={250} />,
})

// ─── 工具函式 ───

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency: 'TWD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

function formatDateStr(date: Date | string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

const orderStatusMap: Record<string, { label: string; className: string }> = {
  PENDING: { label: '待付款', className: 'text-cta' },
  PAID: { label: '已付款', className: 'text-emerald-600' },
  FAILED: { label: '付款失敗', className: 'text-red-500' },
  REFUNDED: { label: '已退款', className: 'text-caption' },
  CANCELLED: { label: '已取消', className: 'text-caption' },
}

const PIE_COLORS = ['#F5A524', '#525252', '#A3A3A3', '#E5E5E5', '#0A0A0A']
const FUNNEL_COLORS = ['#F5A524', '#E09000', '#525252', '#A3A3A3']

// ─── Props ───

interface DashboardPageClientProps {
  userName: string
  stats: DashboardStats
  salesAnalytics: SalesAnalytics
  recentOrders: RecentOrder[]
  dailySales: DailySales[]
  topCourses: TopCourse[]
  paymentMethodStats: PaymentMethodStats[]
  userGrowth: UserGrowthData[]
  completionStats: PlatformCompletionStats
  dauData: DailyActiveUsers[]
  funnelData: FunnelStep[]
  platformUpdate: PlatformUpdateInfo | null
}

// ─── 主元件 ───

export function DashboardPageClient({
  userName,
  stats,
  salesAnalytics,
  recentOrders,
  dailySales: initialDailySales,
  topCourses: initialTopCourses,
  paymentMethodStats: initialPaymentMethodStats,
  userGrowth: initialUserGrowth,
  completionStats,
  dauData: initialDauData,
  funnelData: initialFunnelData,
  platformUpdate,
}: DashboardPageClientProps) {
  // 各圖表獨立 state
  const [dailySales, setDailySales] = useState(initialDailySales)
  const [topCourses, setTopCourses] = useState(initialTopCourses)
  const [paymentMethodStats, setPaymentMethodStats] = useState(initialPaymentMethodStats)
  const [userGrowth, setUserGrowth] = useState(initialUserGrowth)
  const [dauData, setDauData] = useState(initialDauData)
  const [funnelData, setFunnelData] = useState(initialFunnelData)

  // 各圖表的載入狀態：初始為空（資料延後到掛載後載入）時顯示骨架，避免阻塞首次渲染
  const [isSalesLoading, setIsSalesLoading] = useState(initialDailySales.length === 0)
  const [isPaymentLoading, setIsPaymentLoading] = useState(initialPaymentMethodStats.length === 0)
  const [isGrowthLoading, setIsGrowthLoading] = useState(initialUserGrowth.length === 0)
  const [isDauLoading, setIsDauLoading] = useState(initialDauData.length === 0)
  const [isTopCoursesLoading, setIsTopCoursesLoading] = useState(initialTopCourses.length === 0)
  const [isFunnelLoading, setIsFunnelLoading] = useState(initialFunnelData.length === 0)

  // requestId 守衛：避免「掛載載入」與「切換期間」的非同步結果互相覆蓋（競態）
  const salesRequestId = useRef(0)
  const paymentRequestId = useRef(0)
  const growthRequestId = useRef(0)
  const dauRequestId = useRef(0)
  const topCoursesRequestId = useRef(0)
  const funnelRequestId = useRef(0)

  // 各圖表的 period change handler（皆加上 loading 與 requestId 守衛）
  const handleSalesPeriodChange = useCallback(async (days: TimePeriodDays) => {
    const requestId = ++salesRequestId.current
    setIsSalesLoading(true)
    const data = await getSalesTrend(days).catch(() => [])
    if (requestId === salesRequestId.current) {
      setDailySales(data)
      setIsSalesLoading(false)
    }
  }, [])

  const handleGrowthPeriodChange = useCallback(async (days: TimePeriodDays) => {
    const requestId = ++growthRequestId.current
    setIsGrowthLoading(true)
    const data = await getUserGrowthTrendWithGranularity(days).catch(() => [])
    if (requestId === growthRequestId.current) {
      setUserGrowth(data)
      setIsGrowthLoading(false)
    }
  }, [])

  const handleDAUPeriodChange = useCallback(async (days: TimePeriodDays) => {
    const requestId = ++dauRequestId.current
    setIsDauLoading(true)
    const data = await getActiveUsersTrend(days).catch(() => [])
    if (requestId === dauRequestId.current) {
      setDauData(data)
      setIsDauLoading(false)
    }
  }, [])

  const handleFunnelPeriodChange = useCallback(async (days: TimePeriodDays) => {
    const requestId = ++funnelRequestId.current
    setIsFunnelLoading(true)
    const data = await getPostHogFunnel(days).catch(() => [])
    if (requestId === funnelRequestId.current) {
      setFunnelData(data)
      setIsFunnelLoading(false)
    }
  }, [])

  const handleTopCoursesPeriodChange = useCallback(async (days: TimePeriodDays) => {
    const requestId = ++topCoursesRequestId.current
    setIsTopCoursesLoading(true)
    const data = await getTopCourses(5, days).catch(() => [])
    if (requestId === topCoursesRequestId.current) {
      setTopCourses(data)
      setIsTopCoursesLoading(false)
    }
  }, [])

  const handlePaymentPeriodChange = useCallback(async (days: TimePeriodDays) => {
    const requestId = ++paymentRequestId.current
    setIsPaymentLoading(true)
    const data = await getPaymentMethodStats(days).catch(() => [])
    if (requestId === paymentRequestId.current) {
      setPaymentMethodStats(data)
      setIsPaymentLoading(false)
    }
  }, [])

  // 計算訂單成長率
  const orderGrowth =
    salesAnalytics.lastMonthOrders > 0
      ? Math.round(((salesAnalytics.thisMonthOrders - salesAnalytics.lastMonthOrders) / salesAnalytics.lastMonthOrders) * 1000) / 10
      : salesAnalytics.thisMonthOrders > 0 ? 100 : 0

  useEffect(() => {
    let cancelled = false

    async function loadFunnelData() {
      const requestId = ++funnelRequestId.current
      setIsFunnelLoading(true)
      const data = await getPostHogFunnel(30).catch(() => [])
      if (!cancelled && requestId === funnelRequestId.current) {
        setFunnelData(data)
        setIsFunnelLoading(false)
      }
    }

    loadFunnelData()

    return () => {
      cancelled = true
    }
  }, [])

  // 掛載後才載入較重的圖表資料：外殼與頭部統計卡片先即時渲染，
  // 各圖表的查詢（含會全表掃描的每日學習人數）在背景各自完成、各自填入，彼此不阻塞。
  useEffect(() => {
    let cancelled = false

    const salesRid = ++salesRequestId.current
    getSalesTrend(30)
      .catch(() => [])
      .then((data) => {
        if (!cancelled && salesRid === salesRequestId.current) {
          setDailySales(data)
          setIsSalesLoading(false)
        }
      })

    const growthRid = ++growthRequestId.current
    getUserGrowthTrendWithGranularity(30)
      .catch(() => [])
      .then((data) => {
        if (!cancelled && growthRid === growthRequestId.current) {
          setUserGrowth(data)
          setIsGrowthLoading(false)
        }
      })

    const dauRid = ++dauRequestId.current
    getActiveUsersTrend(30)
      .catch(() => [])
      .then((data) => {
        if (!cancelled && dauRid === dauRequestId.current) {
          setDauData(data)
          setIsDauLoading(false)
        }
      })

    const topRid = ++topCoursesRequestId.current
    getTopCourses(5)
      .catch(() => [])
      .then((data) => {
        if (!cancelled && topRid === topCoursesRequestId.current) {
          setTopCourses(data)
          setIsTopCoursesLoading(false)
        }
      })

    const payRid = ++paymentRequestId.current
    getPaymentMethodStats()
      .catch(() => [])
      .then((data) => {
        if (!cancelled && payRid === paymentRequestId.current) {
          setPaymentMethodStats(data)
          setIsPaymentLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6 p-6">
      {/* 平台更新通知 */}
      <UpdateBanner updateInfo={platformUpdate} />

      {/* 歡迎訊息 */}
      <div data-tour="dashboard-welcome">
        <h2 className="text-xl font-bold text-heading">歡迎回來，{userName}</h2>
        <p className="text-body mt-1">這是您的課程平台營運概況</p>
      </div>

      {/* 統計卡片 */}
      <div data-tour="dashboard-stats" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="本月營收" value={formatCurrency(salesAnalytics.thisMonthRevenue)} description="本月累計營收" icon={<DollarSign className="h-4 w-4 text-caption" />}
          trend={salesAnalytics.monthlyGrowth !== 0 ? { value: Math.abs(salesAnalytics.monthlyGrowth), isPositive: salesAnalytics.monthlyGrowth > 0 } : undefined} />
        <StatCard title="本月訂單" value={salesAnalytics.thisMonthOrders} description="本月已完成訂單數" icon={<ShoppingCart className="h-4 w-4 text-caption" />}
          trend={orderGrowth !== 0 ? { value: Math.abs(orderGrowth), isPositive: orderGrowth > 0 } : undefined} />
        <StatCard title="總營收" value={formatCurrency(stats.totalRevenue)} description="累計至今" icon={<TrendingUp className="h-4 w-4 text-caption" />} />
        <StatCard title="總學員數" value={stats.totalUsers} description="已註冊學員" icon={<Users className="h-4 w-4 text-caption" />} />
        <StatCard title="平均完課率" value={`${completionStats.completionRate}%`} description={`平均進度 ${completionStats.averageProgress}%`} icon={<GraduationCap className="h-4 w-4 text-caption" />} />
        <StatCard title="課程數量" value={stats.totalCourses} description="已建立課程" icon={<BookOpen className="h-4 w-4 text-caption" />} />
      </div>

      {/* 銷售趨勢 + 付款方式 */}
      <div data-tour="dashboard-charts" className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCardWrapper title="銷售趨勢" icon={<TrendingUp className="h-5 w-5 text-body" />} onPeriodChange={handleSalesPeriodChange}>
            {isSalesLoading ? (
              <div className="flex items-center justify-center h-[300px] text-caption">載入中...</div>
            ) : dailySales.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-caption">暫無銷售數據</div>
            ) : (
              <SalesTrendChart data={dailySales} />
            )}
          </ChartCardWrapper>
        </div>

        <div>
          <ChartCardWrapper title="付款方式分布" icon={<CreditCard className="h-5 w-5 text-body" />} onPeriodChange={handlePaymentPeriodChange}>
            {isPaymentLoading ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-caption">載入中...</div>
            ) : paymentMethodStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-caption">暫無付款數據</div>
            ) : (
              <>
                <PaymentPieChart data={paymentMethodStats} />
                <div className="mt-4 space-y-2">
                  {paymentMethodStats.map((item, i) => (
                    <div key={item.method} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-divider">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-heading text-sm">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-body text-sm">{item.count} 筆</span>
                        <span className="text-heading text-sm font-medium w-16 text-right">{item.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ChartCardWrapper>
        </div>
      </div>

      {/* 用戶成長 + 每日學習人數 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCardWrapper title="用戶成長趨勢" icon={<Users className="h-5 w-5 text-body" />} onPeriodChange={handleGrowthPeriodChange}>
          {isGrowthLoading ? (
            <div className="flex items-center justify-center h-[300px] text-caption">載入中...</div>
          ) : userGrowth.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-caption">暫無用戶數據</div>
          ) : (
            <UserGrowthChart data={userGrowth} />
          )}
        </ChartCardWrapper>

        <ChartCardWrapper title="每日學習人數" icon={<Activity className="h-5 w-5 text-body" />} onPeriodChange={handleDAUPeriodChange}>
          {isDauLoading ? (
            <div className="flex items-center justify-center h-[250px] text-caption">載入中...</div>
          ) : dauData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-caption">暫無學習活動數據</div>
          ) : (
            <DauChart data={dauData} />
          )}
        </ChartCardWrapper>
      </div>

      {/* 轉換漏斗 + 熱門課程 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCardWrapper title="轉換漏斗" icon={<Filter className="h-5 w-5 text-body" />} onPeriodChange={handleFunnelPeriodChange}>
          {isFunnelLoading ? (
            <div className="flex items-center justify-center h-[300px] text-caption">載入轉換數據中...</div>
          ) : funnelData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-caption">暫無轉換數據</div>
          ) : (
            <>
              {/* 表頭 */}
              <div className="flex items-center gap-3 mb-3 px-1 text-xs text-caption">
                <span className="w-20 shrink-0">步驟</span>
                <span className="flex-1" />
                <span className="w-16 text-right shrink-0">人數</span>
                <span className="w-20 text-right shrink-0">步進轉換</span>
                <span className="w-20 text-right shrink-0">整體轉換</span>
              </div>

              {/* 漏斗列表 */}
              <div className="space-y-3">
                {funnelData.map((step, i) => {
                  const barWidth = funnelData[0]?.count > 0 ? (step.count / funnelData[0].count) * 100 : 0
                  return (
                    <div key={step.name} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-20 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                        <span className="text-heading text-sm truncate">{step.name}</span>
                      </div>
                      <div className="flex-1 h-8 bg-surface rounded-md overflow-hidden border border-[#F0F0F0]">
                        <div
                          className="h-full rounded-md transition-all duration-500"
                          style={{ width: barWidth > 0 ? `${Math.max(barWidth, 2)}%` : '0%', backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length], opacity: 0.85 }}
                        />
                      </div>
                      <span className="text-heading text-sm font-medium w-16 text-right shrink-0">{step.count.toLocaleString()}</span>
                      <span className="text-heading text-sm font-medium w-20 text-right shrink-0">{step.conversionRate}%</span>
                      <span className="text-caption text-sm w-20 text-right shrink-0">{step.overallConversionRate}%</span>
                    </div>
                  )
                })}
              </div>

              <p className="mt-4 text-xs text-caption">
                步進轉換：相對上一步的轉換率 ／ 整體轉換：相對第一步的轉換率
              </p>
            </>
          )}
        </ChartCardWrapper>

        <ChartCardWrapper title="熱門課程排行" icon={<Trophy className="h-5 w-5 text-cta" />} onPeriodChange={handleTopCoursesPeriodChange}>
          {isTopCoursesLoading ? (
            <div className="flex items-center justify-center py-12 text-caption">載入中...</div>
          ) : topCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-surface border border-divider flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-caption" />
              </div>
              <h3 className="text-lg font-medium text-heading mb-2">暫無銷售數據</h3>
              <p className="text-sm text-caption">開始銷售後，熱門課程與組合包將顯示於此</p>
            </div>
          ) : (
            <div className="rounded-xl border border-divider overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-divider bg-surface">
                    <th className="text-body text-sm font-medium w-16 text-center p-3">排名</th>
                    <th className="text-body text-sm font-medium text-left p-3">商品名稱</th>
                    <th className="text-body text-sm font-medium text-center w-24 p-3">訂單數</th>
                    <th className="text-body text-sm font-medium text-right w-32 p-3">總營收</th>
                    <th className="text-body text-sm font-medium w-16 text-right p-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {topCourses.map((course, index) => {
                    const rank = index + 1
                    const rankStyles: Record<number, string> = { 1: 'bg-cta text-white', 2: 'bg-body text-white', 3: 'bg-caption text-white' }
                    const rankStyle = rankStyles[rank] || 'bg-divider text-body'
                    return (
                      <tr key={course.courseId} className="border-t border-divider hover:bg-surface">
                        <td className="text-center p-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${rankStyle}`}>{rank}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {course.coverImage && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={course.coverImage} alt={course.courseTitle} className="w-12 h-8 object-cover rounded-lg" />
                            )}
                            <div className="min-w-0">
                              <span className="block text-heading font-medium line-clamp-1">{course.courseTitle}</span>
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-divider px-2 py-0.5 text-xs text-caption">
                                {course.itemType === 'bundle' ? <Boxes className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                                {course.itemType === 'bundle' ? '組合包' : '課程'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="text-center p-3"><span className="text-body">{course.totalOrders} 筆</span></td>
                        <td className="text-right p-3"><span className="text-cta font-medium">{formatCurrency(course.totalRevenue)}</span></td>
                        <td className="text-right p-3">
                          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface">
                            <Link href={course.itemType === 'bundle' ? `/admin/bundles/${course.courseId}` : `/admin/courses/${course.courseId}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ChartCardWrapper>
      </div>

      {/* 快速操作和最近訂單 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bg-white border-divider rounded-xl">
          <CardHeader>
            <CardTitle className="text-heading">快速操作</CardTitle>
            <CardDescription className="text-body">常用功能快捷入口</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start bg-cta hover:bg-cta-hover text-white rounded-lg">
              <Link href="/admin/courses/new"><Plus className="mr-2 h-4 w-4" />新增課程</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-divider text-body hover:bg-surface hover:text-heading rounded-lg">
              <Link href="/admin/orders"><Package className="mr-2 h-4 w-4" />查看訂單</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-divider text-body hover:bg-surface hover:text-heading rounded-lg">
              <Link href="/admin/users"><Users className="mr-2 h-4 w-4" />管理學員</Link>
            </Button>
          </CardContent>
        </Card>

        <Card data-tour="dashboard-recent-orders" className="lg:col-span-2 bg-white border-divider rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-heading">最近訂單</CardTitle>
              <CardDescription className="text-body">最新的訂單記錄</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-body hover:text-heading hover:bg-surface">
              <Link href="/admin/orders">查看全部<ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order) => {
                  const status = orderStatusMap[order.status] ?? { label: order.status, className: 'text-caption' }
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-divider">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-heading">{order.userName}</p>
                        <p className="text-xs text-body">{order.courseTitle}</p>
                        <p className="text-xs text-caption">{order.orderNo}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium text-heading">{formatCurrency(order.amount)}</p>
                        <p className={`text-xs ${status.className}`}>{status.label}</p>
                        <p className="text-xs text-caption">{formatDateStr(order.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingCart className="h-12 w-12 text-divider mb-4" />
                <p className="text-body">目前沒有訂單記錄</p>
                <p className="text-xs text-caption mt-1">當有學員購買課程時，訂單會顯示在這裡</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
