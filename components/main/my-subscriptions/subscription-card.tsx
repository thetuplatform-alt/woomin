// components/main/my-subscriptions/subscription-card.tsx
// 單筆訂閱卡片（AC-54）：逐狀態顯示 + 期款歷史 + 取消 + 發票偏好。

'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  ExternalLink,
  Infinity as InfinityIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CancelSubscriptionDialog } from './cancel-subscription-dialog'
import { InvoicePrefsForm } from './invoice-prefs-form'
import type { MySubscription } from '@/lib/actions/subscriptions'

interface SubscriptionCardProps {
  subscription: MySubscription
  contactEmail: string
  onChanged: () => void
}

function formatDate(date: Date | string | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatMoney(amount: number): string {
  return `NT$${amount.toLocaleString('zh-TW')}`
}

const intervalLabel: Record<string, string> = {
  MONTH: '每月',
  YEAR: '每年',
}

/** 狀態徽章樣式 */
function statusBadge(sub: MySubscription): { label: string; className: string } {
  switch (sub.status) {
    case 'ACTIVE':
      return { label: '訂閱中', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    case 'PAST_DUE':
      return { label: '扣款失敗', className: 'bg-red-100 text-red-700 border-red-200' }
    case 'CANCELED':
      return { label: '已取消', className: 'bg-surface-hover text-caption border-divider' }
    case 'COMPLETED':
      return sub.planType === 'FIXED_TERM' && sub.termEndBehavior === 'GRANT_LIFETIME'
        ? { label: '分期繳清・永久擁有', className: 'bg-amber-100 text-amber-800 border-amber-200' }
        : { label: '訂閱結束', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    default:
      return { label: sub.status, className: 'bg-surface-hover text-caption border-divider' }
  }
}

export function SubscriptionCard({
  subscription: sub,
  contactEmail,
  onChanged,
}: SubscriptionCardProps) {
  const [cancelOpen, setCancelOpen] = useState(false)

  const badge = statusBadge(sub)
  const accessEndsText = formatDate(sub.accessEndsAt)
  const nextBillingText = formatDate(sub.nextBillingAt)
  const isFixedTerm = sub.planType === 'FIXED_TERM'
  const remainingPeriods =
    isFixedTerm && sub.totalPeriods != null
      ? Math.max(0, sub.totalPeriods - sub.paidPeriods)
      : null

  const canCancel = sub.status === 'ACTIVE' || sub.status === 'PAST_DUE'
  // 取消後仍在已付期間，或已到期/終止 → 可重新訂閱動線導向銷售頁
  const showResubscribe =
    (sub.status === 'CANCELED' || sub.status === 'COMPLETED') && !sub.isLifetimeGranted

  return (
    <Card className="overflow-hidden border-divider bg-white">
      <CardContent className="space-y-5 p-5 sm:p-6">
        {/* 標題列：課程 + 狀態徽章 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {sub.courseCoverImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={sub.courseCoverImage}
                alt={sub.courseTitle}
                className="h-14 w-24 flex-shrink-0 rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <Link
                href={`/courses/${sub.courseSlug}`}
                className="line-clamp-1 text-lg font-bold text-heading transition-colors hover:text-cta"
              >
                {sub.courseTitle}
              </Link>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-caption">
                <RefreshCw className="h-3.5 w-3.5" />
                {sub.planLabel}
                <span className="text-divider">·</span>
                {isFixedTerm ? (
                  <span>期限訂閱</span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <InfinityIcon className="h-3.5 w-3.5" />
                    無限訂閱
                  </span>
                )}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`flex-shrink-0 ${badge.className}`}>
            {badge.label}
          </Badge>
        </div>

        {/* 方案摘要 */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-surface/50 px-4 py-3 text-sm">
          <div>
            <span className="text-caption">每期金額</span>
            <span className="ml-2 font-bold text-heading">
              {formatMoney(sub.pricePerPeriod)}
            </span>
            <span className="ml-1 text-caption">/ {intervalLabel[sub.interval] ?? sub.interval}</span>
          </div>
          {isFixedTerm && sub.totalPeriods != null && (
            <div>
              <span className="text-caption">分期進度</span>
              <span className="ml-2 font-bold text-heading">
                已繳 {sub.paidPeriods}/{sub.totalPeriods} 期
              </span>
            </div>
          )}
        </div>

        {/* 狀態專屬區塊 */}
        {sub.status === 'ACTIVE' && (
          <div className="space-y-2">
            {nextBillingText && (
              <p className="flex items-center gap-2 text-sm text-body">
                <CreditCard className="h-4 w-4 text-caption" />
                下次扣款日：
                <strong className="text-heading">{nextBillingText}</strong>
                <span className="text-caption">
                  （{formatMoney(sub.pricePerPeriod)}）
                </span>
              </p>
            )}
            {isFixedTerm && remainingPeriods != null && remainingPeriods > 0 && (
              <p className="text-sm text-body">
                再繳 <strong className="text-heading">{remainingPeriods}</strong> 期即
                {sub.termEndBehavior === 'GRANT_LIFETIME' ? '轉為永久擁有' : '結束（不轉永久）'}。
              </p>
            )}
          </div>
        )}

        {sub.status === 'PAST_DUE' && (
          <PastDueSection sub={sub} contactEmail={contactEmail} />
        )}

        {sub.status === 'CANCELED' && (
          <div className="rounded-xl border border-divider bg-surface/50 p-4 text-sm text-body">
            {accessEndsText && sub.hasActiveAccess ? (
              <p>
                訂閱已取消，您仍可觀看至{' '}
                <strong className="text-heading">{accessEndsText}</strong>，屆時自動停止存取。
              </p>
            ) : (
              <p>此訂閱已取消，課程存取已結束。您可以隨時重新訂閱或買斷。</p>
            )}
          </div>
        )}

        {sub.status === 'COMPLETED' && (
          <div className="rounded-xl border border-divider bg-surface/50 p-4 text-sm text-body">
            {sub.isLifetimeGranted ? (
              <p className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                分期已全數繳清，本課程已轉為
                <strong>永久擁有</strong>，可無限期觀看。
              </p>
            ) : accessEndsText ? (
              <p>
                訂閱已結束（期滿結束存取），存取截止日為{' '}
                <strong className="text-heading">{accessEndsText}</strong>。
              </p>
            ) : (
              <p>此訂閱已結束。您可以隨時重新訂閱或買斷本課程。</p>
            )}
          </div>
        )}

        {/* 未繳滿即終止的異常標示 */}
        {sub.attentionReason === 'TERM_ENDED_UNDERPAID' && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            此分期訂閱已終止但未繳滿（{sub.paidPeriods}/{sub.totalPeriods}），如需恢復請聯繫客服。
          </p>
        )}

        {/* 期款歷史 */}
        {sub.periodOrders.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-heading">
              <Receipt className="h-4 w-4 text-caption" />
              期款歷史
            </p>
            <div className="divide-y divide-divider overflow-hidden rounded-xl border border-divider">
              {sub.periodOrders.map((order) => {
                const paidDate = formatDate(order.paidAt ?? order.createdAt)
                const row = (
                  <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 text-sm transition-colors hover:bg-surface/40">
                    <div className="min-w-0">
                      <span className="font-medium text-heading">
                        {order.periodNumber != null ? `第 ${order.periodNumber} 期` : '期款'}
                      </span>
                      <span className="ml-2 font-mono text-xs text-caption">
                        {order.orderNo}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-caption">{paidDate}</span>
                      <span className="font-bold text-heading">
                        {formatMoney(order.amount)}
                      </span>
                      {order.invoiceUrl && (
                        <ExternalLink className="h-3.5 w-3.5 text-caption" />
                      )}
                    </div>
                  </div>
                )
                return order.invoiceUrl ? (
                  <a
                    key={order.orderId}
                    href={order.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {row}
                  </a>
                ) : (
                  <div key={order.orderId}>{row}</div>
                )
              })}
            </div>
          </div>
        )}

        {/* 發票偏好（有進行中訂閱時可更新未來期款發票） */}
        {(sub.status === 'ACTIVE' || sub.status === 'PAST_DUE') && (
          <InvoicePrefsForm subscription={sub} onUpdated={onChanged} />
        )}

        {/* 動作列 */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-divider pt-4">
          {showResubscribe && (
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/courses/${sub.courseSlug}`}>重新訂閱或買斷</Link>
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              onClick={() => setCancelOpen(true)}
              className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              取消訂閱
            </Button>
          )}
        </div>
      </CardContent>

      {canCancel && (
        <CancelSubscriptionDialog
          subscription={sub}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          onCanceled={onChanged}
        />
      )}
    </Card>
  )
}

/** PAST_DUE 專屬區塊：Stripe 補繳連結 / PAYUNi 自救指引（AC-54） */
function PastDueSection({
  sub,
  contactEmail,
}: {
  sub: MySubscription
  contactEmail: string
}) {
  const accessEndsText = formatDate(sub.accessEndsAt)

  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-red-700">
        <AlertTriangle className="h-4 w-4" />
        本期扣款失敗，請盡快處理以免中斷課程存取
      </p>
      {accessEndsText && (
        <p className="text-body">
          補繳成功即恢復；若未補繳，將於{' '}
          <strong className="text-heading">{accessEndsText}</strong> 後停止存取。
        </p>
      )}

      {sub.gateway === 'stripe' ? (
        <div className="space-y-2">
          {sub.pastDueInvoiceUrl ? (
            <Button asChild className="rounded-xl bg-red-600 text-white hover:bg-red-700">
              <a
                href={sub.pastDueInvoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1.5 h-4 w-4" />
                前往補繳
              </a>
            </Button>
          ) : (
            <p className="text-body">
              系統將自動重試扣款。您也可以查看我們寄出的扣款失敗通知信中的補繳連結，或更新您的付款方式。
            </p>
          )}
        </div>
      ) : (
        // PAYUNi 自救指引
        <div className="space-y-2 text-body">
          <p>請依下列步驟自行排除：</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>確認信用卡額度足夠、卡片尚未過期。</li>
            <li>
              若需更換付款卡片，請
              <strong className="text-heading">取消目前訂閱後重新訂閱</strong>
              （這是 PAYUNi 唯一的換卡方式）。
            </li>
          </ol>
          {contactEmail && (
            <p className="text-caption">
              仍有問題請聯繫客服：
              <a
                href={`mailto:${contactEmail}`}
                className="ml-1 font-medium text-cta hover:underline"
              >
                {contactEmail}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
