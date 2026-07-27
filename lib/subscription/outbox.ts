import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEInvoiceConfig } from '@/lib/invoice/config'
import { issueInvoiceForOrder, syncInvoiceForRefund } from '@/lib/invoice/service'
import { isEmailServiceConfigured } from '@/lib/email-transport'
import {
  sendAdminSubscriptionAlertEmail,
  sendSubscriptionCompletedEmail,
  sendSubscriptionPaymentFailedEmail,
  sendSubscriptionRenewalReceiptEmail,
  sendSubscriptionStartedEmail,
} from '@/lib/email'
import { getPostHogClient } from '@/lib/posthog-server'

type Tx = Prisma.TransactionClient

export type SubscriptionOutboxEventType =
  | 'ISSUE_INVOICE'
  | 'EMAIL_STARTED'
  | 'EMAIL_RENEWAL'
  | 'EMAIL_COMPLETED'
  | 'EMAIL_PAYMENT_FAILED'
  | 'ADMIN_ALERT_AMOUNT_MISMATCH'
  | 'ADMIN_ALERT_PAST_DUE'
  | 'ANALYTICS_SUBSCRIPTION'
  | 'SYNC_INVOICE_REFUND'

export type OrderInvoiceOutboxEventType = 'ISSUE_INVOICE' | 'SYNC_INVOICE_REFUND'

export function orderInvoiceOutboxKey(
  orderId: string,
  eventType: OrderInvoiceOutboxEventType
): string {
  return `order:${orderId}:${eventType.toLowerCase()}`
}

/** 買斷／訂閱訂單共用的發票 durable outbox；必須在訂單狀態 transaction 內呼叫。 */
export async function enqueueOrderInvoiceOutbox(
  tx: Tx,
  params: {
    orderId: string
    subscriptionId?: string | null
    eventType: OrderInvoiceOutboxEventType
    reason?: string
  }
): Promise<string> {
  const dedupeKey = orderInvoiceOutboxKey(params.orderId, params.eventType)
  await tx.subscriptionOutbox.upsert({
    where: { dedupeKey },
    create: {
      dedupeKey,
      eventType: params.eventType,
      // 此欄位沒有 FK；買斷訂單以穩定的 pseudo id 復用現有 outbox table。
      subscriptionId: params.subscriptionId ?? `order:${params.orderId}`,
      orderId: params.orderId,
      payload: params.reason ? { reason: params.reason } : {},
    },
    update: {},
  })
  return dedupeKey
}

export async function enqueueSubscriptionOutbox(
  tx: Tx,
  params: {
    dedupeKey: string
    eventType: SubscriptionOutboxEventType
    subscriptionId: string
    orderId?: string | null
    payload: Prisma.InputJsonObject
  }
): Promise<void> {
  await tx.subscriptionOutbox.upsert({
    where: { dedupeKey: params.dedupeKey },
    create: {
      dedupeKey: params.dedupeKey,
      eventType: params.eventType,
      subscriptionId: params.subscriptionId,
      orderId: params.orderId ?? null,
      payload: params.payload,
    },
    update: {},
  })
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('訂閱 outbox payload 格式錯誤')
  }
  return value as Record<string, unknown>
}

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string' || !value) throw new Error(`outbox 缺少 ${key}`)
  return value
}

function nullableString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' ? value : null
}

function nullableDate(payload: Record<string, unknown>, key: string): Date | null {
  const value = nullableString(payload, key)
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`outbox ${key} 日期錯誤`)
  return date
}

function requiredNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`outbox 缺少 ${key}`)
  }
  return value
}

async function requireEmailSuccess(
  task: () => Promise<{ success: boolean; error?: string }>
): Promise<void> {
  if (!(await isEmailServiceConfigured())) return
  const result = await task()
  if (!result.success) throw new Error(result.error ?? 'Email 發送失敗')
}

