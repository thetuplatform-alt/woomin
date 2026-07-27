// components/admin/subscriptions/subscription-ops-alerts.tsx
// 訂閱維運告警橫幅（AC-64）：
// - 排程心跳逾 48h → 「排程未運作」
// - 存在 ACTIVE Stripe 訂閱且已過一個週期無新 invoice.paid → 「Stripe webhook 疑似失聯」

import { AlertTriangle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { SubscriptionOpsAlerts as Alerts } from '@/lib/actions/subscriptions-admin'
import { SUBSCRIPTION_HEARTBEAT_STALE_HOURS } from '@/lib/subscription/constants'

interface Props {
  alerts: Alerts
}

export function SubscriptionOpsAlerts({ alerts }: Props) {
  if (!alerts.heartbeatStale && !alerts.stripeWebhookStale) return null

  return (
    <div className="space-y-3" data-tour="subscription-ops-alerts">
      {/* 心跳逾時 */}
      {alerts.heartbeatStale && (
        <div className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] p-4 text-sm text-[#991B1B] flex items-start gap-3">
          <Clock className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">訂閱排程未運作</p>
            <p className="mt-1">
              訂閱維護排程（即將扣款提醒、存取結束通知、異常偵測）已超過{' '}
              {SUBSCRIPTION_HEARTBEAT_STALE_HOURS} 小時沒有回報心跳。
              {alerts.lastHeartbeatAt
                ? `（最後一次：${format(new Date(alerts.lastHeartbeatAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}）`
                : '（從未成功執行）'}
              請確認排程 / Cron（subscription-maintenance）是否正常運作。
            </p>
          </div>
        </div>
      )}

      {/* Stripe webhook 失聯 */}
      {alerts.stripeWebhookStale && (
        <div className="rounded-lg border border-[#FCD34D] bg-[#FEF3C7] p-4 text-sm text-[#92400E] flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Stripe webhook 疑似失聯</p>
            <p className="mt-1">
              有 {alerts.stripeWebhookStaleCount} 筆生效中的 Stripe
              訂閱早該進入下一期扣款，但遲遲未收到續期成功事件。這通常代表 Stripe
              Dashboard 未設定（或漏設）訂閱相關 webhook 事件（invoice.paid、
              invoice.payment_failed、customer.subscription.deleted 等），
              續期收款將收不到。請至<strong>金流收款</strong>頁確認 webhook
              事件清單。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
