// app/(admin)/admin/courses/[id]/analytics/page.tsx
// 課程結果分析頁面
// 顯示銷售數據、學員統計、觀看分佈等

import { notFound } from 'next/navigation'
import { getCourseById } from '@/lib/actions/courses'
import {
  getCourseSalesStats,
  getCourseStudents,
  getCourseDailySales,
  getCoursePaymentStats,
  getCourseOverview,
  getStudentProgressDistribution,
  getLessonCompletionRates,
  getStudentWatchTimeStats,
} from '@/lib/actions/course-analytics'
import { AnalyticsPageClient } from './page-client'

export const metadata = {
  title: '結果分析',
}

interface AnalyticsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params

  // 驗證課程存在
  const course = await getCourseById(id)
  if (!course) {
    notFound()
  }

  // 並行獲取所有分析資料
  const [
    salesStats,
    students,
    dailySales,
    paymentStats,
    overview,
    progressDistribution,
    lessonCompletionRates,
    watchTimeStats,
  ] = await Promise.all([
    getCourseSalesStats(id),
    getCourseStudents(id),
    getCourseDailySales(id, 30),
    getCoursePaymentStats(id),
    getCourseOverview(id),
    getStudentProgressDistribution(id),
    getLessonCompletionRates(id),
    getStudentWatchTimeStats(id),
  ])

  return (
    <AnalyticsPageClient
      courseId={id}
      salesStats={salesStats}
      students={students}
      dailySales={dailySales}
      paymentStats={paymentStats}
      overview={overview}
      progressDistribution={progressDistribution}
      lessonCompletionRates={lessonCompletionRates}
      watchTimeStats={watchTimeStats}
    />
  )
}