async function dispatchOutboxEvent(event: {
  eventType: string
  orderId: string | null
  subscriptionId: string
  payload: Prisma.JsonValue
}): Promise<void> {
  const payload = asRecord(event.payload)
  switch (event.eventType as SubscriptionOutboxEventType) {
    case 'ISSUE_INVOICE': {
      if (!event.orderId) throw new Error('發票 outbox 缺少 orderId')
      const config = await getEInvoiceConfig()
      if (!config.enabled || !config.autoIssue) return
      const result = await issueInvoiceForOrder(event.orderId)
      if (!result.success && !result.skipped) {
        throw new Error(result.error ?? '電子發票開立失敗')
      }
      return
    }
    case 'SYNC_INVOICE_REFUND': {
      if (!event.orderId) throw new Error('發票退款 outbox 缺少 orderId')
      const result = await syncInvoiceForRefund(
        event.orderId,
        nullableString(payload, 'reason') ?? '訂單退款'
      )
      if (!result.success) throw new Error(result.error ?? '電子發票沖銷失敗')
      return
    }
    case 'EMAIL_STARTED':
      return requireEmailSuccess(() =>
        sendSubscriptionStartedEmail({
          toEmail: requiredString(payload, 'toEmail'),
          userName: nullableString(payload, 'userName'),
          courseName: requiredString(payload, 'courseTitle'),
          planLabel: requiredString(payload, 'planLabel'),
          pricePerPeriod: requiredNumber(payload, 'amount'),
          nextBillingAt: nullableDate(payload, 'nextBillingAt'),
        })
      )
    case 'EMAIL_RENEWAL':
      return requireEmailSuccess(() =>
        sendSubscriptionRenewalReceiptEmail({
          toEmail: requiredString(payload, 'toEmail'),
          userName: nullableString(payload, 'userName'),
          courseName: requiredString(payload, 'courseTitle'),
          periodNumber: requiredNumber(payload, 'periodNumber'),
          amount: requiredNumber(payload, 'amount'),
          orderNo: requiredString(payload, 'orderNo'),
          nextBillingAt: nullableDate(payload, 'nextBillingAt'),
        })
      )
    case 'EMAIL_COMPLETED':
      return requireEmailSuccess(() =>
        sendSubscriptionCompletedEmail({
          toEmail: requiredString(payload, 'toEmail'),
          userName: nullableString(payload, 'userName'),
          courseName: requiredString(payload, 'courseTitle'),
          totalPeriods: requiredNumber(payload, 'totalPeriods'),
        })
      )
    case 'EMAIL_PAYMENT_FAILED':
      return requireEmailSuccess(() =>
        sendSubscriptionPaymentFailedEmail({
          toEmail: requiredString(payload, 'toEmail'),
          userName: nullableString(payload, 'userName'),
          courseName: requiredString(payload, 'courseTitle'),
          gateway: requiredString(payload, 'gateway'),
          hostedInvoiceUrl: nullableString(payload, 'hostedInvoiceUrl'),
          accessEndsAt: nullableDate(payload, 'accessEndsAt'),
        })
      )
    case 'ADMIN_ALERT_AMOUNT_MISMATCH':
    case 'ADMIN_ALERT_PAST_DUE':
      return requireEmailSuccess(() =>
        sendAdminSubscriptionAlertEmail({
          reason:
            event.eventType === 'ADMIN_ALERT_PAST_DUE'
              ? 'PAST_DUE'
              : 'ANOMALOUS_PERIOD_PAYMENT',
          subscriptionId: event.subscriptionId,
          courseName: requiredString(payload, 'courseTitle'),
          userEmail: nullableString(payload, 'userEmail'),
          detail: nullableString(payload, 'detail'),
        })
      )
    case 'ANALYTICS_SUBSCRIPTION': {
      const posthog = await getPostHogClient()
      if (!posthog) return
      posthog.capture({
        distinctId: requiredString(payload, 'distinctId'),
        event: requiredString(payload, 'event'),
        properties: asRecord(payload.properties as Prisma.JsonValue),
      })
      await posthog.flush()
      return
    }
    default:
      throw new Error(`未知的訂閱 outbox 事件: ${event.eventType}`)
  }
}

/** Claim-and-dispatch；至少一次送達，單一外部副作用各自有獨立 dedupe key。 */
export async function processSubscriptionOutbox(params: {
  deadline?: number
  limit?: number
  dedupeKeys?: string[]
} = {}): Promise<{ attempted: number; completed: number; failed: number }> {
  const deadline = params.deadline ?? Date.now() + 10_000
  const candidates = await prisma.subscriptionOutbox.findMany({
    where: {
      nextAttemptAt: { lte: new Date() },
      OR: [
        { status: { in: ['PENDING', 'FAILED'] } },
        {
          status: 'PROCESSING',
          lockedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      ],
      ...(params.dedupeKeys ? { dedupeKey: { in: params.dedupeKeys } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: params.limit ?? 25,
  })

  let attempted = 0
  let completed = 0
  let failed = 0
  for (const candidate of candidates) {
    if (Date.now() >= deadline) break
    const claimed = await prisma.subscriptionOutbox.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          {
            status: 'PROCESSING',
            lockedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
          },
        ],
      },
      data: { status: 'PROCESSING', lockedAt: new Date(), attempts: { increment: 1 } },
    })
    if (claimed.count !== 1) continue
    attempted++
    try {
      await dispatchOutboxEvent(candidate)
      await prisma.subscriptionOutbox.update({
        where: { id: candidate.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      })
      completed++
    } catch (error) {
      const attempts = candidate.attempts + 1
      const delayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10))
      await prisma.subscriptionOutbox.update({
        where: { id: candidate.id },
        data: {
          status: 'FAILED',
          lockedAt: null,
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60 * 1000),
        },
      })
      failed++
    }
  }
  return { attempted, completed, failed }
}

/** 立即嘗試單一訂單發票工作；失敗仍保留在 outbox 供 maintenance 重試。 */
export async function processOrderInvoiceOutbox(
  orderId: string,
  eventType: OrderInvoiceOutboxEventType
): Promise<{ success: boolean; error?: string }> {
  const dedupeKey = orderInvoiceOutboxKey(orderId, eventType)
  await processSubscriptionOutbox({ dedupeKeys: [dedupeKey], limit: 1 })
  const row = await prisma.subscriptionOutbox.findUnique({
    where: { dedupeKey },
    select: { status: true, lastError: true },
  })
  if (!row) return { success: false, error: '找不到發票 outbox 記錄' }
  return row.status === 'COMPLETED'
    ? { success: true }
    : { success: false, error: row.lastError ?? '發票工作已保留等待重試' }
}
