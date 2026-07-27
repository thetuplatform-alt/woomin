// lib/subscription/maintenance.ts
// 訂閱制維運 tick（PRD §8）。
//
// 訂閱扣款本身零排程（gateway 代管排程）；此 tick 只負責「時間驅動」的維運工作：
//   1. 心跳（upsert SiteSetting，後台據此顯示「排程未運作」告警）
//   2. 即將扣款提醒（AC-71：條件式 updateMany 先 claim reminderSentForPeriod 再寄）
//   3. 存取即將結束信（CANCELED / COMPLETED(END_ACCESS) 期末前 7 天，同樣先 claim）
//   4. stale PENDING 清理（>24h → CANCELED('checkout_abandoned')）
//   5. pendingGatewayCancelAt 重試（呼叫 gateway 取消，連續失敗記 CANCEL_RETRY_EXHAUSTED + 告警）
//   6. 異常偵測（webhook 失聯 → WEBHOOK_STALE + 管理員告警，已標記者去重不重寄）
//
// 每步檢查 budget 剩餘時間，超時即停（下次 tick 接續）。所有寫入以條件式 updateMany
// 原子 claim，多實例 / 重複觸發下不重寄、不重複扣款端動作（沿用 newsletter 引擎的樂觀鎖模式）。
//
// 觸發雙入口：GET /api/cron/subscription-maintenance（Bearer CRON_SECRET）與
// piggyback /api/cron/newsletter-dispatch（見各自 route）。

import { prisma } from '@/lib/prisma'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import {
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_HEARTBEAT_SETTING_KEY,
  SUBSCRIPTION_PENDING_STALE_HOURS,
} from './constants'
import {
  sendSubscriptionUpcomingRenewal,
  sendSubscriptionAccessEnding,
  sendAdminSubscriptionAlert,
} from './notifications'
import { processOrderInvoiceOutbox, processSubscriptionOutbox } from './outbox'
import {
  closeStripePendingCheckout,
  validateAndBindStripeSubscriptionPrice,
} from './stripe-billing'
import { StripeGateway } from '@/lib/payment/stripe-gateway'
import {
  finalizeOrderRefund,
  markOrderRefundFailed,
} from './refund-reconciliation'
import { cancelSubscription } from './service'
import { processSubscriptionPeriodPaid } from './renewal'
import type Stripe from 'stripe'
import { addBillingIntervals } from './calendar'
import {
  getPaidFirstPayUniPeriod,
  hasPayUniFirstPeriodPaymentEvidence,
  parsePayUniPeriodQuery,
  parsePayUniQueryBillingDate,
  type PayUniPeriodQueryResult,
} from './payuni-query'
import { PayUniGateway } from '@/lib/payment/payuni-gateway'
import { reconcileExpiredEcpayOnlineAllowances } from '@/lib/invoice/ecpay-online-allowance'

const DAY_MS = 24 * 60 * 60 * 1000

/** 存取即將結束信的提前天數（PRD §4.5 / §7）。 */
const ACCESS_ENDING_NOTICE_DAYS = 7

/**
 * piggyback 於 newsletter-dispatch 的維運 tick 「上次執行時間戳」SiteSetting key。
 * 與主 cron 心跳（SUBSCRIPTION_HEARTBEAT_SETTING_KEY）分離：心跳是「最近一次任何路徑跑過」，
 * 此 key 專供 piggyback 節流（每 20 小時最多從 newsletter 觸發一次），避免每分鐘的
 * newsletter cron 都連帶跑一次維運。純內部節流狀態，不註冊進 SETTING_KEYS。
 */
const SUBSCRIPTION_PIGGYBACK_LAST_RUN_KEY = 'subscription_maintenance_last_run_at'

/** piggyback 節流窗（小時）：距上次 piggyback 執行未滿此時數則跳過。 */
const SUBSCRIPTION_PIGGYBACK_INTERVAL_HOURS = 20

/** piggyback 執行的硬性預算（毫秒），確保 newsletter dispatch 仍有充足視窗（總和 <55s）。 */
const SUBSCRIPTION_PIGGYBACK_BUDGET_MS = 10_000

/** 單步處理筆數上限（避免單一步驟吃光整個預算，其餘留待下次 tick）。 */
const STEP_BATCH_LIMIT = 200

export interface RunMaintenanceOptions {
  /** 硬性時間預算（毫秒）；每步開始前檢查，超時即停由下次 tick 接續。 */
  budgetMs?: number
}

export interface RunMaintenanceResult {
  ok: boolean
  durationMs: number
  /** 是否因預算耗盡提前結束（下次 tick 需接續） */
  budgetExhausted: boolean
  steps: {
    outbox: { attempted: number; completed: number; failed: number }
    invoiceAllowances: { checked: number; confirmed: number; expired: number; failed: number }
    refunds: { checked: number; completed: number; failed: number }
    upcomingReminders: { claimed: number; sent: number }
    accessEndingNotices: { claimed: number; sent: number }
    stalePendingCanceled: number
    gatewayCancelRetries: { attempted: number; succeeded: number; exhausted: number }
    webhookStaleDetected: number
  }
}

/**
 * 訂閱維運 tick 主入口。
 * 依序執行六步，每步前檢查剩餘預算；任一步例外都被隔離（記錄後續跑），
 * 心跳一定會嘗試寫入（讓後台能觀測到 tick 有在動）。
 */
