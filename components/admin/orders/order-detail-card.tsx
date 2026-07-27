// components/admin/orders/order-detail-card.tsx
// 訂單詳情卡片元件
// 顯示訂單完整資訊，包含時間軸

'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { OrderWithDetails } from '@/lib/actions/orders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  User,
  BookOpen,
  Package,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Ban,
  ExternalLink,
  Ticket,
  Repeat,
} from 'lucide-react'
import type { OrderStatus, PaymentMethod } from '@prisma/client'

interface OrderDetailCardProps {
  order: OrderWithDetails
}

// 訂單狀態 Badge 樣式 - Design System
const statusStyles: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: {
    label: '待付款',
    className: 'bg-[#FEF3C7] text-[#92400E] hover:bg-[#FEF3C7] border border-[#FCD34D]',
  },
  PAID: {
    label: '已付款',
    className: 'bg-[#D1FAE5] text-[#065F46] hover:bg-[#D1FAE5] border border-[#6EE7B7]',
  },
  FAILED: {
    label: '付款失敗',
    className: 'bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FEE2E2] border border-[#FCA5A5]',
  },
  REFUNDED: {
    label: '已退款',
    className: 'bg-[#EDE9FE] text-[#5B21B6] hover:bg-[#EDE9FE] border border-[#C4B5FD]',
  },
  CANCELLED: {
    label: '已取消',
    className: 'bg-surface-hover text-body hover:bg-surface-hover border border-divider',
  },
}

// 付款方式標籤
const paymentMethodLabels: Record<PaymentMethod, string> = {
  CREDIT_CARD: '信用卡',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  ATM: 'ATM 轉帳',
  CVS: '超商代碼',
}

// 時間軸事件
interface TimelineEvent {
  icon: React.ReactNode
  title: string
  time: Date | null
  description?: string
  status: 'completed' | 'current' | 'pending' | 'error'
}

// 格式化金額
function formatAmount(amount: number): string {
  return `NT$ ${amount.toLocaleString()}`
}

