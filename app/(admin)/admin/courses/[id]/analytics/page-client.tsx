// app/(admin)/admin/courses/[id]/analytics/page-client.tsx
// 課程結果分析頁面的 Client 元件
// 包含互動式圖表和學員列表

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type {
  CourseSalesStats,
  CourseStudent,
  CourseDailySales,
  CoursePaymentStats,
  CourseOverview,
  ProgressDistribution,
  LessonCompletionData,
  WatchTimeDistribution,
} from '@/lib/actions/course-analytics'

import dynamic from 'next/dynamic'

interface AnalyticsPageClientProps {
  courseId: string
  salesStats: CourseSalesStats
  students: CourseStudent[]
  dailySales: CourseDailySales[]
  paymentStats: CoursePaymentStats[]
  overview: CourseOverview
  progressDistribution: ProgressDistribution[]
  lessonCompletionRates: LessonCompletionData[]
  watchTimeStats: {
    averageWatchTime: number
    totalWatchTime: number
    distribution: WatchTimeDistribution[]
  }
}

// 格式化金額
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// 格式化時間（秒 → 時:分:秒）
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours} 小時 ${minutes} 分鐘`
  }
  return `${minutes} 分鐘`
}

// 動態載入 recharts 圖表（ssr:false）：把 recharts（含 d3 依賴）移出此頁初始 chunk，
// 進頁時統計卡片先呈現、圖表背景載入。
const ChartFallback = () => (
  <div className="h-[250px] flex items-center justify-center text-caption">載入中...</div>
)
const DailySalesAreaChart = dynamic(() => import('./analytics-charts').then((m) => m.DailySalesAreaChart), {
  ssr: false,
  loading: () => <ChartFallback />,
})
const ProgressDistributionBarChart = dynamic(() => import('./analytics-charts').then((m) => m.ProgressDistributionBarChart), {
  ssr: false,
  loading: () => <ChartFallback />,
})
const LessonCompletionLineChart = dynamic(() => import('./analytics-charts').then((m) => m.LessonCompletionLineChart), {
  ssr: false,
  loading: () => <ChartFallback />,
})
const PaymentMethodPieChart = dynamic(() => import('./analytics-charts').then((m) => m.PaymentMethodPieChart), {
  ssr: false,
  loading: () => <ChartFallback />,
})

export function AnalyticsPageClient({
  salesStats,
  students,
  dailySales,
  paymentStats,
  overview,
  progressDistribution,
  lessonCompletionRates,
  watchTimeStats,
}: AnalyticsPageClientProps) {
  const [showAllStudents, setShowAllStudents] = useState(false)

  // 顯示的學員數量
  const displayedStudents = showAllStudents ? students : students.slice(0, 10)

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* 概覽統計卡片 */}
        <div
          data-tour="analytics-overview-cards"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card className="bg-white border-divider">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-body">
                總學員數
              </CardTitle>
              <Users className="h-4 w-4 text-cta" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-heading">
                {overview.totalStudents}
              </div>
              <p className="text-xs text-caption mt-1">
                已購買此課程的學員
              </p>
            </CardContent>
          </Card>

          <Card data-tour="analytics-card-revenue" className="bg-white border-divider">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-body">
                總銷售額
              </CardTitle>
              <DollarSign className="h-4 w-4 text-cta" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-heading">
                {formatCurrency(salesStats.totalRevenue)}
              </div>
              <p className="text-xs text-caption mt-1">
                本月 {formatCurrency(salesStats.thisMonthRevenue)}
                {salesStats.monthlyGrowth !== 0 && (
                  <span
                    className={cn(
                      'ml-1',
                      salesStats.monthlyGrowth > 0
                        ? 'text-emerald-600'
                        : 'text-red-500'
                    )}
                  >
                    {salesStats.monthlyGrowth > 0 ? '+' : ''}
                    {salesStats.monthlyGrowth}%
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card data-tour="analytics-card-progress" className="bg-white border-divider">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-body">
                平均完課率
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-cta" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-heading">
                {overview.averageProgress}%
              </div>
              <p className="text-xs text-caption mt-1">
                完成全部課程: {overview.completionRate}%
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-divider">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-body">
                平均觀看時間
              </CardTitle>
              <Clock className="h-4 w-4 text-cta" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-heading">
                {formatDuration(watchTimeStats.averageWatchTime)}
              </div>
              <p className="text-xs text-caption mt-1">
                每位學員平均觀看時長
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 圖表區 - 第一排 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 銷售趨勢圖 */}
          <Card className="bg-white border-divider">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-cta" />
                近 30 天銷售趨勢
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailySales.length > 0 ? (
                <DailySalesAreaChart data={dailySales} />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-caption">
                  暫無銷售數據
                </div>
              )}
            </CardContent>
          </Card>

          {/* 學員進度分佈 */}
          <Card data-tour="analytics-progress-distribution" className="bg-white border-divider">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-cta" />
                學員進度分佈
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progressDistribution.length > 0 ? (
                <ProgressDistributionBarChart data={progressDistribution} />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-caption">
                  暫無學員數據
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 圖表區 - 第二排 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 各單元完成率曲線 */}
          <Card className="bg-white border-divider lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-cta" />
                各單元完成率
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lessonCompletionRates.length > 0 ? (
                <LessonCompletionLineChart data={lessonCompletionRates} />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-caption">
                  暫無單元數據
                </div>
              )}
            </CardContent>
          </Card>

          {/* 付款方式分佈 */}
          <Card className="bg-white border-divider">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <Award className="h-5 w-5 text-cta" />
                付款方式
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentStats.length > 0 ? (
                <PaymentMethodPieChart data={paymentStats} />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-caption">
                  暫無付款數據
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 學員列表 */}
        <Card data-tour="analytics-student-list" className="bg-white border-divider">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-heading flex items-center gap-2">
              <Users className="h-5 w-5 text-cta" />
              學員列表
              <span className="text-sm font-normal text-caption">
                ({students.length} 人)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length > 0 ? (
              <div className="space-y-4">
                {/* 表頭 */}
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-caption border-b border-divider">
                  <div className="col-span-4">學員</div>
                  <div className="col-span-2">購買日期</div>
                  <div className="col-span-2">金額</div>
                  <div className="col-span-2">學習進度</div>
                  <div className="col-span-2">最後觀看</div>
                </div>

                {/* 學員列表 */}
                <div className="space-y-2">
                  {displayedStudents.map((student) => (
                    <div
                      key={student.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
                    >
                      {/* 學員資訊 */}
                      <div className="col-span-4 flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={student.image || ''} />
                          <AvatarFallback className="bg-cta text-white">
                            {student.name?.[0] || student.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-heading truncate">
                            {student.name || '未設定姓名'}
                          </p>
                          <p className="text-xs text-caption truncate">
                            {student.email}
                          </p>
                        </div>
                      </div>

                      {/* 購買日期 */}
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm text-body">
                          {format(student.purchasedAt, 'yyyy/MM/dd', {
                            locale: zhTW,
                          })}
                        </span>
                      </div>

                      {/* 金額 */}
                      <div className="col-span-2 flex items-center">
                        {student.orderAmount !== null ? (
                          <span className="text-sm text-body">
                            {formatCurrency(student.orderAmount)}
                          </span>
                        ) : (
                          <span className="text-xs text-caption bg-divider px-2 py-0.5 rounded">
                            手動授權
                          </span>
                        )}
                      </div>

                      {/* 學習進度 */}
                      <div className="col-span-2 flex items-center gap-2">
                        <Progress
                          value={student.progressPercent}
                          className="h-2 flex-1"
                        />
                        <span className="text-xs text-body min-w-[40px] text-right">
                          {student.progressPercent}%
                        </span>
                      </div>

                      {/* 最後觀看 */}
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm text-caption">
                          {student.lastWatchAt
                            ? format(student.lastWatchAt, 'MM/dd HH:mm', {
                                locale: zhTW,
                              })
                            : '尚未開始'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 展開/收合按鈕 */}
                {students.length > 10 && (
                  <div className="pt-2 border-t border-divider">
                    <Button
                      variant="ghost"
                      className="w-full text-body hover:text-heading"
                      onClick={() => setShowAllStudents(!showAllStudents)}
                    >
                      {showAllStudents ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          收合列表
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          顯示全部 {students.length} 位學員
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-[#D4D4D4] mb-4" />
                <h3 className="text-lg font-medium text-body mb-2">
                  尚無學員
                </h3>
                <p className="text-sm text-caption max-w-sm">
                  當有學員購買此課程時，他們的資訊會顯示在這裡
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