export async function runSubscriptionMaintenance(
  options: RunMaintenanceOptions = {}
): Promise<RunMaintenanceResult> {
  const startedAt = Date.now()
  const budgetMs = Math.max(1000, options.budgetMs ?? 30_000)
  const deadline = startedAt + budgetMs

  const result: RunMaintenanceResult = {
    ok: true,
    durationMs: 0,
    budgetExhausted: false,
    steps: {
      outbox: { attempted: 0, completed: 0, failed: 0 },
      invoiceAllowances: { checked: 0, confirmed: 0, expired: 0, failed: 0 },
      refunds: { checked: 0, completed: 0, failed: 0 },
      upcomingReminders: { claimed: 0, sent: 0 },
      accessEndingNotices: { claimed: 0, sent: 0 },
      stalePendingCanceled: 0,
      gatewayCancelRetries: { attempted: 0, succeeded: 0, exhausted: 0 },
      webhookStaleDetected: 0,
    },
  }

  const hasBudget = () => Date.now() < deadline

  // ---- 步驟 0：心跳（一定嘗試寫入；失敗不影響其餘步驟） ----
  await upsertHeartbeat().catch((err) => {
    console.error('[subscription-maintenance] 心跳寫入失敗:', err)
  })

  // ---- 步驟 0.5：付款提交後 durable outbox ----
  if (hasBudget()) {
    try {
      result.steps.outbox = await processSubscriptionOutbox({
        deadline,
        limit: 50,
      })
    } catch (err) {
      console.error('[subscription-maintenance] outbox 處理失敗:', err)
    }
  }

  // ---- 步驟 0.55：ECPay 線上折讓 callback 遺失／逾期對帳 ----
  if (hasBudget()) {
    try {
      result.steps.invoiceAllowances = await reconcileExpiredEcpayOnlineAllowances(
        25,
        deadline
      )
    } catch (err) {
      console.error('[subscription-maintenance] ECPay 線上折讓對帳失敗:', err)
    }
  }

  // ---- 步驟 0.6：Stripe 非同步退款對帳 ----
  if (hasBudget()) {
    try {
      result.steps.refunds = await reconcilePendingRefunds(deadline)
    } catch (err) {
      console.error('[subscription-maintenance] Stripe 退款對帳失敗:', err)
    }
  }

  // ---- 步驟 1：即將扣款提醒 ----
  if (hasBudget()) {
    try {
      result.steps.upcomingReminders = await processUpcomingReminders(deadline)
    } catch (err) {
      console.error('[subscription-maintenance] 即將扣款提醒失敗:', err)
    }
  }

  // ---- 步驟 2：存取即將結束信 ----
  if (hasBudget()) {
    try {
      result.steps.accessEndingNotices = await processAccessEndingNotices(deadline)
    } catch (err) {
      console.error('[subscription-maintenance] 存取即將結束信失敗:', err)
    }
  }

  // ---- 步驟 3：stale PENDING 清理 ----
  if (hasBudget()) {
    try {
      result.steps.stalePendingCanceled = await cleanupStalePending()
    } catch (err) {
      console.error('[subscription-maintenance] stale PENDING 清理失敗:', err)
    }
  }

  // ---- 步驟 4：pendingGatewayCancelAt 重試 ----
  if (hasBudget()) {
    try {
      result.steps.gatewayCancelRetries = await retryPendingGatewayCancels(deadline)
    } catch (err) {
      console.error('[subscription-maintenance] gateway 取消重試失敗:', err)
    }
  }

  // ---- 步驟 5：異常偵測（webhook 失聯） ----
  if (hasBudget()) {
    try {
      result.steps.webhookStaleDetected = await detectWebhookStale(deadline)
    } catch (err) {
      console.error('[subscription-maintenance] webhook 失聯偵測失敗:', err)
    }
  }

  result.budgetExhausted = !hasBudget()
  result.durationMs = Date.now() - startedAt
  return result
}

// ============================================================
// 步驟 0：心跳
// ============================================================

async function upsertHeartbeat(): Promise<void> {
  const nowIso = new Date().toISOString()
  await prisma.siteSetting.upsert({
    where: { key: SUBSCRIPTION_HEARTBEAT_SETTING_KEY },
    update: { value: nowIso },
    create: { key: SUBSCRIPTION_HEARTBEAT_SETTING_KEY, value: nowIso },
  })
}

