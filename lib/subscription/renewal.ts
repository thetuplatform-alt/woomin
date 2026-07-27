// lib/subscription/renewal.ts
// 兩 gateway（Stripe / PAYUNi）共用的期款處理核心。
// 嚴格照 PRD §4.3~4.5 實作，是訂閱制正確性的核心。
//
// 三個 export：
//   - processSubscriptionPeriodPaid：成功期款（首期 update 預建 Order / 續期 create）
//   - processSubscriptionPeriodFailed：失敗期款（轉 PAST_DUE，去重寄信）
//   - processAnomalousPeriodPayment：終態後的晚到扣款（不展期、自動退款、告警）
//
// 冪等鍵：Order.gatewayPeriodKey @unique（Stripe=invoice id、PAYUNi=PeriodOrderNo）。
// paidPeriods 唯一合法定義：該訂閱 PAID 期款 Order 的交易內 count。
//
// 說明：webhook 驅動的告警沒有真實觸發者，AdminLog.adminId 為必填且有 User FK。
// 異常期款（終態後晚到扣款）除了「attentionReason 標記 + 管理員告警信 + console」外，
// 另以 logSystemAnomalousPeriod() 記一筆 AdminLog（AC-76 / PRD §4.4）——歸屬到系統
// 管理員帳號（第一個 ADMIN 使用者）以滿足 FK；無 ADMIN 時 best-effort 略過。
// 金額不符僅告警不記 AdminLog（非終態異常，屬正常入帳）。

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateOrderNo } from '@/lib/payment/shared'
import { upsertPaidPurchase } from '@/lib/purchase/upsert-paid-purchase'
import { consumeInviteForPaidOrder } from '@/lib/payment/post-payment-actions'
import { SUBSCRIPTION_GRACE_DAYS } from './constants'
import { sendAdminSubscriptionAlert } from './notifications'
import {
  enqueueSubscriptionOutbox,
  processSubscriptionOutbox,
  type SubscriptionOutboxEventType,
} from './outbox'

type Tx = Prisma.TransactionClient

/** 交易成功後要觸發的成功期款副作用 */
interface PaidSideEffects {
  kind: 'started' | 'renewal' | 'completed'
  orderId: string
  orderNo: string
  periodNumber: number
  amount: number
  amountMismatch: boolean
  snapshotAmount: number
  nextBillingAt: Date | null
  userId: string
  userEmail: string | null
  userName: string | null
  courseTitle: string
  planLabel: string
  totalPeriods: number | null
}

/** 加寬限天數 */
function addGraceDays(periodEnd: Date): Date {
  return new Date(
    periodEnd.getTime() + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000
  )
}

/** 期末取 max（防晚到 webhook 回退 currentPeriodEnd） */
function maxDate(a: Date | null, b: Date): Date {
  return !a || b.getTime() > a.getTime() ? b : a
}

