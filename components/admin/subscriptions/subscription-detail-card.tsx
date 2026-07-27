// components/admin/subscriptions/subscription-detail-card.tsx
// 訂閱詳情主體：訂戶、方案快照、期款 Order 歷史、consent 證據、gateway 識別碼、
// 動作列（代取消 / PAYUNi reauth）、發票偏好編輯。

'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { SubscriptionDetail } from '@/lib/actions/subscriptions-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  User,
  BookOpen,
  ExternalLink,
  ShieldCheck,
  Receipt,
  FileText,
} from 'lucide-react'
import {
  SubscriptionStatusBadge,
  PlanTypeBadge,
  AttentionBadge,
  intervalLabel,
  describeAttentionReason,
} from './subscription-badges'
import { CancelSubscriptionDialog } from './cancel-subscription-dialog'
import { ReauthButton } from './reauth-button'
import { InvoicePreferenceForm } from './invoice-preference-form'

interface Props {
  subscription: SubscriptionDetail
}

function formatAmount(amount: number): string {
  return `NT$ ${amount.toLocaleString()}`
}

function formatDate(d: Date | null, withTime = false): string {
  if (!d) return '—'
  return format(new Date(d), withTime ? 'yyyy/MM/dd HH:mm' : 'yyyy/MM/dd', {
    locale: zhTW,
  })
}

/** 期款 Order 狀態中文 */
const orderStatusLabel: Record<string, string> = {
  PENDING: '待付款',
  PAID: '已付款',
  FAILED: '付款失敗',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
}