async function reconcilePendingRefunds(
  deadline: number
): Promise<{ checked: number; completed: number; failed: number }> {
  const [orders, manualPayUniOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        paymentGateway: 'stripe',
        refundStatus: 'PROCESSING',
      },
      orderBy: { refundRequestedAt: 'asc' },
      take: 50,
    }),
    prisma.order.findMany({
      where: { paymentGateway: 'payuni', refundStatus: 'PROCESSING' },
      orderBy: { refundRequestedAt: 'asc' },
      take: 25,
    }),
  ])
  if (orders.length === 0 && manualPayUniOrders.length === 0) {
    return { checked: 0, completed: 0, failed: 0 }
  }

  let stripeGateway: StripeGateway | null = null
  if (orders.length > 0) {
    const gateway = await getGatewayByType('stripe')
    if (!(gateway instanceof StripeGateway)) {
      throw new Error('Stripe gateway type mismatch')
    }
    stripeGateway = gateway
  }
  let checked = 0
  let completed = 0
  let failed = 0
  for (const order of orders) {
    if (Date.now() >= deadline) break
    checked++
    try {
      if (!stripeGateway) throw new Error('Stripe gateway not configured')
      let refundId = order.gatewayRefundId
      let refundStatus: string
      if (!refundId) {
        const retried = await stripeGateway.processRefund({
          gatewayPaymentId: order.stripePaymentIntentId,
          orderNo: order.orderNo,
        })
        if (!retried.success) {
          await markOrderRefundFailed(order.id, retried.error ?? 'Stripe 退款重試失敗')
          failed++
          continue
        }
        refundId = retried.gatewayRefundId ?? null
        refundStatus = retried.pending ? 'pending' : 'succeeded'
        if (refundId) {
          await prisma.order.update({
            where: { id: order.id },
            data: { gatewayRefundId: refundId },
          })
        }
      } else {
        const refund = await stripeGateway.getStripeInstance().refunds.retrieve(refundId)
        refundStatus = refund.status ?? 'unknown'
      }
      if (refundStatus === 'failed' || refundStatus === 'canceled') {
        await markOrderRefundFailed(
          order.id,
          `Stripe refund ${refundId ?? 'unknown'} status=${refundStatus}`
        )
        failed++
        continue
      }
      if (refundStatus !== 'succeeded' || !refundId) continue

      const isAnomalous =
        order.refundReason === 'ANOMALOUS_SUBSCRIPTION_PERIOD'
      const finalized = await finalizeOrderRefund({
        orderId: order.id,
        reason: isAnomalous
          ? '異常訂閱期款自動退款'
          : order.refundReason ?? 'Stripe 退款完成',
        gatewayRefundId: refundId,
        terminateSubscription: !isAnomalous,
      })
      if (finalized.subscriptionId && !isAnomalous) {
        await cancelSubscription({
          subscriptionId: finalized.subscriptionId,
          reason: 'stripe_refund',
        })
      }
      const invoiceSync = await processOrderInvoiceOutbox(order.id, 'SYNC_INVOICE_REFUND')
      if (invoiceSync.success) completed++
      else {
        console.error('[subscription-maintenance] 退款發票沖銷待重試:', order.id, invoiceSync.error)
        failed++
      }
    } catch (error) {
      console.error('[subscription-maintenance] 單筆退款對帳失敗:', order.id, error)
    }
  }

  // PAYUNi 的 PROCESSING 只會出現在管理員已勾選「後台全額退款完成」之後；
  // 若程序恰好在 claim 與 finalize 之間重啟，可安全由 maintenance 收斂。
  for (const order of manualPayUniOrders) {
    if (Date.now() >= deadline) break
    checked++
    try {
      const finalized = await finalizeOrderRefund({
        orderId: order.id,
        reason: order.refundReason ?? 'PAYUNi 人工退款確認',
      })
      if (finalized.subscriptionId) {
        await cancelSubscription({
          subscriptionId: finalized.subscriptionId,
          reason: 'payuni_manual_refund',
        })
      }
      const invoiceSync = await processOrderInvoiceOutbox(order.id, 'SYNC_INVOICE_REFUND')
      if (invoiceSync.success) completed++
      else {
        console.error('[subscription-maintenance] PAYUNi 退款發票沖銷待重試:', order.id, invoiceSync.error)
        failed++
      }
    } catch (error) {
      console.error('[subscription-maintenance] PAYUNi 人工退款收斂失敗:', order.id, error)
    }
  }
  return { checked, completed, failed }
}

// ============================================================
// 步驟 1：即將扣款提醒（AC-71）
// ============================================================

/**
 * 找 ACTIVE 且 plan.renewalReminderDays 非 null 且 currentPeriodEnd - now ≤ N 天的訂閱，
 * 對每筆先以條件式 updateMany 原子 claim（reminderSentForPeriod = 下一期序）再寄，
 * 並發下只有一個 tick 能 claim 成功 → 不重寄。
 *
 * 「下一期序」= 已繳期數 + 1（即這封提醒對應的即將扣款期別）；
 * claim 條件 reminderSentForPeriod 不等於該期序，確保同一期只 claim/寄一次。
 */
async function processUpcomingReminders(
  deadline: number
): Promise<{ claimed: number; sent: number }> {
  const now = new Date()

  // 候選：ACTIVE、有下次扣款日、方案有設定提醒天數
  const candidates = await prisma.courseSubscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: { not: null, gt: now },
      plan: { renewalReminderDays: { not: null } },
    },
    select: {
      id: true,
      paidPeriods: true,
      pricePerPeriod: true,
      currentPeriodEnd: true,
      reminderSentForPeriod: true,
      user: { select: { email: true, name: true } },
      course: { select: { title: true } },
      plan: { select: { renewalReminderDays: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
    take: STEP_BATCH_LIMIT,
  })

  let claimed = 0
  let sent = 0

  for (const sub of candidates) {
    if (Date.now() >= deadline) break
    const reminderDays = sub.plan.renewalReminderDays
    const periodEnd = sub.currentPeriodEnd
    if (reminderDays == null || !periodEnd) continue

    // 是否已進入提醒視窗（currentPeriodEnd - now ≤ N 天）
    const windowStart = new Date(periodEnd.getTime() - reminderDays * DAY_MS)
    if (now < windowStart) continue

    // 這封提醒對應的「即將扣款期別」= 已繳期數 + 1
    const upcomingPeriod = sub.paidPeriods + 1

    // 已對此期寄過 → 跳過
    if (sub.reminderSentForPeriod != null && sub.reminderSentForPeriod >= upcomingPeriod) {
      continue
    }

    // 原子 claim：只有 reminderSentForPeriod 尚未到此期序者能 claim 成功
    const claimResult = await prisma.courseSubscription.updateMany({
      where: {
        id: sub.id,
        status: 'ACTIVE',
        OR: [
          { reminderSentForPeriod: null },
          { reminderSentForPeriod: { lt: upcomingPeriod } },
        ],
      },
      data: { reminderSentForPeriod: upcomingPeriod },
    })
    if (claimResult.count !== 1) continue // 併發下已被別的 tick claim
    claimed++

    // claim 成功後才寄（fire-and-forget 容錯，寄信失敗不回滾 claim——避免下次重寄）
    if (sub.user.email) {
      await sendSubscriptionUpcomingRenewal({
        subscriptionId: sub.id,
        toEmail: sub.user.email,
        userName: sub.user.name,
        courseTitle: sub.course.title,
        nextBillingAt: periodEnd,
        amount: sub.pricePerPeriod,
        periodNumber: upcomingPeriod,
      })
      sent++
    }
  }

  return { claimed, sent }
}

// ============================================================
// 步驟 2：存取即將結束信（AC-71）
// ============================================================

