// app/(admin)/admin/orders/page.tsx
// 訂單列表頁
// 顯示所有訂單，支援搜尋、篩選和分頁

import { Suspense } from 'react'
import Link from 'next/link'
import { getOrders, getOrderStats } from '@/lib/actions/orders'
import { OrderTable } from '@/components/admin/orders/order-table'
import { OrderFilters } from '@/components/admin/orders/order-filters'
import { OrderPagination } from '@/components/admin/orders/order-pagination'
import { StatCard } from '@/components/admin/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle,
  RotateCcw,
  XCircle,
  BarChart3,
  Loader2,
} from 'lucide-react'
import type { OrderStatus, PaymentMethod } from '@prisma/client'

export const metadata = {
  title: '訂單管理',
}

interface OrdersPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    paymentMethod?: string
    startDate?: string
    endDate?: string
    page?: string
  }>
}

// 訂單統計區塊
async function OrderStatsSection() {
  const stats = await getOrderStats()

  return (
    <div data-tour="orders-stats" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="總營收"
        value={`NT$ ${stats.totalRevenue.toLocaleString()}`}
        icon={<DollarSign className="h-4 w-4 text-cta" />}
      />
      <StatCard
        title="已付款訂單"
        value={stats.paidOrders.toString()}
        icon={<CheckCircle className="h-4 w-4 text-cta" />}
      />
      <StatCard
        title="待處理訂單"
        value={stats.pendingOrders.toString()}
        icon={<Clock className="h-4 w-4 text-body" />}
      />
      <StatCard
        title="已退款訂單"
        value={stats.refundedOrders.toString()}
        icon={<RotateCcw className="h-4 w-4 text-body" />}
      />
    </div>
  )
}

// 訂單列表區塊
async function OrderListSection({
  search,
  status,
  paymentMethod,
  startDate,
  endDate,
  page,
}: {
  search?: string
  status?: string
  paymentMethod?: string
  startDate?: string
  endDate?: string
  page?: string
}) {
  // 解析頁碼
  const currentPage = page ? parseInt(page, 10) : 1
  const pageSize = 20

  // 取得訂單列表
  const result = await getOrders({
    search,
    status: status as OrderStatus | undefined,
    paymentMethod: paymentMethod as PaymentMethod | undefined,
    startDate,
    endDate,
    page: currentPage,
    pageSize,
  })

  return (
    <>
      {/* 訂單表格 */}
      <OrderTable orders={result.orders} />

      {/* 分頁 */}
      <div className="mt-4">
        <OrderPagination
          currentPage={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
        />
      </div>
    </>
  )
}

// 載入中狀態
function OrderListSkeleton() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-caption" />
    </div>
  )
}

// 統計載入中狀態
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

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams

  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">訂單管理</h2>
          <p className="text-body mt-1">
            管理所有訂單及交易記錄
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
        >
          <Link href="/admin/analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            銷售分析
          </Link>
        </Button>
      </div>

      {/* 訂單統計 */}
      <Suspense fallback={<StatsSkeleton />}>
        <OrderStatsSection />
      </Suspense>

      {/* 訂單列表卡片 */}
      <Card className="bg-white border-divider rounded-xl">
        <CardHeader>
          <CardTitle className="text-heading flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            訂單列表
          </CardTitle>
          {/* 搜尋和篩選 */}
          <div data-tour="orders-filters" className="pt-4">
            <OrderFilters />
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<OrderListSkeleton />}>
            <OrderListSection
              search={params.search}
              status={params.status}
              paymentMethod={params.paymentMethod}
              startDate={params.startDate}
              endDate={params.endDate}
              page={params.page}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