/** Prisma P2002 unique 違反判斷 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  )
}

/** Serialize all state transitions for a subscription inside the current transaction. */
async function lockSubscription(tx: Tx, subscriptionId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "CourseSubscription" WHERE "id" = ${subscriptionId} FOR UPDATE`
}

// ============================================================
// 成功期款
// ============================================================

export interface ProcessPeriodPaidParams {
  /** 本地訂閱 id（呼叫端已由 gateway metadata / gatewayTradeNo 反查取得） */
  subscriptionId: string
  /** gateway 每期冪等鍵：Stripe=invoice id、PAYUNi=PeriodOrderNo */
  gatewayPeriodKey: string
  /** 期別編號：PAYUNi 給 ThisPeriod；Stripe 不給（由交易內推導） */
  periodNumber?: number | null
  /** gateway 回報的實扣金額（Stripe invoice.amount_paid/100、PAYUNi AuthAmt） */
  actualAmount: number
  /** 本期期末（Stripe=invoice line period.end / item current_period_end；PAYUNi=NextAuthDate 或週期推算） */
  periodEndAt: Date
  /** gateway 首次記錄用（Stripe subscription id / PAYUNi PeriodTradeNo）；首期補寫 */
  gatewaySubscriptionId?: string | null
  /** gateway 原始回應（存入 Order.stripeResponse 供對帳） */
  gatewayMeta?: Prisma.InputJsonValue
  /** Stripe invoice/payment references used by refund and reconciliation. */
  gatewayInvoiceId?: string | null
  gatewayPaymentId?: string | null
  hostedInvoiceUrl?: string | null
  /** 是否為首期（Stripe billing_reason=subscription_create / PAYUNi PeriodOrderNo 尾碼 _1） */
  isFirstPeriod: boolean
}

export interface ProcessPeriodPaidResult {
  /** 'processed'（本次完成入帳）| 'duplicate'（冪等命中，零副作用）| 'anomalous'（訂閱處於終態，走異常期款） */
  outcome: 'processed' | 'duplicate' | 'anomalous'
  /** 期滿轉永久後需呼叫 gateway 取消（Stripe），旗標給呼叫端於交易外執行 */
  needsGatewayCancel: boolean
  orderId?: string
  periodNumber?: number
}

/**
 * 處理一筆成功的訂閱期款（首期 / 續期共用）。
 *
 * 交易內：
 *   status 檢查（非 ACTIVE/PAST_DUE，且非「首期 PENDING 例外」→ 走異常期款）
 *   → 首期：update 預建的 (subscriptionId, periodNumber=1) PENDING Order 轉 PAID
 *     續期：以 gatewayPeriodKey 原子 create（unique 衝突 = 重複通知，冪等返回）
 *   → paidPeriods = 交易內 count 該訂閱 PAID 期款 Order
 *   → currentPeriodEnd = max(現值, 新期末)
 *   → 訂閱轉 ACTIVE、記 gatewaySubscriptionId、lastPaymentAt
 *   → Purchase 展期（source SUBSCRIPTION、expiresAt = periodEnd + 寬限、清未來提醒）
 *   → 期滿判定（FIXED_TERM 且 paidPeriods ≥ totalPeriods）：COMPLETED，GRANT_LIFETIME 轉永久，回傳 needsGatewayCancel
 * 交易外：發票、通知、PostHog、金額不符告警。
 */
export async function processSubscriptionPeriodPaid(
  params: ProcessPeriodPaidParams
): Promise<ProcessPeriodPaidResult> {
  const {
    subscriptionId,
    gatewayPeriodKey,
    actualAmount,
    periodEndAt,
    gatewaySubscriptionId,
    gatewayMeta,
    gatewayInvoiceId,
    gatewayPaymentId,
    hostedInvoiceUrl,
    isFirstPeriod,
  } = params

  if (!gatewayPeriodKey || gatewayPeriodKey.length > 255) {
    throw new Error('期款冪等鍵格式錯誤')
  }
  if (!Number.isInteger(actualAmount) || actualAmount < 0 || actualAmount > 199_999) {
    throw new Error('期款金額格式錯誤')
  }
  if (Number.isNaN(periodEndAt.getTime())) {
    throw new Error('期款截止日格式錯誤')
  }
  if (
    params.periodNumber != null &&
    (!Number.isInteger(params.periodNumber) ||
      params.periodNumber < 1 ||
      params.periodNumber > 900)
  ) {
    throw new Error('期款期別格式錯誤')
  }

  let sideEffects: PaidSideEffects | null = null
  let outboxKeys: string[] = []
  let result: ProcessPeriodPaidResult = {
    outcome: 'duplicate',
    needsGatewayCancel: false,
  }

  await prisma.$transaction(async (tx) => {
    await lockSubscription(tx, subscriptionId)
    const sub = await tx.courseSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: { select: { label: true } },
        course: { select: { title: true } },
        user: { select: { email: true, name: true } },
      },
    })

    if (!sub) {
      throw new Error(`Subscription not found: ${subscriptionId}`)
    }

    // 先做全域事件冪等，再判斷狀態。終態後重送已入帳事件不是異常新扣款。
    const eventOrder = await tx.order.findUnique({
      where: { gatewayPeriodKey },
    })
    if (eventOrder && eventOrder.subscriptionId !== subscriptionId) {
      throw new Error('期款冪等鍵已綁定至其他訂閱')
    }
    if (eventOrder?.status === 'PAID' || eventOrder?.status === 'REFUNDED') {
      await tx.order.update({
        where: { id: eventOrder.id },
        data: {
          gatewayInvoiceId: gatewayInvoiceId ?? eventOrder.gatewayInvoiceId,
          stripePaymentIntentId:
            gatewayPaymentId ?? eventOrder.stripePaymentIntentId,
          hostedInvoiceUrl: hostedInvoiceUrl ?? eventOrder.hostedInvoiceUrl,
        },
      })
      result = { outcome: 'duplicate', needsGatewayCancel: false }
      return
    }

    // status 閘：取消請求一旦持久化，任何晚到扣款都不得恢復訂閱或 Purchase。
    const isFirstPeriodPending = isFirstPeriod && sub.status === 'PENDING'
    const isRenewableState = sub.status === 'ACTIVE' || sub.status === 'PAST_DUE'
    const mismatchedGatewaySubscription =
      !!sub.gatewaySubscriptionId &&
      !!gatewaySubscriptionId &&
      sub.gatewaySubscriptionId !== gatewaySubscriptionId
    if (
      sub.cancelRequestedAt ||
      mismatchedGatewaySubscription ||
      (!isRenewableState && !isFirstPeriodPending)
    ) {
      // CANCELED / COMPLETED / 作廢的 PENDING → 異常期款（交易外處理）
      result = { outcome: 'anomalous', needsGatewayCancel: false }
      return
    }

    // ---- 建立 / 更新期款 Order ----
    let order: { id: string; orderNo: string; periodNumber: number }

    if (isFirstPeriod) {
      // 首期：更新預建的 (subscriptionId, periodNumber=1) PENDING Order
      const existingFirst = await tx.order.findUnique({
        where: {
          subscriptionId_periodNumber: { subscriptionId, periodNumber: 1 },
        },
      })

      if (!existingFirst) {
        throw new Error(
          `First-period order missing for subscription ${subscriptionId}`
        )
      }

      // 已入帳（PAID）→ 冪等返回
      if (existingFirst.status === 'PAID' || existingFirst.status === 'REFUNDED') {
        await tx.order.update({
          where: { id: existingFirst.id },
          data: {
            gatewayInvoiceId: gatewayInvoiceId ?? existingFirst.gatewayInvoiceId,
            stripePaymentIntentId:
              gatewayPaymentId ?? existingFirst.stripePaymentIntentId,
            hostedInvoiceUrl: hostedInvoiceUrl ?? existingFirst.hostedInvoiceUrl,
          },
        })
        result = { outcome: 'duplicate', needsGatewayCancel: false }
        return
      }

      const updated = await tx.order.updateMany({
        where: { id: existingFirst.id, status: { in: ['PENDING', 'FAILED'] } },
        data: {
          status: 'PAID',
          amount: actualAmount,
          gatewayPeriodKey,
          paidAt: new Date(),
          stripeResponse: gatewayMeta ?? undefined,
          gatewayInvoiceId: gatewayInvoiceId ?? undefined,
          stripePaymentIntentId: gatewayPaymentId ?? undefined,
          hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
          paymentGateway: sub.gateway,
        },
      })
      if (updated.count === 0) {
        // 併發：另一路徑已轉 PAID → 冪等返回
        result = { outcome: 'duplicate', needsGatewayCancel: false }
        return
      }
      order = {
        id: existingFirst.id,
        orderNo: existingFirst.orderNo,
        periodNumber: 1,
      }
    } else {
      // 續期：失敗 attempt 轉成功，或在 row lock 下建立下一期。
      const periodNumber =
        eventOrder?.periodNumber ??
        (await deriveNextPeriodNumber(tx, subscriptionId, params.periodNumber))
      try {
        const created = eventOrder
          ? await tx.order.update({
              where: { id: eventOrder.id },
              data: {
                status: 'PAID',
                amount: actualAmount,
                paidAt: new Date(),
                stripeResponse: gatewayMeta ?? undefined,
                gatewayInvoiceId: gatewayInvoiceId ?? undefined,
                stripePaymentIntentId: gatewayPaymentId ?? undefined,
                hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
              },
            })
          : await tx.order.create({
              data: {
            orderNo: generateOrderNo(),
            userId: sub.userId,
            courseId: sub.courseId,
            subscriptionId,
            periodNumber,
            gatewayPeriodKey,
            amount: actualAmount,
            originalAmount: sub.pricePerPeriod,
            status: 'PAID',
            paidAt: new Date(),
            paymentGateway: sub.gateway,
            stripeResponse: gatewayMeta ?? undefined,
            gatewayInvoiceId: gatewayInvoiceId ?? undefined,
            stripePaymentIntentId: gatewayPaymentId ?? undefined,
            hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
            // 發票偏好由訂閱快照複製（webhook 無結帳表單）
            invoiceType: sub.invoiceType,
            invoiceCarrierType: sub.invoiceCarrierType,
            invoiceCarrierId: sub.invoiceCarrierId,
            invoiceTaxId: sub.invoiceTaxId,
            invoiceTitle: sub.invoiceTitle,
            invoiceLoveCode: sub.invoiceLoveCode,
            invoiceAddress: sub.invoiceAddress,
              },
            })
        order = {
          id: created.id,
          orderNo: created.orderNo,
          periodNumber,
        }
      } catch (err) {
        if (isUniqueViolation(err)) {
          // row lock 下仍撞 period 代表資料已存在；只把相同 gateway key 視為冪等，
          // 不可吞掉不同 invoice 的合法付款。
          const same = await tx.order.findUnique({ where: { gatewayPeriodKey } })
          if (same) {
            result = { outcome: 'duplicate', needsGatewayCancel: false }
            return
          }
          throw err
        }
        throw err
      }
    }

    // ---- paidPeriods = 交易內 count 該訂閱 PAID 期款 Order ----
    const paidPeriods = await tx.order.count({
      where: { subscriptionId, status: 'PAID' },
    })
    const outstandingFailure = await tx.order.findFirst({
      where: { subscriptionId, status: 'FAILED' },
      orderBy: [{ periodNumber: 'asc' }, { createdAt: 'asc' }],
      select: { periodNumber: true, gatewayPeriodKey: true },
    })

    // ---- currentPeriodEnd = max(現值, 新期末) ----
    const nextPeriodEnd = maxDate(sub.currentPeriodEnd, periodEndAt)

    // ---- 期滿判定（FIXED_TERM）----
    const isFixedTerm = sub.planType === 'FIXED_TERM' && sub.totalPeriods != null
    const isTermComplete =
      isFixedTerm && paidPeriods >= (sub.totalPeriods as number)
    const grantsLifetime =
      isTermComplete && sub.termEndBehavior === 'GRANT_LIFETIME'

    // ---- 更新訂閱狀態 ----
    await tx.courseSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: isTermComplete
          ? 'COMPLETED'
          : outstandingFailure
            ? 'PAST_DUE'
            : 'ACTIVE',
        paidPeriods,
        currentPeriodEnd: nextPeriodEnd,
        lastPaymentAt: new Date(),
        completedAt: isTermComplete ? new Date() : undefined,
        gatewaySubscriptionId:
          gatewaySubscriptionId ?? sub.gatewaySubscriptionId ?? undefined,
        lastFailedPeriodNumber: outstandingFailure?.periodNumber ?? null,
        lastFailedPeriodKey: outstandingFailure?.gatewayPeriodKey ?? null,
        attentionReason:
          isTermComplete ||
          (!outstandingFailure && sub.attentionReason === 'TERM_ENDED_UNDERPAID')
            ? null
            : outstandingFailure
              ? sub.attentionReason
              : null,
      },
    })

    // ---- Purchase 展期 ----
    // GRANT_LIFETIME 轉永久 → expiresAt = null；否則 = 期末 + 寬限
    const purchaseExpiresAt = grantsLifetime ? null : addGraceDays(nextPeriodEnd)
    await upsertPaidPurchase({
      tx,
      userId: sub.userId,
      courseId: sub.courseId,
      orderId: order.id,
      source: 'SUBSCRIPTION',
      expiresAtOverride: purchaseExpiresAt,
      clearFutureReminders: true,
    })
    if (isFirstPeriod) {
      await consumeInviteForPaidOrder(tx, order.id, sub.courseId)
    }

    result = {
      outcome: 'processed',
      needsGatewayCancel: isTermComplete, // 期滿 → 交易外呼叫 gateway cancel（Stripe）
      orderId: order.id,
      periodNumber: order.periodNumber,
    }

    const paidEffects: PaidSideEffects = {
      kind: isTermComplete ? 'completed' : isFirstPeriod ? 'started' : 'renewal',
      orderId: order.id,
      orderNo: order.orderNo,
      periodNumber: order.periodNumber,
      amount: actualAmount,
      amountMismatch: actualAmount !== sub.pricePerPeriod,
      snapshotAmount: sub.pricePerPeriod,
      nextBillingAt: isTermComplete ? null : nextPeriodEnd,
      userId: sub.userId,
      userEmail: sub.user.email,
      userName: sub.user.name,
      courseTitle: sub.course.title,
      planLabel: sub.plan.label,
      totalPeriods: sub.totalPeriods,
    }
    sideEffects = paidEffects
    outboxKeys = await enqueuePaidSideEffects(tx, subscriptionId, paidEffects)
  })

  // 交易已提交；立即嘗試一次。失敗項目留在 durable outbox，由 maintenance 重試。
  if (result.outcome === 'processed' && sideEffects && outboxKeys.length > 0) {
    await processSubscriptionOutbox({
      dedupeKeys: outboxKeys,
      limit: outboxKeys.length,
      deadline: Date.now() + 2_000,
    })
  }

  return result
}

/**
 * 推導續期的 periodNumber。
 * PAYUNi 提供 ThisPeriod（直接用）；Stripe 不給 → 取「現有期款數 + 1」，
 * 若與既有 (subscriptionId, periodNumber) 撞鍵，由 create 的 unique 衝突捕捉冪等返回。
 */
async function deriveNextPeriodNumber(
  tx: Tx,
  subscriptionId: string,
  provided?: number | null
): Promise<number> {
  if (provided != null) return provided
  const latest = await tx.order.findFirst({
    where: { subscriptionId, periodNumber: { not: null } },
    orderBy: { periodNumber: 'desc' },
    select: { periodNumber: true },
  })
  return (latest?.periodNumber ?? 0) + 1
}

/** 與入帳交易同時寫入 outbox；每個外部副作用使用獨立冪等鍵。 */
async function enqueuePaidSideEffects(
  tx: Tx,
  subscriptionId: string,
  fx: PaidSideEffects
): Promise<string[]> {
  const keys: string[] = []
  const enqueue = async (
    suffix: string,
    eventType: SubscriptionOutboxEventType,
    payload: Prisma.InputJsonObject,
    orderId: string | null = fx.orderId
  ) => {
    const dedupeKey = `subscription:${fx.orderId}:${suffix}`
    await enqueueSubscriptionOutbox(tx, {
      dedupeKey,
      eventType,
      subscriptionId,
      orderId,
      payload,
    })
    keys.push(dedupeKey)
  }

  const common: Prisma.InputJsonObject = {
    userName: fx.userName,
    courseTitle: fx.courseTitle,
    planLabel: fx.planLabel,
    amount: fx.amount,
    periodNumber: fx.periodNumber,
    orderNo: fx.orderNo,
    nextBillingAt: fx.nextBillingAt?.toISOString() ?? null,
  }

  await enqueue('invoice', 'ISSUE_INVOICE', {})
  if (fx.userEmail) {
    const emailPayload = { ...common, toEmail: fx.userEmail }
    if (fx.kind === 'started' || (fx.kind === 'completed' && fx.periodNumber === 1)) {
      await enqueue('email-started', 'EMAIL_STARTED', emailPayload)
    } else {
      await enqueue('email-renewal', 'EMAIL_RENEWAL', emailPayload)
    }
    if (fx.kind === 'completed') {
      await enqueue('email-completed', 'EMAIL_COMPLETED', {
        ...emailPayload,
        totalPeriods: fx.totalPeriods ?? fx.periodNumber,
      })
    }
  }

  if (fx.amountMismatch) {
    console.warn(
      `[subscription] 期款金額不符 sub=${subscriptionId} 快照=${fx.snapshotAmount} 實扣=${fx.amount} order=${fx.orderNo}`
    )
    await enqueue('admin-amount-mismatch', 'ADMIN_ALERT_AMOUNT_MISMATCH', {
      courseTitle: fx.courseTitle,
      userEmail: fx.userEmail,
      detail: `期款金額與方案快照不符（快照 ${fx.snapshotAmount}、實扣 ${fx.amount}）`,
    })
    await createSystemPaymentAdminLog(tx, {
      subscriptionId,
      orderId: fx.orderId,
      event: 'SUBSCRIPTION_AMOUNT_MISMATCH',
      details: {
        orderNo: fx.orderNo,
        periodNumber: fx.periodNumber,
        snapshotAmount: fx.snapshotAmount,
        actualAmount: fx.amount,
      },
    })
  }

  const analyticsEvent =
    fx.kind === 'started'
      ? 'subscription_started'
      : fx.kind === 'completed'
        ? 'subscription_completed'
        : 'subscription_renewed'
  await enqueue('analytics', 'ANALYTICS_SUBSCRIPTION', {
    distinctId: fx.userId,
    event: analyticsEvent,
    properties: {
      subscription_id: subscriptionId,
      order_no: fx.orderNo,
      period_number: fx.periodNumber,
      amount: fx.amount,
      currency: 'TWD',
    },
  })
  return keys
}

// ============================================================
// 失敗期款（dunning）
// ============================================================

export interface ProcessPeriodFailedParams {
  subscriptionId: string
  gatewayPeriodKey: string
  periodNumber?: number | null
  actualAmount?: number | null
  isFirstPeriod?: boolean
  isFinalScheduledPeriod?: boolean
  gatewayInvoiceId?: string | null
  gatewayPaymentId?: string | null
  gatewayMeta?: Prisma.InputJsonValue
  hostedInvoiceUrl?: string | null
}

/**
 * 處理失敗期款：轉 PAST_DUE。
 * 失敗信 / PostHog 僅在「狀態首次由 ACTIVE→PAST_DUE 轉態時」寄一次（去重），
 * 避免 Smart Retries 每次重試都發事件而轟炸用戶。
 */
export async function processSubscriptionPeriodFailed(
  params: ProcessPeriodFailedParams
): Promise<{ transitioned: boolean; ignoredAsStale: boolean; orderId?: string }> {
  const {
    subscriptionId,
    gatewayPeriodKey,
    hostedInvoiceUrl,
    gatewayInvoiceId,
    gatewayPaymentId,
    gatewayMeta,
  } = params

  if (!gatewayPeriodKey || gatewayPeriodKey.length > 255) {
    throw new Error('失敗期款冪等鍵格式錯誤')
  }
  if (
    params.periodNumber != null &&
    (!Number.isInteger(params.periodNumber) ||
      params.periodNumber < 1 ||
      params.periodNumber > 900)
  ) {
    throw new Error('失敗期款期別格式錯誤')
  }

  let transitioned = false
  let ignoredAsStale = false
  let failedOrderId: string | undefined
  const failedOutboxKeys: string[] = []
  let alertCtx: {
    userEmail: string | null
    userName: string | null
    courseTitle: string
    gateway: string
    accessEndsAt: Date | null
  } | null = null

  await prisma.$transaction(async (tx) => {
    await lockSubscription(tx, subscriptionId)
    const sub = await tx.courseSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        course: { select: { title: true } },
        user: { select: { email: true, name: true } },
      },
    })
    if (!sub) return

    if (
      sub.cancelRequestedAt ||
      sub.status === 'CANCELED' ||
      sub.status === 'COMPLETED'
    ) {
      ignoredAsStale = true
      return
    }

    const existingEventOrder = await tx.order.findUnique({
      where: { gatewayPeriodKey },
    })
    if (
      existingEventOrder &&
      existingEventOrder.subscriptionId !== subscriptionId
    ) {
      throw new Error('失敗期款冪等鍵已綁定至其他訂閱')
    }
    if (
      existingEventOrder?.status === 'PAID' ||
      existingEventOrder?.status === 'REFUNDED'
    ) {
      // 付款成功後晚到的失敗通知不得把 ACTIVE 降回 PAST_DUE。
      ignoredAsStale = true
      return
    }

    const periodNumber =
      existingEventOrder?.periodNumber ??
      (await deriveNextPeriodNumber(tx, subscriptionId, params.periodNumber))

    let targetOrder = existingEventOrder
    if (!targetOrder && params.isFirstPeriod) {
      targetOrder = await tx.order.findUnique({
        where: {
          subscriptionId_periodNumber: { subscriptionId, periodNumber: 1 },
        },
      })
    }
    if (!targetOrder) {
      targetOrder = await tx.order.findUnique({
        where: {
          subscriptionId_periodNumber: { subscriptionId, periodNumber },
        },
      })
    }

    if (targetOrder?.status === 'PAID' || targetOrder?.status === 'REFUNDED') {
      ignoredAsStale = true
      return
    }

    if (targetOrder) {
      const updated = await tx.order.update({
        where: { id: targetOrder.id },
        data: {
          status: 'FAILED',
          periodNumber,
          gatewayPeriodKey,
          amount: params.actualAmount ?? targetOrder.amount,
          gatewayInvoiceId: gatewayInvoiceId ?? targetOrder.gatewayInvoiceId,
          stripePaymentIntentId:
            gatewayPaymentId ?? targetOrder.stripePaymentIntentId,
          hostedInvoiceUrl: hostedInvoiceUrl ?? targetOrder.hostedInvoiceUrl,
          stripeResponse: gatewayMeta ?? targetOrder.stripeResponse ?? undefined,
        },
      })
      failedOrderId = updated.id
    } else {
      const created = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          userId: sub.userId,
          courseId: sub.courseId,
          subscriptionId,
          periodNumber,
          gatewayPeriodKey,
          amount: params.actualAmount ?? sub.pricePerPeriod,
          originalAmount: sub.pricePerPeriod,
          status: 'FAILED',
          paymentGateway: sub.gateway,
          gatewayInvoiceId: gatewayInvoiceId ?? undefined,
          stripePaymentIntentId: gatewayPaymentId ?? undefined,
          hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
          stripeResponse: gatewayMeta ?? undefined,
          invoiceType: sub.invoiceType,
          invoiceCarrierType: sub.invoiceCarrierType,
          invoiceCarrierId: sub.invoiceCarrierId,
          invoiceTaxId: sub.invoiceTaxId,
          invoiceTitle: sub.invoiceTitle,
          invoiceLoveCode: sub.invoiceLoveCode,
          invoiceAddress: sub.invoiceAddress,
        },
      })
      failedOrderId = created.id
    }

    const shouldFlagUnderpaid =
      params.isFinalScheduledPeriod &&
      sub.planType === 'FIXED_TERM' &&
      sub.totalPeriods != null
    await tx.courseSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'PAST_DUE',
        lastFailedPeriodNumber: periodNumber,
        lastFailedPeriodKey: gatewayPeriodKey,
        attentionReason: shouldFlagUnderpaid
          ? 'TERM_ENDED_UNDERPAID'
          : sub.attentionReason,
      },
    })
    transitioned = sub.status !== 'PAST_DUE'
    alertCtx = {
      userEmail: sub.user.email,
      userName: sub.user.name,
      courseTitle: sub.course.title,
      gateway: sub.gateway,
      accessEndsAt: sub.currentPeriodEnd
        ? addGraceDays(sub.currentPeriodEnd)
        : null,
    }
    if (transitioned && failedOrderId) {
      const emailPayload: Prisma.InputJsonObject = {
        userName: sub.user.name,
        courseTitle: sub.course.title,
        gateway: sub.gateway,
        hostedInvoiceUrl,
        accessEndsAt: sub.currentPeriodEnd
          ? addGraceDays(sub.currentPeriodEnd).toISOString()
          : null,
        ...(sub.user.email ? { toEmail: sub.user.email } : {}),
      }
      if (sub.user.email) {
        const key = `subscription:${failedOrderId}:email-payment-failed`
        await enqueueSubscriptionOutbox(tx, {
          dedupeKey: key,
          eventType: 'EMAIL_PAYMENT_FAILED',
          subscriptionId,
          orderId: failedOrderId,
          payload: emailPayload,
        })
        failedOutboxKeys.push(key)
      }
      const adminKey = `subscription:${failedOrderId}:admin-past-due`
      await enqueueSubscriptionOutbox(tx, {
        dedupeKey: adminKey,
        eventType: 'ADMIN_ALERT_PAST_DUE',
        subscriptionId,
        orderId: failedOrderId,
        payload: {
          courseTitle: sub.course.title,
          userEmail: sub.user.email,
        },
      })
      failedOutboxKeys.push(adminKey)

      const analyticsKey = `subscription:${failedOrderId}:analytics-failed`
      await enqueueSubscriptionOutbox(tx, {
        dedupeKey: analyticsKey,
        eventType: 'ANALYTICS_SUBSCRIPTION',
        subscriptionId,
        orderId: failedOrderId,
        payload: {
          distinctId: sub.userId,
          event: 'subscription_payment_failed',
          properties: { subscription_id: subscriptionId, gateway: sub.gateway },
        },
      })
      failedOutboxKeys.push(analyticsKey)
    }
  })

  if (transitioned && alertCtx && failedOutboxKeys.length > 0) {
    await processSubscriptionOutbox({
      dedupeKeys: failedOutboxKeys,
      limit: failedOutboxKeys.length,
      deadline: Date.now() + 2_000,
    })
  }

  return { transitioned, ignoredAsStale, orderId: failedOrderId }
}

// ============================================================
// 異常期款（終態後的晚到扣款）
// ============================================================

export interface ProcessAnomalousPeriodParams {
  subscriptionId: string
  gatewayPeriodKey: string
  actualAmount: number
  gatewayMeta?: Prisma.InputJsonValue
  gatewayInvoiceId?: string | null
  gatewayPaymentId?: string | null
  hostedInvoiceUrl?: string | null
}

/**
 * 終態後的晚到扣款（訂閱 CANCELED/COMPLETED，或 PENDING 已作廢）。
 * 不展期、不建正常期款：
 *   - 建立標記異常的 Order（gatewayPeriodKey 冪等；attentionReason 記在訂閱）
 *   - Stripe：交易外由呼叫端 gateway.processRefund 自動退款
 *   - PAYUNi：requiresManualRefund=true，標記需人工退款
 *   - 管理員告警（CANCELED 的 PAYUNi 訂閱代表 mdfStatus end 未生效，告警明示）
 */
export async function processAnomalousPeriodPayment(
  params: ProcessAnomalousPeriodParams
): Promise<{
  handled: boolean
  orderId?: string
  requiresManualRefund: boolean
}> {
  const { subscriptionId, gatewayPeriodKey, actualAmount, gatewayMeta } = params

  let orderId: string | undefined
  let requiresManualRefund = false
  let alert: {
    courseTitle: string
    userEmail: string | null
    gateway: string
  } | null = null

  await prisma.$transaction(async (tx) => {
    const sub = await tx.courseSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        course: { select: { title: true } },
        user: { select: { email: true } },
      },
    })
    if (!sub) throw new Error(`Subscription not found: ${subscriptionId}`)

    // 冪等：同 gatewayPeriodKey 已建過異常 Order → 不重複
    const existing = await tx.order.findUnique({
      where: { gatewayPeriodKey },
    })
    if (existing) {
      if (existing.subscriptionId !== subscriptionId) {
        throw new Error('異常期款冪等鍵已綁定至其他訂閱')
      }
      orderId = existing.id
      return
    }

    const created = await tx.order
      .create({
        data: {
          orderNo: generateOrderNo(),
          userId: sub.userId,
          courseId: sub.courseId,
          subscriptionId,
          // periodNumber 留空：異常期款不佔正常期序，避免撞 (subscriptionId, periodNumber)
          gatewayPeriodKey,
          amount: actualAmount,
          originalAmount: sub.pricePerPeriod,
          status: 'PAID',
          paidAt: new Date(),
          paymentGateway: sub.gateway,
          refundReason: 'ANOMALOUS_SUBSCRIPTION_PERIOD',
          refundStatus: sub.gateway === 'stripe' ? 'PROCESSING' : 'PENDING_MANUAL',
          refundRequestedAt: new Date(),
          gatewayInvoiceId: params.gatewayInvoiceId ?? undefined,
          stripePaymentIntentId: params.gatewayPaymentId ?? undefined,
          hostedInvoiceUrl: params.hostedInvoiceUrl ?? undefined,
          stripeResponse: gatewayMeta ?? undefined,
        },
      })
      .catch((err) => {
        if (isUniqueViolation(err)) return null
        throw err
      })

    if (!created) return // 併發冪等
    orderId = created.id
    requiresManualRefund = sub.gateway === 'payuni'

    await tx.courseSubscription.update({
      where: { id: subscriptionId },
      data: { attentionReason: 'ANOMALOUS_PERIOD_PAYMENT' },
    })

    alert = {
      courseTitle: sub.course.title,
      userEmail: sub.user.email,
      gateway: sub.gateway,
    }

    await createSystemPaymentAdminLog(tx, {
      subscriptionId,
      orderId: created.id,
      event: 'ANOMALOUS_PERIOD_PAYMENT',
      details: {
        gatewayPeriodKey,
        actualAmount,
        gateway: sub.gateway,
        requiresManualRefund,
      },
    })
  })

  if (alert) {
    const a = alert as {
      courseTitle: string
      userEmail: string | null
      gateway: string
    }
    sendAdminSubscriptionAlert({
      reason: 'ANOMALOUS_PERIOD_PAYMENT',
      subscriptionId,
      courseTitle: a.courseTitle,
      userEmail: a.userEmail,
      detail: requiresManualRefund
        ? 'PAYUNi 終態後仍扣款，mdfStatus end 可能未生效，需人工退款'
        : '終態後晚到扣款，將嘗試自動退款',
    }).catch(() => {})
  }

  return { handled: !!orderId, orderId, requiresManualRefund }
}

/**
 * 記錄異常期款到 AdminLog（AC-76 / PRD §4.4）。
 *
 * webhook 路徑沒有真實操作者，但 AdminLog.adminId 為必填且有 User FK。
 * 折衷：歸屬到系統管理員帳號（第一個 ADMIN 使用者）；details 標明為系統偵測。
 * action 沿用 subscriptions-admin 的慣例（AdminAction enum 無異常期款細分值 →
 * 用 UPDATE_SETTINGS，細節放 details，避免為此加 enum 值再做 migration）。
 * 無 ADMIN 使用者時 best-effort 略過；任何失敗僅記 console，不阻斷退款 / 告警流程。
 */
async function createSystemPaymentAdminLog(
  tx: Tx,
  params: {
  subscriptionId: string
  orderId: string
  event: string
  details: Prisma.InputJsonObject
  }
): Promise<void> {
    const systemAdmin = await tx.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!systemAdmin) return

    await tx.adminLog.create({
      data: {
        adminId: systemAdmin.id,
        action: 'PROCESS_REFUND',
        targetType: 'CourseSubscription',
        targetId: params.subscriptionId,
        details: {
          event: params.event,
          system: true,
          orderId: params.orderId,
          ...params.details,
        },
      },
    })
}