/**
 * CANCELED / COMPLETED(END_ACCESS) 且 currentPeriodEnd + 寬限 - now ≤ 7 天且 accessEndNoticeSentAt 為 null，
 * 先以條件式 updateMany 原子 claim（accessEndNoticeSentAt = now）再寄。
 *
 * 存取實際截止日 = currentPeriodEnd + 寬限；提醒視窗以此截止日為基準往前 7 天。
 * COMPLETED 但 GRANT_LIFETIME（已轉永久，currentPeriodEnd 仍有值但 Purchase.expiresAt=null）不寄——
 * 以 termEndBehavior='END_ACCESS' 篩掉 GRANT_LIFETIME。
 */
async function processAccessEndingNotices(
  deadline: number
): Promise<{ claimed: number; sent: number }> {
  const now = new Date()
  // 存取截止日（含寬限）落在「now ~ now+7 天」內者進入提醒視窗
  const noticeCutoff = new Date(now.getTime() + ACCESS_ENDING_NOTICE_DAYS * DAY_MS)
  // currentPeriodEnd + 寬限 ≤ noticeCutoff ⇔ currentPeriodEnd ≤ noticeCutoff - 寬限
  const periodEndUpperBound = new Date(
    noticeCutoff.getTime() - SUBSCRIPTION_GRACE_DAYS * DAY_MS
  )
  // 已完全過期（截止日已過 = currentPeriodEnd + 寬限 < now）者不再寄「即將結束」
  const periodEndLowerBound = new Date(now.getTime() - SUBSCRIPTION_GRACE_DAYS * DAY_MS)

  const candidates = await prisma.courseSubscription.findMany({
    where: {
      status: { in: ['CANCELED', 'COMPLETED'] },
      // COMPLETED 只有 END_ACCESS 需要存取結束提醒（GRANT_LIFETIME 已轉永久）；
      // CANCELED 一律需要（已付期間結束前提醒）
      OR: [
        { status: 'CANCELED' },
        { status: 'COMPLETED', termEndBehavior: 'END_ACCESS' },
      ],
      accessEndNoticeSentAt: null,
      currentPeriodEnd: {
        not: null,
        gt: periodEndLowerBound,
        lte: periodEndUpperBound,
      },
    },
    select: {
      id: true,
      currentPeriodEnd: true,
      user: { select: { email: true, name: true } },
      course: { select: { title: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
    take: STEP_BATCH_LIMIT,
  })

  let claimed = 0
  let sent = 0

  for (const sub of candidates) {
    if (Date.now() >= deadline) break
    const periodEnd = sub.currentPeriodEnd
    if (!periodEnd) continue
    const accessEndsAt = new Date(periodEnd.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS)

    // 原子 claim：只有 accessEndNoticeSentAt 仍為 null 者能 claim 成功
    const claimResult = await prisma.courseSubscription.updateMany({
      where: { id: sub.id, accessEndNoticeSentAt: null },
      data: { accessEndNoticeSentAt: now },
    })
    if (claimResult.count !== 1) continue
    claimed++

    if (sub.user.email) {
      await sendSubscriptionAccessEnding({
        subscriptionId: sub.id,
        toEmail: sub.user.email,
        userName: sub.user.name,
        courseTitle: sub.course.title,
        accessEndsAt,
      })
      sent++
    }
  }

  return { claimed, sent }
}

// ============================================================
// 步驟 3：stale PENDING 清理
// ============================================================

async function reconcilePaidStripePendingCheckout(params: {
  subscriptionId: string
  sessionId: string
  expectedCustomerId: string | null
  expectedPriceId: string | null
  pricePerPeriod: number
  interval: 'MONTH' | 'YEAR'
  totalPeriods: number | null
  expectedEnvironment: string | null
}): Promise<boolean> {
  const gateway = await getGatewayByType('stripe')
  if (!(gateway instanceof StripeGateway)) throw new Error('Stripe gateway type mismatch')
  const currentEnvironment = gateway.isTestMode() ? 'stripe:test' : 'stripe:live'
  if (
    params.expectedEnvironment &&
    params.expectedEnvironment !== currentEnvironment
  ) {
    throw new Error('Stripe 帳號環境與訂閱快照不符')
  }
  const stripe = gateway.getStripeInstance()
  const session = await stripe.checkout.sessions.retrieve(params.sessionId)
  const stripeSubscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  if (
    session.payment_status !== 'paid' ||
    session.metadata?.subscriptionId !== params.subscriptionId ||
    !stripeSubscriptionId ||
    !params.expectedCustomerId ||
    customerId !== params.expectedCustomerId ||
    session.currency !== 'twd' ||
    session.amount_total == null
  ) {
    throw new Error('Stripe stale Checkout 的付款歸屬驗證失敗')
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
    { expand: ['latest_invoice'] }
  )
  if (
    stripeSubscription.metadata?.subscriptionId !== params.subscriptionId ||
    !(await validateAndBindStripeSubscriptionPrice({
      stripeSubscription,
      local: {
        id: params.subscriptionId,
        gatewayPriceId: params.expectedPriceId,
        pricePerPeriod: params.pricePerPeriod,
        interval: params.interval,
      },
    }))
  ) {
    throw new Error('Stripe stale Checkout 的 Subscription/Price 驗證失敗')
  }
  if (params.totalPeriods) {
    const starts = stripeSubscription.items.data
      .map((item) => item.current_period_start)
      .filter((value): value is number => typeof value === 'number' && value > 0)
    const start = starts.length > 0
      ? Math.min(...starts)
      : stripeSubscription.start_date
    const cancelAt = Math.floor(
      addBillingIntervals(
        new Date(start * 1000),
        params.interval,
        params.totalPeriods
      ).getTime() / 1000
    )
    if (stripeSubscription.cancel_at !== cancelAt) {
      await stripe.subscriptions.update(
        stripeSubscription.id,
        { cancel_at: cancelAt },
        {
          idempotencyKey: `subscription_cancel_at_${params.subscriptionId}_${cancelAt}`,
        }
      )
    }
  }
  const periodEndSeconds = Math.max(
    0,
    ...stripeSubscription.items.data.map((item) => item.current_period_end ?? 0)
  )
  const invoice =
    typeof stripeSubscription.latest_invoice === 'string'
      ? await stripe.invoices.retrieve(stripeSubscription.latest_invoice, {
          expand: ['payments'],
        })
      : stripeSubscription.latest_invoice
  if (!invoice?.id || periodEndSeconds <= 0) {
    throw new Error('Stripe stale Checkout 缺少 invoice 或期末')
  }
  const fullInvoice = invoice.payments
    ? invoice
    : await stripe.invoices.retrieve(invoice.id, { expand: ['payments'] })
  const legacyPaymentIntent = (
    fullInvoice as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null
    }
  ).payment_intent
  const invoicePayment =
    fullInvoice.payments?.data.find((item) => item.status === 'paid')?.payment ??
    fullInvoice.payments?.data[0]?.payment
  const paymentIntentId =
    typeof legacyPaymentIntent === 'string'
      ? legacyPaymentIntent
      : legacyPaymentIntent?.id ??
        (typeof invoicePayment?.payment_intent === 'string'
          ? invoicePayment.payment_intent
          : invoicePayment?.payment_intent?.id ?? null)

  const result = await processSubscriptionPeriodPaid({
    subscriptionId: params.subscriptionId,
    gatewayPeriodKey: invoice.id,
    periodNumber: 1,
    actualAmount: Math.round(session.amount_total / 100),
    periodEndAt: new Date(periodEndSeconds * 1000),
    gatewaySubscriptionId: stripeSubscriptionId,
    gatewayInvoiceId: invoice.id,
    gatewayPaymentId: paymentIntentId,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    gatewayMeta: {
      source: 'maintenance.checkout_reconciliation',
      sessionId: session.id,
      invoiceId: invoice.id,
      subscription: stripeSubscriptionId,
    },
    isFirstPeriod: true,
  })
  if (result.outcome === 'anomalous') {
    throw new Error('Stripe stale Checkout 已付款但本地訂閱拒絕入帳')
  }
  if (result.needsGatewayCancel) {
    await stripe.subscriptions.cancel(stripeSubscriptionId)
  }
  return true
}

function validatePayUniPendingQuery(params: {
  query: PayUniPeriodQueryResult
  merchantId: string
  merchantTradeNo: string
  periodTradeNo: string
  expectedTotalTimes: number
  interval: 'MONTH' | 'YEAR'
}): void {
  const {
    query,
    merchantId,
    merchantTradeNo,
    periodTradeNo,
    expectedTotalTimes,
    interval,
  } = params
  const expectedPeriodType = interval === 'YEAR' ? 'year' : 'month'
  if (
    query.merchantId !== merchantId ||
    query.merchantTradeNo !== merchantTradeNo ||
    query.periodTradeNo !== periodTradeNo ||
    query.totalTimes !== expectedTotalTimes ||
    query.periodType !== expectedPeriodType
  ) {
    throw new Error('PAYUNi 查詢回應與本地訂閱身分或方案快照不符')
  }
}

async function queryPayUniPending(params: {
  gateway: PayUniGateway
  merchantTradeNo: string
  periodTradeNo: string
  expectedTotalTimes: number
  interval: 'MONTH' | 'YEAR'
}): Promise<PayUniPeriodQueryResult> {
  const raw = await params.gateway.queryPeriod(params.periodTradeNo)
  const query = parsePayUniPeriodQuery(raw)
  validatePayUniPendingQuery({
    query,
    merchantId: params.gateway.getMerchantId(),
    merchantTradeNo: params.merchantTradeNo,
    periodTradeNo: params.periodTradeNo,
    expectedTotalTimes: params.expectedTotalTimes,
    interval: params.interval,
  })
  return query
}

async function reconcilePaidPayUniPendingCheckout(params: {
  subscriptionId: string
  gateway: PayUniGateway
  merchantTradeNo: string
  periodTradeNo: string
  expectedTotalTimes: number
  interval: 'MONTH' | 'YEAR'
  query: PayUniPeriodQueryResult
}): Promise<boolean> {
  const first = getPaidFirstPayUniPeriod(params.query, params.merchantTradeNo)
  if (!first) return false

  const second = params.query.items.find((item) => item.period === 2)
  const firstAuthorizedAt =
    parsePayUniQueryBillingDate(first.updatedAt) ??
    parsePayUniQueryBillingDate(first.expectedAuthorizationAt)
  const periodEndAt =
    (second
      ? parsePayUniQueryBillingDate(second.expectedAuthorizationAt)
      : null) ??
    (firstAuthorizedAt
      ? addBillingIntervals(firstAuthorizedAt, params.interval, 1)
      : null)
  if (!periodEndAt) {
    throw new Error('PAYUNi 查詢明細缺少可驗證的首期期末')
  }

  const paid = await processSubscriptionPeriodPaid({
    subscriptionId: params.subscriptionId,
    gatewayPeriodKey: first.subPeriodNo,
    periodNumber: 1,
    actualAmount: first.amount,
    periodEndAt,
    gatewaySubscriptionId: params.periodTradeNo,
    gatewayPaymentId: first.tradeNo,
    gatewayMeta: {
      source: 'maintenance.period_query_reconciliation',
      status: params.query.status,
      message: params.query.message,
      merTradeNo: params.query.merchantTradeNo,
      periodTradeNo: params.query.periodTradeNo,
      totalTimes: params.query.totalTimes,
      alreadyTimes: params.query.alreadyTimes,
      firstPeriod: { ...first },
    },
    isFirstPeriod: true,
  })
  if (paid.outcome === 'anomalous') {
    throw new Error('PAYUNi 首期查詢證實已付款，但本地訂閱拒絕入帳')
  }
  if (paid.needsGatewayCancel) {
    const ended = await params.gateway.cancelSubscription({
      subscription: (await prisma.courseSubscription.findUniqueOrThrow({
        where: { id: params.subscriptionId },
      })),
    })
    if (!ended.success) {
      await prisma.courseSubscription.update({
        where: { id: params.subscriptionId },
        data: { pendingGatewayCancelAt: new Date() },
      })
    }
  }
  return true
}

/**
 * 超過 SUBSCRIPTION_PENDING_STALE_HOURS 的 PENDING 只有在 provider 明確關閉後才轉 CANCELED。
 * Stripe 先查詢並 expire Checkout；PAYUNi 有 PeriodTradeNo 才能 mdfStatus end。
 * 無法確認外部付款頁已失效時保留 PENDING 並標記人工檢查，避免舊連結晚到扣款。
 */
async function cleanupStalePending(): Promise<number> {
  const cutoff = new Date(Date.now() - SUBSCRIPTION_PENDING_STALE_HOURS * 60 * 60 * 1000)
  const candidates = await prisma.courseSubscription.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    include: {
      user: { select: { stripeCustomerId: true, email: true } },
      course: { select: { title: true } },
      orders: {
        where: { periodNumber: 1 },
        take: 1,
        select: { stripeSessionId: true },
      },
    },
    take: 100,
  })
  let canceled = 0
  for (const sub of candidates) {
    let providerClosed = false
    let reconciledPaid = false
    let detail: string | undefined
    if (sub.gateway === 'stripe') {
      const sessionId = sub.orders[0]?.stripeSessionId
      if (!sessionId) {
        detail = '缺少 Stripe Checkout Session ID，無法安全清理'
      } else {
        const result = await closeStripePendingCheckout({ sessionId })
        providerClosed = result.safeToCancel
        if (result.paid) {
          try {
            await reconcilePaidStripePendingCheckout({
              subscriptionId: sub.id,
              sessionId,
              expectedCustomerId: sub.user.stripeCustomerId,
              expectedPriceId: sub.gatewayPriceId,
              pricePerPeriod: sub.pricePerPeriod,
              interval: sub.interval,
              totalPeriods:
                sub.planType === 'FIXED_TERM' ? sub.totalPeriods : null,
              expectedEnvironment: sub.gatewayEnvironment,
            })
            reconciledPaid = true
            detail = 'Stripe 已付款 Checkout 已由 maintenance 對帳開通'
          } catch (error) {
            detail = error instanceof Error ? error.message : 'Stripe 付款對帳失敗'
          }
        } else {
          detail = result.error
        }
      }
    } else if (
      sub.gateway === 'payuni' &&
      sub.gatewaySubscriptionId &&
      sub.gatewayTradeNo
    ) {
      try {
        const gateway = await getGatewayByType('payuni')
        if (!(gateway instanceof PayUniGateway)) {
          throw new Error('PAYUNi gateway type mismatch')
        }
        const currentEnvironment = gateway.isTestMode()
          ? 'payuni:sandbox'
          : 'payuni:production'
        if (
          sub.gatewayEnvironment &&
          sub.gatewayEnvironment !== currentEnvironment
        ) {
          throw new Error('PAYUNi 商店環境與訂閱快照不符')
        }
        const expectedTotalTimes =
          sub.planType === 'FIXED_TERM' && sub.totalPeriods != null
            ? sub.totalPeriods
            : 900
        const queryParams = {
          gateway,
          merchantTradeNo: sub.gatewayTradeNo,
          periodTradeNo: sub.gatewaySubscriptionId,
          expectedTotalTimes,
          interval: sub.interval,
        }
        const beforeEnd = await queryPayUniPending(queryParams)
        reconciledPaid = await reconcilePaidPayUniPendingCheckout({
          subscriptionId: sub.id,
          query: beforeEnd,
          ...queryParams,
        })
        if (reconciledPaid) {
          detail = 'PAYUNi 查詢證實首期已付款，已由 maintenance 對帳開通'
        } else {
          const ended = await gateway.cancelSubscription({ subscription: sub })
          if (!ended.success) {
            detail = ended.error ?? 'PAYUNi 終止失敗'
          } else {
            // 查詢與終止之間仍可能發生授權；終止後再查一次，只有明確維持未付款
            // 才能安全取消本地 PENDING。
            const afterEnd = await queryPayUniPending(queryParams)
            reconciledPaid = await reconcilePaidPayUniPendingCheckout({
              subscriptionId: sub.id,
              query: afterEnd,
              ...queryParams,
            })
            providerClosed =
              !reconciledPaid &&
              afterEnd.alreadyTimes === 0 &&
              !hasPayUniFirstPeriodPaymentEvidence(afterEnd)
            detail = reconciledPaid
              ? 'PAYUNi 終止前後發生首扣，已由 maintenance 對帳開通'
              : providerClosed
                ? undefined
                : 'PAYUNi 終止後的查詢結果無法證明首期未付款'
          }
        }
      } catch (error) {
        detail = error instanceof Error ? error.message : 'PAYUNi 查詢／終止失敗'
      }
    } else {
      // PAYUNi 在首期 Notify 前沒有可供 mdfStatus 終止的 PeriodTradeNo。
      // 不可只取消本地，否則舊付款頁晚到成功會造成真人扣款卻無授權。
      detail = 'PAYUNi 尚無 PeriodTradeNo，需人工確認付款頁是否失效'
    }

    if (reconciledPaid) continue

    if (providerClosed) {
      const updated = await prisma.courseSubscription.updateMany({
        where: { id: sub.id, status: 'PENDING' },
        data: {
          status: 'CANCELED',
          cancelRequestedAt: new Date(),
          cancelReason: 'checkout_abandoned',
          canceledAt: new Date(),
          pendingGatewayCancelAt: null,
        },
      })
      canceled += updated.count
    } else {
      const flagged = await prisma.courseSubscription.updateMany({
        where: {
          id: sub.id,
          status: 'PENDING',
          NOT: { attentionReason: 'STALE_CHECKOUT_REVIEW' },
        },
        data: { attentionReason: 'STALE_CHECKOUT_REVIEW' },
      })
      console.warn('[subscription-maintenance] stale checkout 未安全關閉:', sub.id, detail)
      if (flagged.count === 1) {
        await sendAdminSubscriptionAlert({
          reason: 'WEBHOOK_STALE',
          subscriptionId: sub.id,
          courseTitle: sub.course.title,
          userEmail: sub.user.email,
          detail: `逾時結帳無法安全關閉，已保留 PENDING，請人工對帳。${detail ? `原因：${detail}` : ''}`,
        })
      }
    }
  }
  return canceled
}

