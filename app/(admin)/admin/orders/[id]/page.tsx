// app/(admin)/admin/orders/[id]/page.tsx
// 訂單詳情頁
// 顯示訂單完整資訊，支援退款操作

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrderById } from '@/lib/actions/orders'
import { OrderDetailCard } from '@/components/admin/orders/order-detail-card'
import { RefundDialog } from '@/components/admin/orders/refund-dialog'
import { InvoiceActions } from '@/components/admin/orders/invoice-actions'
import { shouldShowStandaloneInvoiceOperations } from '@/components/admin/orders/invoice-visibility'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface OrderDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: OrderDetailPageProps) {
  const { id } = await params
  const order = await getOrderById(id)

  if (!order) {
    return {
      title: '訂單不存在',
    }
  }

  return {
    title: `訂單 ${order.orderNo}`,
  }
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params
  const order = await getOrderById(id)

  if (!order) {
    notFound()
  }

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
              返回訂單列表
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* 電子發票操作（已付款或已有發票記錄時顯示） */}
          {(order.status === 'PAID' || order.invoice) && (
            <InvoiceActions
              orderId={order.id}
              orderNo={order.orderNo}
              amount={order.amount}
              invoice={order.invoice}
              showStandaloneOperations={shouldShowStandaloneInvoiceOperations(order.invoice)}
            />
          )}
          {/* 退款按鈕（僅已付款訂單可退款） */}
          {order.status === 'PAID' && (
            <RefundDialog
              orderId={order.id}
              orderNo={order.orderNo}
              amount={order.amount}
              paymentGateway={order.paymentGateway}
              subscriptionId={order.subscriptionId}
              periodNumber={order.periodNumber}
              refundStatus={order.refundStatus}
              isAnomalousPeriod={
                order.refundReason === 'ANOMALOUS_SUBSCRIPTION_PERIOD'
              }
            />
          )}
        </div>
      </div>

      {/* 訂單標題 */}
      <div>
        <h2 className="text-xl font-bold text-heading">
          訂單 {order.orderNo}
        </h2>
        <p className="text-body mt-1">
          查看訂單詳細資訊及處理記錄
        </p>
      </div>

      {/* 訂單詳情 */}
      <OrderDetailCard order={order} />
    </div>
  )
}
