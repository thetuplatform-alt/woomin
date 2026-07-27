// components/admin/subscriptions/subscription-badges.tsx
// 訂閱狀態 / 類型 / 異常標記的共用 Badge 樣式與標籤（列表與詳情共用）。

import { Badge } from '@/components/ui/badge'
import type { SubscriptionStatus } from '@prisma/client'

/** 訂閱狀態 Badge 樣式 — 沿用訂單頁的設計語彙 */
export const subscriptionStatusStyles: Record<
  SubscriptionStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: '待付款',
    className:
      'bg-[#FEF3C7] text-[#92400E] hover:bg-[#FEF3C7] border border-[#FCD34D]',
  },
  ACTIVE: {
    label: '生效中',
    className:
      'bg-[#D1FAE5] text-[#065F46] hover:bg-[#D1FAE5] border border-[#6EE7B7]',
  },
  PAST_DUE: {
    label: '扣款失敗',
    className:
      'bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FEE2E2] border border-[#FCA5A5]',
  },
  CANCELED: {
    label: '已取消',
    className:
      'bg-surface-hover text-body hover:bg-surface-hover border border-divider',
  },
  COMPLETED: {
    label: '已完成',
    className:
      'bg-[#EDE9FE] text-[#5B21B6] hover:bg-[#EDE9FE] border border-[#C4B5FD]',
  },
}

export function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatus
}) {
  const style = subscriptionStatusStyles[status]
  return <Badge className={style.className}>{style.label}</Badge>
}

export function PlanTypeBadge({
  type,
}: {
  type: 'UNLIMITED' | 'FIXED_TERM'
}) {
  return (
    <Badge
      className={
        type === 'UNLIMITED'
          ? 'bg-[#EDE9FE] text-[#5B21B6] border border-[#C4B5FD]'
          : 'bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD]'
      }
    >
      {type === 'UNLIMITED' ? '無限訂閱' : '期限訂閱'}
    </Badge>
  )
}

/** 週期中文 */
export function intervalLabel(interval: 'MONTH' | 'YEAR'): string {
  return interval === 'YEAR' ? '每年' : '每月'
}

/**
 * attentionReason 的中文說明。
 * FIXED_TERM 相關可帶入 paidPeriods/totalPeriods 生成「已終止但未繳滿(N/M)」。
 */
export function describeAttentionReason(
  reason: string | null,
  paidPeriods?: number,
  totalPeriods?: number | null
): string | null {
  if (!reason) return null
  switch (reason) {
    case 'TERM_ENDED_UNDERPAID':
      if (
        typeof paidPeriods === 'number' &&
        typeof totalPeriods === 'number' &&
        totalPeriods > 0
      ) {
        return `已終止但未繳滿（${paidPeriods}/${totalPeriods}）`
      }
      return '已終止但未繳滿'
    case 'ANOMALOUS_PERIOD_PAYMENT':
      return '偵測到異常期款'
    case 'WEBHOOK_STALE':
      return 'Webhook 疑似失聯'
    case 'CANCEL_RETRY_EXHAUSTED':
      return 'Gateway 取消重試已用盡'
    default:
      return reason
  }
}

/** 異常標記醒目 Badge（紅色） */
export function AttentionBadge({
  reason,
  paidPeriods,
  totalPeriods,
}: {
  reason: string | null
  paidPeriods?: number
  totalPeriods?: number | null
}) {
  const label = describeAttentionReason(reason, paidPeriods, totalPeriods)
  if (!label) return null
  return (
    <Badge className="bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
      ⚠ {label}
    </Badge>
  )
}