// ============================================================
// 步驟 4：pendingGatewayCancelAt 重試
// ============================================================

/**
 * 期滿 / 取消 / 退款時 gateway 取消失敗會寫 pendingGatewayCancelAt，此步為 retry owner。
 * 逐筆呼叫 gateway.cancelSubscription：
 *   - 成功 → 清 pendingGatewayCancelAt（並清 CANCEL_RETRY_EXHAUSTED 標記）
 *   - 失敗 → 記 attentionReason='CANCEL_RETRY_EXHAUSTED'，並在「首次標記」時寄一次管理員告警（去重）
 *
 * 說明：schema 未設「重試次數」欄位，改用一次性標記語意——每回合都會再嘗試取消（gateway 端冪等，
 * 已取消視為成功即自動收斂），但告警只在 attentionReason 由非 EXHAUSTED 轉為 EXHAUSTED 時寄一次，
 * 不重複轟炸管理員。為避免無限重試連打 gateway，只撿 pendingGatewayCancelAt 早於「1 小時冷卻窗」的訂閱
 * （每次失敗都把 pendingGatewayCancelAt 更新為 now，形成天然的每小時最多重試一次節流）。
 */
async function retryPendingGatewayCancels(
  deadline: number
): Promise<{ attempted: number; succeeded: number; exhausted: number }> {
  // 冷卻：pendingGatewayCancelAt 每次失敗都更新為 now，故只撿距今 > 1 小時者，避免同一 tick / 分鐘級重觸發連打 gateway
  const cooldownCutoff = new Date(Date.now() - 60 * 60 * 1000)

  const candidates = await prisma.courseSubscription.findMany({
    where: {
      pendingGatewayCancelAt: { not: null, lt: cooldownCutoff },
    },
    select: {
      id: true,
      gateway: true,
      attentionReason: true,
      user: { select: { email: true } },
      course: { select: { title: true } },
    },
    orderBy: { pendingGatewayCancelAt: 'asc' },
    take: 50, // gateway 呼叫較重，單次少量
  })

  let attempted = 0
  let succeeded = 0
  let exhausted = 0

  for (const sub of candidates) {
    if (Date.now() >= deadline) break
    attempted++

    // 取完整訂閱物件供 gateway.cancelSubscription
    const full = await prisma.courseSubscription.findUnique({ where: { id: sub.id } })
    if (!full) continue

    let cancelOk = false
    let cancelError: string | undefined
    try {
      const gateway = await getGatewayByType(sub.gateway as 'stripe' | 'payuni')
      if (gateway.cancelSubscription) {
        const res = await gateway.cancelSubscription({ subscription: full })
        cancelOk = res.success
        cancelError = res.error
      } else {
        // gateway 不支援取消 → 無可重試對象，清旗標
        cancelOk = true
      }
    } catch (err) {
      cancelError = err instanceof Error ? err.message : '未知錯誤'
    }

    if (cancelOk) {
      // 成功 → 清 pendingGatewayCancelAt 與 CANCEL_RETRY_EXHAUSTED 標記
      await prisma.courseSubscription.update({
        where: { id: sub.id },
        data: {
          status: full.cancelRequestedAt ? 'CANCELED' : full.status,
          canceledAt: full.cancelRequestedAt
            ? full.canceledAt ?? new Date()
            : full.canceledAt,
          pendingGatewayCancelAt: null,
          attentionReason:
            sub.attentionReason === 'CANCEL_RETRY_EXHAUSTED' ? null : sub.attentionReason,
        },
      })
      succeeded++
    } else {
      // 失敗 → 更新 pendingGatewayCancelAt 冷卻時間戳；累積達上限記標記 + 告警（去重）
      const alreadyFlagged = sub.attentionReason === 'CANCEL_RETRY_EXHAUSTED'
      await prisma.courseSubscription.update({
        where: { id: sub.id },
        data: {
          pendingGatewayCancelAt: new Date(),
          attentionReason: 'CANCEL_RETRY_EXHAUSTED',
        },
      })
      if (!alreadyFlagged) {
        exhausted++
        await sendAdminSubscriptionAlert({
          reason: 'CANCEL_RETRY_EXHAUSTED',
          subscriptionId: sub.id,
          courseTitle: sub.course.title,
          userEmail: sub.user.email,
          detail: `系統向 ${sub.gateway} 取消訂閱多次失敗（${cancelError ?? '未知錯誤'}），請至金流後台手動確認並取消，以免持續扣款`,
        })
      }
    }
  }

  return { attempted, succeeded, exhausted }
}

