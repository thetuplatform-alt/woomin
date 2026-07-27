// app/(admin)/admin/page.tsx
// 後台儀表板頁面
// 取得所有統計數據並傳入客戶端元件渲染

import { requireAdminAuth } from '@/lib/require-admin'
import { getDashboardStats, getRecentOrders } from '@/lib/actions/admin'
import {
  getSalesAnalytics,
  getPlatformCompletionStats,
} from '@/lib/actions/analytics'
import { getInstructorDashboard } from '@/lib/actions/instructor-dashboard'
import { checkForPlatformUpdate } from '@/lib/actions/platform-update'
import { DashboardPageClient } from './page-client'
import { InstructorDashboard } from '@/components/admin/instructor-dashboard'

export const metadata = {
  title: '儀表板',
}

export default async function AdminDashboardPage() {
  const actor = await requireAdminAuth()
  const userName = actor.name ?? '管理員'

  // 講師只看到自己負責課程的概況，不顯示全站營收與其他講師課程資料
  if (actor.role !== 'ADMIN') {
    const instructorData = await getInstructorDashboard()
    return <InstructorDashboard userName={actor.name ?? '講師'} data={instructorData} />
  }

  // 僅在伺服器端取得「外殼 + 頭部統計卡片」所需的輕量資料，
  // 讓切換到儀表板時能即時渲染、不被重查詢卡住。
  // 較重的趨勢圖表（銷售趨勢、付款方式、用戶成長、每日學習人數、熱門課程、轉換漏斗）
  // 一律延後到 client 掛載後各自背景載入（見 page-client.tsx）。
  const [
    stats,
    salesAnalytics,
    recentOrders,
    completionStats,
    platformUpdate,
  ] = await Promise.all([
    getDashboardStats(),
    getSalesAnalytics(),
    getRecentOrders(5),
    getPlatformCompletionStats(),
    checkForPlatformUpdate().catch(() => null),
  ])

  return (
    <DashboardPageClient
      userName={userName}
      stats={stats}
      salesAnalytics={salesAnalytics}
      recentOrders={recentOrders}
      dailySales={[]}
      topCourses={[]}
      paymentMethodStats={[]}
      userGrowth={[]}
      completionStats={completionStats}
      dauData={[]}
      funnelData={[]}
      platformUpdate={platformUpdate}
    />
  )
}