export function OrderDetailCard({ order }: OrderDetailCardProps) {
  const status = statusStyles[order.status]

  // 建立時間軸事件
  const getTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [
      {
        icon: <Clock className="h-4 w-4" />,
        title: '訂單建立',
        time: order.createdAt,
        status: 'completed',
      },
    ]

    // 根據狀態添加事件
    if (order.status === 'PAID') {
      events.push({
        icon: <CheckCircle className="h-4 w-4" />,
        title: '付款成功',
        time: order.paidAt,
        description: order.paymentMethod
          ? `使用 ${paymentMethodLabels[order.paymentMethod]} 付款`
          : undefined,
        status: 'completed',
      })
    } else if (order.status === 'FAILED') {
      events.push({
        icon: <XCircle className="h-4 w-4" />,
        title: '付款失敗',
        time: order.updatedAt,
        status: 'error',
      })
    } else if (order.status === 'REFUNDED') {
      events.push({
        icon: <CheckCircle className="h-4 w-4" />,
        title: '付款成功',
        time: order.paidAt,
        status: 'completed',
      })
      events.push({
        icon: <RotateCcw className="h-4 w-4" />,
        title: '已退款',
        time: order.refundedAt,
        description: order.refundReason || undefined,
        status: 'completed',
      })
    } else if (order.status === 'CANCELLED') {
      events.push({
        icon: <Ban className="h-4 w-4" />,
        title: '訂單取消',
        time: order.updatedAt,
        status: 'error',
      })
    } else if (order.status === 'PENDING') {
      events.push({
        icon: <CreditCard className="h-4 w-4" />,
        title: '等待付款',
        time: null,
        status: 'current',
      })
    }

    return events
  }

  const timelineEvents = getTimelineEvents()

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 左側：訂單資訊 */}
      <div className="lg:col-span-2 space-y-6">
        {/* 基本資訊 */}
        <Card className="bg-white border-divider rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-heading">訂單資訊</CardTitle>
              <Badge className={status.className}>{status.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 訂單編號 */}
            <div className="flex justify-between items-center py-2">
              <span className="text-body">訂單編號</span>
              <span className="font-mono text-heading">{order.orderNo}</span>
            </div>
            <Separator className="bg-[#E5E5E5]" />

            {/* 訂閱期款標記（連向該訂閱） */}
            {order.subscriptionId && (
              <>
                <div className="flex justify-between items-center py-2">
                  <span className="text-body flex items-center gap-1.5">
                    <Repeat className="h-4 w-4" />
                    訂閱期款
                  </span>
                  <Link
                    href={`/admin/subscriptions/${order.subscriptionId}`}
                    className="inline-flex"
                  >
                    <Badge className="bg-[#EDE9FE] text-[#5B21B6] border border-[#C4B5FD] hover:bg-[#DDD6FE]">
                      {order.periodNumber != null
                        ? `第 ${order.periodNumber} 期`
                        : '期款'}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Badge>
                  </Link>
                </div>
                <Separator className="bg-[#E5E5E5]" />
              </>
            )}

            {/* Stripe Session ID */}
            {order.stripeSessionId && (
              <>
                <div className="flex justify-between items-center py-2">
                  <span className="text-body">Stripe Session ID</span>
                  <span className="font-mono text-heading text-xs">
                    {order.stripeSessionId}
                  </span>
                </div>
                <Separator className="bg-[#E5E5E5]" />
              </>
            )}

            {/* Stripe Payment Intent ID */}
            {order.stripePaymentIntentId && (
              <>
                <div className="flex justify-between items-center py-2">
                  <span className="text-body">Stripe Payment Intent ID</span>
                  <span className="font-mono text-heading text-xs">
                    {order.stripePaymentIntentId}
                  </span>
                </div>
                <Separator className="bg-[#E5E5E5]" />
              </>
            )}

            {/* 金額 */}
            <div className="flex justify-between items-center py-2">
              <span className="text-body">原價</span>
              <span className="text-body">
                {formatAmount(order.originalAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body">實付金額</span>
              <span className="text-xl font-bold text-cta">
                {formatAmount(order.amount)}
              </span>
            </div>
            {order.amount !== order.originalAmount && (
              <div className="flex justify-between items-center py-2">
                <span className="text-body">折扣</span>
                <span className="text-[#DC2626]">
                  -{formatAmount(order.originalAmount - order.amount)}
                </span>
              </div>
            )}

            {/* 優惠券資訊 */}
            {order.coupon && (
              <div className="flex justify-between items-center py-2">
                <span className="text-body flex items-center gap-1.5">
                  <Ticket className="h-4 w-4" />
                  優惠券
                </span>
                <span className="text-heading">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs mr-2">
                    {order.coupon.code}
                  </span>
                  {order.couponDiscount && (
                    <span className="text-[#DC2626]">
                      -{formatAmount(order.couponDiscount)}
                    </span>
                  )}
                </span>
              </div>
            )}
            <Separator className="bg-[#E5E5E5]" />

            {/* 付款方式 */}
            <div className="flex justify-between items-center py-2">
              <span className="text-body">付款方式</span>
              <span className="text-heading">
                {order.paymentMethod
                  ? paymentMethodLabels[order.paymentMethod]
                  : '-'}
              </span>
            </div>

            {/* 退款原因 */}
            {order.refundReason && (
              <>
                <Separator className="bg-[#E5E5E5]" />
                <div className="py-2">
                  <span className="text-body block mb-2">退款原因</span>
                  <p className="text-heading text-sm bg-surface p-3 rounded-lg border border-divider">
                    {order.refundReason === 'ANOMALOUS_SUBSCRIPTION_PERIOD'
                      ? '訂閱終態後的異常誤扣（僅退此筆，不撤原權限）'
                      : order.refundReason}
                  </p>
                </div>
              </>
            )}

            {order.refundStatus && (
              <>
                <Separator className="bg-[#E5E5E5]" />
                <div className="space-y-2 py-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-body">退款流程</span>
                    <Badge variant="outline">{order.refundStatus}</Badge>
                  </div>
                  {order.gatewayRefundId && (
                    <div className="flex justify-between gap-4">
                      <span className="text-body">金流退款 ID</span>
                      <span className="font-mono text-xs text-heading break-all text-right">
                        {order.gatewayRefundId}
                      </span>
                    </div>
                  )}
                  {order.refundError && (
                    <p className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-[#991B1B]">
                      {order.refundError}
                    </p>
                  )}
                </div>
              </>
            )}

            {order.disputeStatus && (
              <>
                <Separator className="bg-[#E5E5E5]" />
                <div className="space-y-2 py-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-body">付款爭議</span>
                    <Badge className="border border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]">
                      {order.disputeStatus}
                    </Badge>
                  </div>
                  {order.gatewayDisputeId && (
                    <p className="font-mono text-xs text-heading break-all text-right">
                      {order.gatewayDisputeId}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 學員資訊 */}
        <Card className="bg-white border-divider rounded-xl">
          <CardHeader>
            <CardTitle className="text-heading flex items-center gap-2">
              <User className="h-5 w-5" />
              學員資訊
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.user ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-heading font-medium">
                    {order.user.name || '未設定姓名'}
                  </p>
                  <p className="text-body text-sm">{order.user.email}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
                >
                  <Link href={`/admin/users/${order.user.id}`}>
                    查看學員
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-caption">用戶已刪除</p>
            )}
          </CardContent>
        </Card>

        {/* 商品資訊 */}
        <Card className="bg-white border-divider rounded-xl">
          <CardHeader>
            <CardTitle className="text-heading flex items-center gap-2">
              {order.bundle ? (
                <Package className="h-5 w-5" />
              ) : (
                <BookOpen className="h-5 w-5" />
              )}
              商品資訊
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.bundle ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {order.bundle.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={order.bundle.coverImage}
                      alt={order.bundle.title}
                      className="w-20 h-12 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <p className="text-heading font-medium">
                      {order.bundle.title}
                    </p>
                    <p className="text-sm text-caption">組合包訂單</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
                >
                  <Link href={`/admin/bundles/${order.bundle.id}`}>
                    查看組合包
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : order.course ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {order.course.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={order.course.coverImage}
                      alt={order.course.title}
                      className="w-20 h-12 object-cover rounded-lg"
                    />
                  )}
                  <p className="text-heading font-medium">
                    {order.course.title}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
                >
                  <Link href={`/admin/courses/${order.course.id}`}>
                    查看課程
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-caption">商品已刪除</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 右側：時間軸 */}
      <div>
        <Card className="bg-white border-divider rounded-xl">
          <CardHeader>
            <CardTitle className="text-heading">訂單時間軸</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {timelineEvents.map((event, index) => {
                const isLast = index === timelineEvents.length - 1

                // 狀態顏色 - Design System
                const statusColors = {
                  completed: 'bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]',
                  current: 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]',
                  pending: 'bg-surface-hover text-body border border-divider',
                  error: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]',
                }

                return (
                  <div key={index} className="flex gap-4 pb-6 last:pb-0">
                    {/* 圖示 */}
                    <div className="relative">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${statusColors[event.status]}`}
                      >
                        {event.icon}
                      </div>
                      {/* 連接線 */}
                      {!isLast && (
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-full bg-[#E5E5E5]" />
                      )}
                    </div>

                    {/* 內容 */}
                    <div className="flex-1 pt-1">
                      <p className="text-heading font-medium">{event.title}</p>
                      {event.time && (
                        <p className="text-caption text-sm">
                          {format(new Date(event.time), 'yyyy/MM/dd HH:mm:ss', {
                            locale: zhTW,
                          })}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-body text-sm mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