// ============================================================
// 步驟 5：異常偵測（webhook 失聯）
// ============================================================

/**
 * ACTIVE / PAST_DUE 且 currentPeriodEnd + 寬限 + 1 個週期已過（早該有下一期扣款卻沒有）
 * → attentionReason='WEBHOOK_STALE' + 管理員告警。
 *
 * 去重：只挑 attentionReason 為 null 者（已標記者不重寄）；以條件式 updateMany 原子 claim
 * 後才寄告警，並發下不重複告警。「+1 週期」依訂閱快照 interval（MONTH≈31 天、YEAR≈366 天）估算，
 * 取寬鬆上界避免誤報正常的月底扣款延遲。
 */
async function detectWebhookStale(deadline: number): Promise<number> {
  const now = Date.now()

  // 分別以 MONTH / YEAR 的「+1 週期」上界篩選，避免年繳被月繳門檻誤判
  const monthCutoff = new Date(
    now - SUBSCRIPTION_GRACE_DAYS * DAY_MS - 31 * DAY_MS
  )
  const yearCutoff = new Date(
    now - SUBSCRIPTION_GRACE_DAYS * DAY_MS - 366 * DAY_MS
  )

  const candidates = await prisma.courseSubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      attentionReason: null,
      currentPeriodEnd: { not: null },
      OR: [
        { interval: 'MONTH', currentPeriodEnd: { lt: monthCutoff } },
        { interval: 'YEAR', currentPeriodEnd: { lt: yearCutoff } },
      ],
    },
    select: {
      id: true,
      gateway: true,
      currentPeriodEnd: true,
      user: { select: { email: true } },
      course: { select: { title: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
    take: STEP_BATCH_LIMIT,
  })

  let detected = 0

  for (const sub of candidates) {
    if (Date.now() >= deadline) break

    // 原子 claim：只有 attentionReason 仍為 null 者能標記成功
    const claimResult = await prisma.courseSubscription.updateMany({
      where: { id: sub.id, attentionReason: null },
      data: { attentionReason: 'WEBHOOK_STALE' },
    })
    if (claimResult.count !== 1) continue
    detected++

    await sendAdminSubscriptionAlert({
      reason: 'WEBHOOK_STALE',
      subscriptionId: sub.id,
      courseTitle: sub.course.title,
      userEmail: sub.user.email,
      detail: `${sub.gateway} 訂閱超過一個扣款週期未收到續扣通知（上次期末 ${sub.currentPeriodEnd?.toISOString() ?? '未知'}），請至金流後台確認 Webhook 事件設定是否完整`,
    })
  }

  return detected
}

