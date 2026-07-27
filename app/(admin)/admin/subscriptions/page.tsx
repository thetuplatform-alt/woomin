// app/(admin)/admin/subscriptions/page.tsx
// 訂閱管理列表頁（/admin/subscriptions）
// 統計卡（活躍 / MRR / PAST_DUE）＋維運告警＋列表（狀態/課程篩選、分頁、attentionReason 標示）。
// 全頁僅 ADMIN 可見（middleware /admin/* 保護 + 各 action requireOnlyAdminAuth）。

import { Suspense } from 'react'
import {
  getSubscriptionStats,
  getSubscriptions,
  getSubscriptionCourseOptions,
  getSubscriptionOpsAlerts,
} from '@/lib/actions/subscriptions-admin'
import { StatCard } from '@/components/admin/stat-card'
import { SubscriptionTable } from '@/components/admin/subscriptions/subscription-table'
import { SubscriptionFilters } from '@/components/admin/subscriptions/subscription-filters'
import { SubscriptionPagination } from '@/components/admin/subscriptions/subscription-pagination'
import { SubscriptionOpsAlerts } from '@/components/admin/subscriptions/subscription-ops-alerts'
import { Repeat, TrendingUp, AlertCircle, Loader2 } from 'lucide-react'
import type { SubscriptionStatus } from '@prisma/client'

export const metadata = {
  title: '訂閱管理',
}

interface SubscriptionsPageProps {
  searchParams: Promise<{
    status?: string
    courseId?: string
    page?: string
  }>
}

// 統計卡區塊
async function StatsSection() {
  const stats = await getSubscriptionStats()
  return (
    <div
      data-tour="subscription-stats"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      <StatCard
        title="活躍訂閱"
        value={stats.activeCount.toString()}
        icon={<Repeat className="h-4 w-4 text-cta" />}
      />
      <StatCard
        title="每月經常性收入 (MRR)"
        value={`NT$ ${stats.mrr.toLocaleString()}`}
        description="活躍訂閱依週期折算為每月加總"
        icon={<TrendingUp className="h-4 w-4 text-cta" />}
      />
      <StatCard
        title="扣款失敗（寬限中）"
        value={stats.pastDueCount.toString()}
        icon={
          <AlertCircle
            className={`h-4 w-4 ${stats.pastDueCount > 0 ? 'text-[#DC2626]' : 'text-body'}`}
          />
        }
      />
    </div>
  )
}

// 維運告警區塊（心跳逾時 / Stripe webhook 失聯）
async function OpsAlertsSection() {
  const alerts = await getSubscriptionOpsAlerts()
  return <SubscriptionOpsAlerts alerts={alerts} />
}

// 列表區塊
async function ListSection({
  status,
  courseId,
  page,
}: {
  status?: string
  courseId?: string
  page?: string
}) {
  const currentPage = page ? parseInt(page, 10) : 1
  const [result, courseOptions] = await Promise.all([
    getSubscriptions({
      status: status as SubscriptionStatus | undefined,
      courseId: courseId || undefined,
      page: currentPage,
      pageSize: 20,
    }),
    getSubscriptionCourseOptions(),
  ])

  return (
    <>
      <SubscriptionFilters
        courseOptions={courseOptions}
        status={status}
        courseId={courseId}
      />
      <SubscriptionTable subscriptions={result.subscriptions} />
      <div className="mt-4">
        <SubscriptionPagination
          currentPage={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
        />
      </div>
    </>
  )
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-caption" />
    </div>
  )
}

export default async function SubscriptionsPage({
  searchParams,
}: SubscriptionsPageProps) {
  const { status, courseId, page } = await searchParams

  return (
    <div className="space-y-6 p-6" data-tour="subscriptions-page">
      {/* 頁首 */}
      <div>
        <h2 className="text-xl font-bold text-heading">訂閱管理</h2>
        <p className="text-body mt-1">
          管理所有課程訂閱、查看期款歷史、代學員取消、處理扣款失敗。
        </p>
      </div>

      {/* 維運告警 */}
      <Suspense fallback={null}>
        <OpsAlertsSection />
      </Suspense>

      {/* 統計卡 */}
      <Suspense fallback={<LoadingBlock />}>
        <StatsSection />
      </Suspense>

      {/* 列表 */}
      <Suspense fallback={<LoadingBlock />}>
        <ListSection status={status} courseId={courseId} page={page} />
      </Suspense>
    </div>
  )
}
