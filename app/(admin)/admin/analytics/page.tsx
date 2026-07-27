// app/(admin)/admin/analytics/page.tsx
// 銷售分析頁
// 顯示營收統計、銷售趨勢、熱門課程排行等

import { Suspense } from 'react'
import Link from 'next/link'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import {
  getSalesAnalytics,
  getRecentSales,
  getTopCourses,
  getPaymentMethodStats,
} from '@/lib/actions/analytics'
import { StatCard } from '@/components/admin/stat-card'
import { SalesChart } from '@/components/admin/analytics/sales-chart'
import { TopCoursesTable } from '@/components/admin/analytics/top-courses-table'
import { PaymentPieChart } from '@/components/admin/analytics/payment-pie-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  ArrowLeft,
  Loader2,
} from 'lucide-react'

export const metadata = {
  title: '銷售分析',
}

// 營收統計區塊
async function RevenueStatsSection() {
  const analytics = await getSalesAnalytics()

  // 決定成長率圖示和顏色
  const growthIcon =
    analytics.monthlyGrowth >= 0 ? (
      <TrendingUp className="h-4 w-4 text-cta" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    )

  const growthColor =
    analytics.monthlyGrowth >= 0 ? 'text-cta' : 'text-red-500'

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="總營收"
        value={`NT$ ${analytics.totalRevenue.toLocaleString()}`}
        icon={<DollarSign className="h-4 w-4 text-cta" />}
      />
      <StatCard
        title="本月營收"
        value={`NT$ ${analytics.thisMonthRevenue.toLocaleString()}`}
        description={
          <span className={growthColor}>
            {analytics.monthlyGrowth >= 0 ? '+' : ''}
            {analytics.monthlyGrowth}% 相比上月
          </span>
        }
        icon={growthIcon}
      />
      <StatCard
        title="總訂單數"
        value={analytics.totalOrders.toString()}
        icon={<ShoppingCart className="h-4 w-4 text-body" />}
      />
      <StatCard
        title="平均客單價"
        value={`NT$ ${analytics.averageOrderValue.toLocaleString()}`}
        icon={<DollarSign className="h-4 w-4 text-body" />}
      />
    </div>
  )
}

// 月營收比較區塊
async function MonthComparisonSection() {
  const analytics = await getSalesAnalytics()

  return (
    <Card className="bg-white border-divider">
      <CardHeader>
        <CardTitle className="text-heading">月營收比較</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* 本月 */}
          <div className="p-4 bg-surface rounded-xl border border-divider">
            <p className="text-body text-sm mb-1">本月營收</p>
            <p className="text-2xl font-bold text-cta">
              NT$ {analytics.thisMonthRevenue.toLocaleString()}
            </p>
            <p className="text-caption text-sm mt-1">
              {analytics.thisMonthOrders} 筆訂單
            </p>
          </div>

          {/* 上月 */}
          <div className="p-4 bg-surface rounded-xl border border-divider">
            <p className="text-body text-sm mb-1">上月營收</p>
            <p className="text-2xl font-bold text-heading">
              NT$ {analytics.lastMonthRevenue.toLocaleString()}
            </p>
            <p className="text-caption text-sm mt-1">
              {analytics.lastMonthOrders} 筆訂單
            </p>
          </div>
        </div>

        {/* 成長率 */}
        <div className="mt-4 p-4 bg-surface rounded-xl border border-divider flex items-center justify-between">
          <span className="text-body">月營收成長率</span>
          <span
            className={`text-lg font-bold ${
              analytics.monthlyGrowth >= 0 ? 'text-cta' : 'text-red-500'
            }`}
          >
            {analytics.monthlyGrowth >= 0 ? '+' : ''}
            {analytics.monthlyGrowth}%
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// 銷售趨勢圖區塊
async function SalesChartSection() {
  const dailySales = await getRecentSales(30)

  return <SalesChart data={dailySales} />
}

// 熱門課程區塊
async function TopCoursesSection() {
  const topCourses = await getTopCourses(5)

  return <TopCoursesTable courses={topCourses} />
}

// 付款方式統計區塊
async function PaymentStatsSection() {
  const paymentStats = await getPaymentMethodStats()

  return <PaymentPieChart data={paymentStats} />
}

// 載入中狀態
function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-[104px] bg-white border border-divider rounded-xl animate-pulse"
        />
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <Card className="bg-white border-divider">
      <CardHeader>
        <div className="h-6 w-32 bg-surface rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-caption" />
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <Card className="bg-white border-divider">
      <CardHeader>
        <div className="h-6 w-32 bg-surface rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-surface rounded animate-pulse"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function AnalyticsPage() {
  await requireOnlyAdminAuth()

  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-body hover:text-heading hover:bg-surface"
          >
            <Link href="/admin/orders">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回訂單管理
            </Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-heading">銷售分析</h2>
        <p className="text-body mt-1">
          查看營收統計、銷售趨勢和熱門課程數據
        </p>
      </div>

      {/* 營收統計 */}
      <div data-tour="analytics-revenue-stats">
        <Suspense fallback={<StatsSkeleton />}>
          <RevenueStatsSection />
        </Suspense>
      </div>

      {/* 銷售趨勢圖 */}
      <div data-tour="analytics-sales-chart">
        <Suspense fallback={<ChartSkeleton />}>
          <SalesChartSection />
        </Suspense>
      </div>

      {/* 兩欄佈局 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 月營收比較 */}
        <div data-tour="analytics-month-comparison">
          <Suspense fallback={<ChartSkeleton />}>
            <MonthComparisonSection />
          </Suspense>
        </div>

        {/* 付款方式統計 */}
        <div data-tour="analytics-payment-stats">
          <Suspense fallback={<ChartSkeleton />}>
            <PaymentStatsSection />
          </Suspense>
        </div>
      </div>

      {/* 熱門課程排行 */}
      <div data-tour="analytics-top-courses">
        <Suspense fallback={<TableSkeleton />}>
          <TopCoursesSection />
        </Suspense>
      </div>
    </div>
  )
}