// ============================================================
// piggyback（掛在 newsletter-dispatch 每分鐘 cron 上）
// ============================================================

export type PiggybackOutcome =
  | { ran: true; result: RunMaintenanceResult }
  | { ran: false; reason: 'throttled' | 'error' }

/**
 * 供 /api/cron/newsletter-dispatch 掛載的維運 tick（AC-72）。
 *
 * - gating：以 SiteSetting 時間戳條件式 updateMany 原子 claim，距上次 piggyback 執行
 *   ≥ 20 小時才 claim 成功（並發 / 多實例下只有一個 dispatcher 能觸發），未滿則跳過。
 * - 硬性預算 ≤10 秒（SUBSCRIPTION_PIGGYBACK_BUDGET_MS），確保 newsletter dispatch 視窗充足。
 * - try/catch 完全隔離：訂閱維運任何錯誤都不得 reject 而中斷 newsletter 既有寄送。
 *
 * 注意：這是「舊客戶站沒有訂閱主 cron worker」時的兜底觸發路徑——onboarding / upgrade-platform
 * 會為新站補建專屬 worker，但既有站的 newsletter worker 早已存在，靠此 piggyback 讓訂閱維運可運作。
 */
export async function runSubscriptionMaintenancePiggyback(): Promise<PiggybackOutcome> {
  try {
    const claimed = await claimPiggybackSlot()
    if (!claimed) {
      return { ran: false, reason: 'throttled' }
    }
    const result = await runSubscriptionMaintenance({
      budgetMs: SUBSCRIPTION_PIGGYBACK_BUDGET_MS,
    })
    return { ran: true, result }
  } catch (err) {
    // 錯誤隔離：不影響 newsletter dispatch
    console.error('[subscription-maintenance] piggyback 失敗（已隔離）:', err)
    return { ran: false, reason: 'error' }
  }
}

