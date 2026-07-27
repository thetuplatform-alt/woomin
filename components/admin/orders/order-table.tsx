// components/admin/orders/order-table.tsx
// 訂單表格元件
// 顯示訂單列表，支援操作功能

'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { OrderWithDetails } from '@/lib/actions/orders'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, ShoppingCart, Repeat } from 'lucide-react'
import type { OrderStatus, PaymentMethod, InvoiceStatus } from '@prisma/client'

interface OrderTableProps {
  orders: OrderWithDetails[]
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

// 電子發票狀態 Badge 樣式
const invoiceBadge: Record<InvoiceStatus, { label: string; className: string }> = {
  PENDING: { label: '待開立', className: 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]' },
  ISSUED: { label: '已開立', className: 'bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]' },
  FAILED: { label: '開立失敗', className: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]' },
  VOIDED: { label: '已作廢', className: 'bg-surface-hover text-body border border-divider' },
  ALLOWANCE: { label: '已折讓', className: 'bg-[#EDE9FE] text-[#5B21B6] border border-[#C4B5FD]' },
}

// 付款方式標籤
const paymentMethodLabels: Record<PaymentMethod, string> = {
  CREDIT_CARD: '信用卡',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  ATM: 'ATM 轉帳',
  CVS: '超商代碼',
}

// 格式化金額
function formatAmount(amount: number): string {
  return `NT$ ${amount.toLocaleString()}`
}

export function OrderTable({ orders }: OrderTableProps) {
  if (orders.length === 0) {
    return (
      <div data-tour="orders-table" className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-surface border border-divider flex items-center justify-center mb-4">
          <ShoppingCart className="h-8 w-8 text-caption" />
        </div>
        <h3 className="text-lg font-medium text-heading mb-2">
          尚無訂單資料
        </h3>
        <p className="text-sm text-body mb-4">
          目前沒有符合條件的訂單記錄
        </p>
      </div>
    )
  }

  return (
    <div data-tour="orders-table" className="rounded-xl border border-divider overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-divider hover:bg-transparent bg-surface">
            <TableHead className="text-body font-medium">訂單編號</TableHead>
            <TableHead className="text-body font-medium">學員</TableHead>
            <TableHead className="text-body font-medium">商品</TableHead>
            <TableHead className="text-body font-medium text-right">金額</TableHead>
            <TableHead className="text-body font-medium text-center">付款方式</TableHead>
            <TableHead className="text-body font-medium text-center">狀態</TableHead>
            <TableHead data-tour="orders-invoice-column" className="text-body font-medium text-center">發票</TableHead>
            <TableHead className="text-body font-medium">建立時間</TableHead>
            <TableHead className="text-body font-medium w-20 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const status = statusStyles[order.status]

            return (
              <TableRow
                key={order.id}
                className="border-divider hover:bg-surface"
              >
                {/* 訂單編號 */}
                <TableCell>
                  <p className="font-mono text-sm text-heading">
                    {order.orderNo}
                  </p>
                </TableCell>

                {/* 學員 */}
                <TableCell>
                  {order.user ? (
                    <div>
                      <p className="text-heading text-sm">
                        {order.user.name || '未設定姓名'}
                      </p>
                      <p className="text-caption text-xs">
                        {order.user.email}
                      </p>
                    </div>
                  ) : (
                    <p className="text-caption text-sm">用戶已刪除</p>
                  )}
                </TableCell>

                {/* 商品 */}
                <TableCell>
                  {order.course || order.bundle ? (
                    <div>
                      <p className="text-heading text-sm line-clamp-1">
                        {order.bundle?.title ?? order.course?.title}
                      </p>
                      {order.bundle && (
                        <p className="text-xs text-caption">組合包</p>
                      )}
                      {/* 訂閱期款徽章（連向該訂閱） */}
                      {order.subscriptionId && (
                        <Link
                          href={`/admin/subscriptions/${order.subscriptionId}`}
                          className="inline-flex mt-1"
                        >
                          <Badge className="bg-[#EDE9FE] text-[#5B21B6] border border-[#C4B5FD] hover:bg-[#DDD6FE]">
                            <Repeat className="mr-1 h-3 w-3" />
                            訂閱
                            {order.periodNumber != null
                              ? `・第 ${order.periodNumber} 期`
                              : '・期款'}
                          </Badge>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <p className="text-caption text-sm">商品已刪除</p>
                  )}
                </TableCell>

                {/* 金額 */}
                <TableCell className="text-right">
                  <p className="text-heading font-medium">
                    {formatAmount(order.amount)}
                  </p>
                  {order.amount !== order.originalAmount && (
                    <p className="text-caption text-xs line-through">
                      {formatAmount(order.originalAmount)}
                    </p>
                  )}
                </TableCell>

                {/* 付款方式 */}
                <TableCell className="text-center">
                  {order.paymentMethod ? (
                    <span className="text-body text-sm">
                      {paymentMethodLabels[order.paymentMethod]}
                    </span>
                  ) : (
                    <span className="text-caption text-sm">-</span>
                  )}
                </TableCell>

                {/* 狀態 */}
                <TableCell className="text-center">
                  <Badge className={status.className}>{status.label}</Badge>
                </TableCell>

                {/* 發票 */}
                <TableCell className="text-center">
                  {order.invoice ? (
                    <Badge className={invoiceBadge[order.invoice.status].className}>
                      {invoiceBadge[order.invoice.status].label}
                    </Badge>
                  ) : (
                    <span className="text-caption text-sm">—</span>
                  )}
                </TableCell>

                {/* 建立時間 */}
                <TableCell>
                  <p className="text-body text-sm">
                    {format(new Date(order.createdAt), 'yyyy/MM/dd HH:mm', {
                      locale: zhTW,
                    })}
                  </p>
                </TableCell>

                {/* 操作 */}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface"
                  >
                    <Link href={`/admin/orders/${order.id}`}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">查看詳情</span>
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