export function SubscriptionDetailCard({ subscription: sub }: Props) {
  const isFixedTerm = sub.planType === 'FIXED_TERM'
  const canCancel = sub.status === 'ACTIVE' || sub.status === 'PAST_DUE'
  const canReauth = sub.gateway === 'payuni' && sub.status === 'PAST_DUE'
  const attentionLabel = describeAttentionReason(
    sub.attentionReason,
    sub.paidPeriods,
    sub.totalPeriods
  )

  return (
    <div className="space-y-6">
      {/* 頁首：標題 + 狀態 + 動作 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-heading">
              {sub.course?.title ?? '課程已刪除'}
            </h2>
            <SubscriptionStatusBadge status={sub.status} />
            <PlanTypeBadge type={sub.planType} />
            {sub.attentionReason && (
              <AttentionBadge
                reason={sub.attentionReason}
                paidPeriods={sub.paidPeriods}
                totalPeriods={sub.totalPeriods}
              />
            )}
          </div>
          <p className="text-body mt-1">
            {sub.planLabel ?? '（方案已移除）'} · 建立於{' '}
            {formatDate(sub.createdAt, true)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canReauth && <ReauthButton subscriptionId={sub.id} />}
          {canCancel && (
            <CancelSubscriptionDialog
              subscriptionId={sub.id}
              isFixedTerm={isFixedTerm}
              accessEndsAt={sub.accessEndsAt}
            />
          )}
        </div>
      </div>

      {/* 異常提示橫幅 */}
      {attentionLabel && (
        <div className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] p-4 text-sm text-[#991B1B]">
          <strong>需要注意：</strong>
          {attentionLabel}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左：方案快照 + 期款歷史 + 發票 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 方案快照 */}
          <Card className="bg-white border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                方案快照
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="類型">
                {sub.planType === 'UNLIMITED' ? '無限訂閱' : '期限訂閱'}
              </Row>
              <Row label="每期金額">
                {formatAmount(sub.pricePerPeriod)}（{intervalLabel(sub.interval)}）
              </Row>
              {isFixedTerm && (
                <>
                  <Row label="繳費進度">
                    已繳 {sub.paidPeriods}
                    {sub.totalPeriods ? ` / ${sub.totalPeriods}` : ''} 期
                  </Row>
                  <Row label="繳滿後">
                    {sub.termEndBehavior === 'GRANT_LIFETIME'
                      ? '轉為永久擁有'
                      : '結束存取'}
                  </Row>
                </>
              )}
              {!isFixedTerm && (
                <Row label="已扣款期數">{sub.paidPeriods} 期</Row>
              )}
              <Separator className="bg-[#E5E5E5]" />
              <Row label="可觀看至">
                {sub.status === 'COMPLETED' &&
                sub.termEndBehavior === 'GRANT_LIFETIME'
                  ? '永久'
                  : formatDate(sub.accessEndsAt)}
              </Row>
              <Row label="最後扣款">{formatDate(sub.lastPaymentAt, true)}</Row>
              {sub.canceledAt && (
                <Row label="取消時間">
                  {formatDate(sub.canceledAt, true)}
                  {sub.cancelReason ? `（${sub.cancelReason}）` : ''}
                </Row>
              )}
              {sub.completedAt && (
                <Row label="完成時間">{formatDate(sub.completedAt, true)}</Row>
              )}
              {sub.pendingGatewayCancelAt && (
                <Row label="Gateway 取消待重試">
                  {formatDate(sub.pendingGatewayCancelAt, true)}
                </Row>
              )}
            </CardContent>
          </Card>

          {/* 期款歷史 */}
          <Card className="bg-white border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                期款歷史
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sub.periodOrders.length === 0 ? (
                <p className="text-caption text-sm py-4 text-center">
                  尚無期款紀錄
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-divider hover:bg-transparent">
                        <TableHead className="text-body font-medium">期別</TableHead>
                        <TableHead className="text-body font-medium">訂單編號</TableHead>
                        <TableHead className="text-body font-medium text-right">金額</TableHead>
                        <TableHead className="text-body font-medium text-center">狀態</TableHead>
                        <TableHead className="text-body font-medium">付款時間</TableHead>
                        <TableHead className="text-body font-medium text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub.periodOrders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="border-divider hover:bg-surface"
                        >
                          <TableCell>
                            <span className="text-heading text-sm">
                              {order.periodNumber != null
                                ? `第 ${order.periodNumber} 期`
                                : '異常期款'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-heading">
                              {order.orderNo}
                            </span>
                            {order.hasInvoice && (
                              <Badge className="ml-2 bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]">
                                <FileText className="mr-1 h-3 w-3" />
                                有發票
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-heading text-sm">
                            {formatAmount(order.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-body text-sm">
                              {orderStatusLabel[order.status] ?? order.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-body text-sm">
                            {formatDate(order.paidAt, true)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-8 text-body hover:text-heading hover:bg-surface"
                            >
                              <Link href={`/admin/orders/${order.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="sr-only">查看訂單</span>
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 發票偏好編輯 */}
          <Card className="bg-white border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <FileText className="h-5 w-5" />
                電子發票偏好
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvoicePreferenceForm
                subscriptionId={sub.id}
                initial={sub.invoice}
              />
            </CardContent>
          </Card>
        </div>

        {/* 右：訂戶 + consent + gateway 識別碼 */}
        <div className="space-y-6">
          {/* 訂戶 */}
          <Card className="bg-white border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <User className="h-5 w-5" />
                訂戶
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sub.user ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-heading font-medium">
                      {sub.user.name || '未設定姓名'}
                    </p>
                    <p className="text-body text-sm">{sub.user.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
                  >
                    <Link href={`/admin/users/${sub.user.id}`}>
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

          {/* 同意證據 */}
          <Card className="bg-white border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                自動扣款同意證據
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="同意時間">{formatDate(sub.consentAt, true)}</Row>
              <Row label="條款版本">{sub.consentTextVersion ?? '—'}</Row>
              <p className="text-xs text-caption pt-1">
                結帳時已取得學員定期扣款同意，搭配對應期款訂單的 IP / UA
                構成 chargeback / 消保舉證的證據鏈。
              </p>
            </CardContent>
          </Card>

          {/* Gateway 識別碼 */}
          <Card className="bg-white border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading">金流識別碼</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="金流">{sub.gateway === 'stripe' ? 'Stripe' : 'PAYUNi'}</Row>
              <Row label={sub.gateway === 'stripe' ? 'Subscription ID' : 'PeriodTradeNo'}>
                <span className="font-mono text-xs break-all">
                  {sub.gatewaySubscriptionId ?? '—'}
                </span>
              </Row>
              {sub.gatewayTradeNo && (
                <Row label="MerTradeNo">
                  <span className="font-mono text-xs break-all">
                    {sub.gatewayTradeNo}
                  </span>
                </Row>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** 詳情用的 label/value 列 */
function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-1">
      <span className="text-body text-sm shrink-0">{label}</span>
      <span className="text-heading text-sm text-right">{children}</span>
    </div>
  )
}