/**
 * 原子 claim piggyback 執行權：距上次執行 ≥ 20 小時才回 true。
 *
 * 兩段式：
 *   1. 條件式 updateMany（value < cutoffIso）——只有值為「20 小時前」以前者能 claim，
 *      count=1 表示本次搶到執行權。
 *   2. row 不存在（首次執行）→ create；若併發下已被別的 dispatcher 建立（P2002）視為未搶到。
 *
 * 以 ISO 8601 字串做字典序比較等同時間先後（同長度、UTC Z 結尾），可靠。
 */
async function claimPiggybackSlot(): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const cutoffIso = new Date(
    Date.now() - SUBSCRIPTION_PIGGYBACK_INTERVAL_HOURS * 60 * 60 * 1000
  ).toISOString()

  // 1) 既有 row 且上次執行早於 cutoff → 原子 claim
  const updated = await prisma.siteSetting.updateMany({
    where: {
      key: SUBSCRIPTION_PIGGYBACK_LAST_RUN_KEY,
      value: { lt: cutoffIso },
    },
    data: { value: nowIso },
  })
  if (updated.count === 1) return true
  if (updated.count > 1) return true // 理論上 key unique 不會 >1，保守處理

  // 2) row 不存在（首次）→ 嘗試建立；併發下已建則失敗（未搶到）
  try {
    await prisma.siteSetting.create({
      data: { key: SUBSCRIPTION_PIGGYBACK_LAST_RUN_KEY, value: nowIso },
    })
    return true
  } catch (err) {
    if (isUniqueViolation(err)) {
      // 併發：另一 dispatcher 已建立 / 已 claim → 本次未搶到
      return false
    }
    throw err
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  )
}
