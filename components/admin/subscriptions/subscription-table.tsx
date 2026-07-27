// components/admin/subscriptions/subscription-table.tsx
// 訂閱列表表格：訂戶、課程、方案、狀態、期數進度、下次扣款、attentionReason 醒目標示。

'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { SubscriptionListItem } from '@/lib/actions/subscriptions-admin'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, Repeat } from 'lucide-react'
import {
  SubscriptionStatusBadge,
  PlanTypeBadge,
  AttentionBadge,
  intervalLabel,
} from './subscription-badges'

interface SubscriptionTableProps {
  subscriptions: SubscriptionListItem[]
}

function formatAmount(amount: number): string {
  return `NT$ ${amount.toLocaleString()}`
}

export function SubscriptionTable({ subscriptions }: SubscriptionTableProps) {
  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-surface border border-divider flex items-center justify-center mb-4">
          <Repeat className="h-8 w-8 text-caption" />
        </div>
        <h3 className="text-lg font-medium text-heading mb-2">尚無訂閱資料</h3>
        <p className="text-sm text-body">目前沒有符合條件的訂閱紀錄</p>
      </div>
    )
  }

  return (
    <div
      data-tour="subscriptions-table"
      className="rounded-xl border border-divider overflow-x-auto"
    >
      <Table>
        <TableHeader>
          <TableRow className="border-divider hover:bg-transparent bg-surface">
            <TableHead className="text-body font-medium">訂戶</TableHead>
            <TableHead className="text-body font-medium">課程 / 方案</TableHead>
            <TableHead className="text-body font-medium text-center">類型</TableHead>
            <TableHead className="text-body font-medium text-right">每期</TableHead>
            <TableHead className="text-body font-medium text-center">進度</TableHead>
            <TableHead className="text-body font-medium text-center">狀態</TableHead>
            <TableHead className="text-body font-medium">下次扣款 / 可看至</TableHead>
            <TableHead className="text-body font-medium w-20 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => (
            <TableRow key={sub.id} className="border-divider hover:bg-surface">
              {/* 訂戶 */}
              <TableCell>
                {sub.user ? (
                  <div>
                    <p className="text-heading text-sm">
                      {sub.user.name || '未設定姓名'}
                    </p>
                    <p className="text-caption text-xs">{sub.user.email}</p>
                  </div>
                ) : (
                  <p className="text-caption text-sm">用戶已刪除</p>
                )}
              </TableCell>

              {/* 課程 / 方案 */}
              <TableCell>
                <p className="text-heading text-sm line-clamp-1">
                  {sub.course?.title ?? '課程已刪除'}
                </p>
                {sub.planLabel && (
                  <p className="text-xs text-caption">{sub.planLabel}</p>
                )}
              </TableCell>

              {/* 類型 */}
              <TableCell className="text-center">
                <PlanTypeBadge type={sub.planType} />
              </TableCell>

              {/* 每期 */}
              <TableCell className="text-right">
                <p className="text-heading text-sm">
                  {formatAmount(sub.pricePerPeriod)}
                </p>
                <p className="text-caption text-xs">
                  {intervalLabel(sub.interval)}
                </p>
              </TableCell>

              {/* 進度 */}
              <TableCell className="text-center">
                {sub.planType === 'FIXED_TERM' && sub.totalPeriods ? (
                  <span className="text-body text-sm">
                    {sub.paidPeriods}/{sub.totalPeriods} 期
                  </span>
                ) : (
                  <span className="text-body text-sm">
                    已繳 {sub.paidPeriods} 期
                  </span>
                )}
              </TableCell>

              {/* 狀態 + 異常標記 */}
              <TableCell className="text-center">
                <div className="flex flex-col items-center gap-1">
                  <SubscriptionStatusBadge status={sub.status} />
                  {sub.attentionReason && (
                    <AttentionBadge
                      reason={sub.attentionReason}
                      paidPeriods={sub.paidPeriods}
                      totalPeriods={sub.totalPeriods}
                    />
                  )}
                </div>
              </TableCell>

              {/* 下次扣款 / 可看至 */}
              <TableCell>
                {sub.accessEndsAt ? (
                  <p className="text-body text-sm">
                    {format(new Date(sub.accessEndsAt), 'yyyy/MM/dd', {
                      locale: zhTW,
                    })}
                  </p>
                ) : sub.status === 'COMPLETED' ? (
                  <p className="text-body text-sm">永久 / 已結束</p>
                ) : (
                  <span className="text-caption text-sm">—</span>
                )}
              </TableCell>

              {/* 操作 */}
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface"
                >
                  <Link href={`/admin/subscriptions/${sub.id}`}>
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">查看詳情</span>
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
