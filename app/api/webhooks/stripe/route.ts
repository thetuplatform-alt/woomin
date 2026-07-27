// app/api/webhooks/stripe/route.ts
// Stripe Webhook 處理
// 接收付款結果通知、驗證簽章、驗證金額、更新訂單狀態

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { StripeGateway } from '@/lib/payment/stripe-gateway'
import {
  executePostPaymentActions,
  grantPaidOrderAccess,
} from '@/lib/payment/post-payment-actions'
import { recordCouponRedemption } from '@/lib/payment/coupon-redemption'
import {
  processSubscriptionPeriodPaid,
  processSubscriptionPeriodFailed,
  processAnomalousPeriodPayment,
} from '@/lib/subscription/renewal'
import {
  cancelStripeSubscription,
  validateAndBindStripeSubscriptionPrice,
} from '@/lib/subscription/stripe-billing'
import { sendSubscriptionTerminated, sendAdminSubscriptionAlert } from '@/lib/subscription/notifications'
import { SUBSCRIPTION_GRACE_DAYS } from '@/lib/subscription/constants'
import type Stripe from 'stripe'
import type { PaymentMethod } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
} from '@/lib/payment/webhook-events'
import {
  finalizeOrderRefund,
  markOrderRefundFailed,
  markOrderDispute,
} from '@/lib/subscription/refund-reconciliation'
import { cancelSubscription as cancelLocalSubscription } from '@/lib/subscription/service'
import { addBillingIntervals } from '@/lib/subscription/calendar'
import {
  enqueueOrderInvoiceOutbox,
  processOrderInvoiceOutbox,
} from '@/lib/subscription/outbox'

/**
 * Stripe Webhook 處理
 * POST /api/webhooks/stripe
 *
 * 安全機制：
 * 1. 簽章驗證 - 確保資料來自 Stripe
 * 2. 冪等性處理 - 使用樂觀鎖防止重複處理
 */
export async function POST(request: NextRequest) {
  let claimedEventId: string | null = null
  try {
    // 取得 Stripe gateway 實例（即使當前 active gateway 不是 Stripe，仍需處理舊訂單的 webhook）
    let stripeGateway: StripeGateway
    try {
      const gw = await getGatewayByType('stripe')
      if (!(gw instanceof StripeGateway)) {
        throw new Error('Gateway type mismatch')
      }
      stripeGateway = gw
    } catch {
      console.error('[Stripe Webhook] 無法取得 Stripe 設定')
      return NextResponse.json(
        { success: false, message: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const stripeInstance = stripeGateway.getStripeInstance()
    const webhookSecret = stripeGateway.getWebhookSecret()
    const stripeEnvironment = stripeGateway.isTestMode()
      ? 'stripe:test'
      : 'stripe:live'

    // 1. 驗證簽章
    const body = await request.text()
    const sig = request.headers.get('stripe-signature')

    if (!sig) {
      console.error('[Stripe Webhook] 缺少 stripe-signature header')
      return NextResponse.json(
        { success: false, message: '缺少簽章' },
        { status: 400 }
      )
    }

    let event: Stripe.Event
    try {
      event = stripeInstance.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : '簽章驗證失敗'
      console.error('[Stripe Webhook] 簽章驗證失敗:', message)
      return NextResponse.json(
        { success: false, message },
        { status: 400 }
      )
    }

    console.log('[Stripe Webhook] 收到事件:', event.type)

    const claim = await claimWebhookEvent({
      gateway: 'stripe',
      eventId: event.id,
      eventType: event.type,
      payload: event as unknown as Prisma.InputJsonValue,
    })
    if (claim === 'DUPLICATE') {
      return NextResponse.json({ success: true, message: '事件已接收' })
    }
    if (claim === 'IN_PROGRESS') {
      // 另一個 worker 尚持有處理 lease。回非 2xx 讓 Stripe 稍後重送；若原 worker
      // 在外部副作用完成前崩潰，不能因這次提早回 200 而永久遺失事件。
      return NextResponse.json(
        { success: false, message: '事件處理中，請稍後重試' },
        { status: 503, headers: { 'Retry-After': '30' } }
      )
    }
    claimedEventId = event.id

    const handlePaidCheckoutSession = async (session: Stripe.Checkout.Session) => {
      const orderNo = session.metadata?.orderNo

      if (!orderNo) {
        console.error('[Stripe Webhook] metadata 中缺少 orderNo')
        return NextResponse.json(
          { success: false, message: '缺少訂單編號' },
          { status: 400 }
        )
      }

      if (session.payment_status !== 'paid') {
        console.log('[Stripe Webhook] Session 尚未付款，略過授權:', {
          orderNo,
          payment_status: session.payment_status,
        })
        return NextResponse.json({ success: true, message: '尚未付款' })
      }

      const order = await prisma.order.findFirst({
        where: { orderNo },
        select: {
          id: true,
          orderNo: true,
          userId: true,
          courseId: true,
          bundleId: true,
          amount: true,
          status: true,
          stripeSessionId: true,
          clientIpAddress: true,
              clientUserAgent: true,
              couponId: true,
              couponDiscount: true,
              newsletterCampaignId: true,
              subscriptionId: true,
            },
      })

      if (!order) {
        console.error('[Stripe Webhook] 訂單不存在:', orderNo)
        return NextResponse.json(
          { success: false, message: '訂單不存在' },
          { status: 404 }
        )
      }

      if (order.stripeSessionId && order.stripeSessionId !== session.id) {
        console.error('[Stripe Webhook] Session ID 不符:', {
          orderNo,
          expected: order.stripeSessionId,
          received: session.id,
        })
        return NextResponse.json(
          { success: false, message: 'Session ID 驗證失敗' },
          { status: 400 }
        )
      }

      if (order.status === 'PAID' && order.stripeSessionId === session.id) {
        console.log('[Stripe Webhook] 訂單已處理過:', order.orderNo)
        return NextResponse.json({ success: true, message: '訂單已處理' })
      }

      if (order.status !== 'PENDING') {
        console.log(
          '[Stripe Webhook] 訂單狀態已變更:',
          order.orderNo,
          order.status
        )
        return NextResponse.json({ success: true, message: '訂單狀態已變更' })
      }

      const paymentMethod = await resolveStripePaymentMethod(
        stripeInstance,
        session
      )

      const stripeAmountTotal =
        session.amount_total != null
          ? Math.round(session.amount_total / 100)
          : null

      const safeStripeResponse = {
        sessionId: session.id,
        paymentIntent: session.payment_intent,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_email,
        amountTotal: session.amount_total,
        ...(session.total_details?.amount_discount
          ? { amountDiscount: session.total_details.amount_discount }
          : {}),
      }

      try {
        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.order.updateMany({
            where: {
              id: order.id,
              status: 'PENDING',
            },
            data: {
              status: 'PAID',
              paymentMethod,
              ...(stripeAmountTotal != null
                ? { amount: stripeAmountTotal }
                : {}),
              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : null,
              stripeResponse: safeStripeResponse as object,
              paidAt: new Date(),
            },
          })

          if (updateResult.count === 0) {
            console.log('[Stripe Webhook] 訂單已被其他請求處理:', order.orderNo)
            throw new Error('ORDER_ALREADY_PROCESSED')
          }

          await grantPaidOrderAccess({
            tx,
            order: {
              id: order.id,
              userId: order.userId,
              courseId: order.courseId,
              bundleId: order.bundleId,
            },
            paidAt: new Date(),
          })

          // 建立優惠券兌換記錄（冪等 + 上限原子化）
          if (order.couponId && order.couponDiscount) {
            await recordCouponRedemption(tx, {
              couponId: order.couponId,
              userId: order.userId,
              orderId: order.id,
              amount: order.couponDiscount,
              campaignId: order.newsletterCampaignId,
            })
          }

          await enqueueOrderInvoiceOutbox(tx, {
            orderId: order.id,
            subscriptionId: order.subscriptionId,
            eventType: 'ISSUE_INVOICE',
          })
        })

        const actualAmount = stripeAmountTotal ?? order.amount

        console.log('[Stripe Webhook] 訂單處理完成:', orderNo, {
          originalOrderAmount: order.amount,
          stripeAmountTotal,
          actualAmount,
        })

        const invoiceResult = await processOrderInvoiceOutbox(order.id, 'ISSUE_INVOICE')
        if (!invoiceResult.success) {
          console.error('[Stripe Webhook] 發票已排入重試:', invoiceResult.error)
        }

        // 使用共用的 post-payment actions
        executePostPaymentActions({
          id: order.id,
          orderNo: order.orderNo,
          userId: order.userId,
          courseId: order.courseId,
          bundleId: order.bundleId,
          amount: actualAmount,
          clientIpAddress: order.clientIpAddress,
          clientUserAgent: order.clientUserAgent,
        }).catch((err) =>
          console.error('[Stripe Webhook] Post-payment actions 失敗:', err)
        )

        return NextResponse.json({ success: true, message: '訂單已授權' })
      } catch (txError) {
        if (
          txError instanceof Error &&
          txError.message === 'ORDER_ALREADY_PROCESSED'
        ) {
          return NextResponse.json({
            success: true,
            message: '訂單已被處理',
          })
        }
        throw txError
      }
    }

    // 2. 處理付款成功事件
    let response: NextResponse
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      // 訂閱模式：走專用路徑（絕不落入一次性 handlePaidCheckoutSession，否則
      // LIFETIME 課會被 computeExpiresAt 直接發永久權限）。AC-34
      if (session.mode === 'subscription') {
        response = await handleSubscriptionCheckoutCompleted(
          stripeInstance,
          session,
          stripeEnvironment
        )
      } else {
        response = await handlePaidCheckoutSession(session)
      }
    } else if (event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription') {
        response = await handleSubscriptionCheckoutCompleted(
          stripeInstance,
          session,
          stripeEnvironment
        )
      } else {
        response = await handlePaidCheckoutSession(session)
      }
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice
      response = await handleSubscriptionInvoicePaid(
        stripeInstance,
        invoice,
        stripeEnvironment
      )
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      response = await handleSubscriptionInvoicePaymentFailed(
        stripeInstance,
        invoice,
        stripeEnvironment
      )
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      response = await handleStripeSubscriptionDeleted(
        subscription,
        stripeEnvironment
      )
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.paused' ||
      event.type === 'customer.subscription.resumed'
    ) {
      response = await handleStripeSubscriptionUpdated(
        stripeInstance,
        event.data.object as Stripe.Subscription,
        stripeEnvironment
      )
    } else if (
      event.type === 'invoice.payment_action_required' ||
      event.type === 'invoice.finalization_failed'
    ) {
      response = await handleStripeInvoiceRequiresAttention(
        stripeInstance,
        event.data.object as Stripe.Invoice,
        event.type,
        stripeEnvironment
      )
    } else if (event.type === 'charge.refunded') {
      response = await handleStripeChargeRefunded(
        event.data.object as Stripe.Charge
      )
    } else if (
      event.type === 'charge.dispute.created' ||
      event.type === 'charge.dispute.closed'
    ) {
      response = await handleStripeDispute(
        event.data.object as Stripe.Dispute,
        event.type
      )
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session
      const orderNo = session.metadata?.orderNo

      if (session.mode === 'subscription' && session.metadata?.subscriptionId) {
        await processSubscriptionPeriodFailed({
          subscriptionId: session.metadata.subscriptionId,
          gatewayPeriodKey: `checkout_${session.id}`,
          actualAmount:
            session.amount_total == null ? null : Math.round(session.amount_total / 100),
          isFirstPeriod: true,
          gatewayPaymentId: stripeObjectId(session.payment_intent),
          gatewayMeta: {
            source: 'checkout.session.async_payment_failed',
            sessionId: session.id,
          },
        })
      } else if (orderNo) {
        try {
          await prisma.order.updateMany({
            where: {
              orderNo,
              status: 'PENDING',
            },
            data: {
              status: 'FAILED',
              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : null,
            },
          })
          console.log('[Stripe Webhook] 訂單標記為付款失敗:', orderNo)
        } catch (error) {
          console.error('[Stripe Webhook] 更新失敗訂單狀態錯誤:', orderNo, error)
        }
      } else {
        console.warn('[Stripe Webhook] async_payment_failed 缺少 orderNo:', session.id)
      }
      response = NextResponse.json({ success: true, message: '付款失敗已記錄' })
    } else {
      response = NextResponse.json({ success: true, message: '事件不需處理' })
    }

    if (response.status >= 400) {
      await failWebhookEvent(
        'stripe',
        event.id,
        new Error(`Stripe handler returned HTTP ${response.status}`)
      )
    } else {
      await completeWebhookEvent('stripe', event.id)
    }
    return response
  } catch (error) {
    console.error('[Stripe Webhook] 處理錯誤:', error)

    if (claimedEventId) {
      await failWebhookEvent('stripe', claimedEventId, error).catch(() => {})
    }

    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

/**
 * 從 Stripe PaymentIntent 取得用戶實際使用的付款方式
 * session.payment_method_types 只是「允許」的方式，不代表實際使用的
 */
async function resolveStripePaymentMethod(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<PaymentMethod> {
  try {
    const piId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id

    if (!piId) return 'CREDIT_CARD'

    const paymentIntent = await stripe.paymentIntents.retrieve(piId, {
      expand: ['payment_method'],
    })

    const pm = paymentIntent.payment_method
    if (!pm || typeof pm === 'string') return 'CREDIT_CARD'

    // pm.type = 'card' 時，card.wallet 可區分 Apple Pay / Google Pay
    if (pm.type === 'card' && pm.card?.wallet) {
      const walletType = pm.card.wallet.type
      if (walletType === 'apple_pay') return 'APPLE_PAY'
      if (walletType === 'google_pay') return 'GOOGLE_PAY'
    }

    return 'CREDIT_CARD'
  } catch (err) {
    console.error('[Stripe Webhook] 取得付款方式失敗，預設為信用卡:', err)
    return 'CREDIT_CARD'
  }
}

// ============================================================
// 訂閱 webhook 處理（AC-34~38）
// ============================================================

/** 從 Stripe Subscription 取本期期末（item current_period_end，clover API 在 item 層） */
function periodEndFromStripeSubscription(
  sub: Stripe.Subscription
): Date | null {
  const end = Math.max(
    0,
    ...sub.items.data.map((item) => item.current_period_end ?? 0)
  )
  return end > 0 ? new Date(end * 1000) : null
}

function periodEndFromInvoice(invoice: Stripe.Invoice): Date | null {
  const end = Math.max(
    0,
    ...invoice.lines.data.map((line) => line.period?.end ?? 0)
  )
  return end > 0 ? new Date(end * 1000) : null
}

function stripeObjectId(value: { id: string } | string | null | undefined): string | null {
  return typeof value === 'string' ? value : value?.id ?? null
}

type InvoiceWithLegacyFields = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null
  payment_intent?: string | Stripe.PaymentIntent | null
  charge?: string | Stripe.Charge | null
}

/** Stripe API 新舊版本都能取到 invoice 實際付款的 PaymentIntent。 */
async function resolveInvoicePaymentIntent(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<{ invoice: Stripe.Invoice; paymentIntentId: string | null }> {
  let full = invoice
  if (invoice.id) {
    try {
      full = await stripe.invoices.retrieve(invoice.id, { expand: ['payments'] })
    } catch (error) {
      console.warn('[Stripe Webhook] retrieve invoice payments 失敗:', invoice.id, error)
    }
  }

  const legacy = full as InvoiceWithLegacyFields
  let paymentIntentId = stripeObjectId(legacy.payment_intent)
  if (!paymentIntentId) {
    const payment = full.payments?.data.find((item) => item.status === 'paid')?.payment
      ?? full.payments?.data[0]?.payment
    paymentIntentId = stripeObjectId(payment?.payment_intent)
  }
  if (!paymentIntentId && legacy.charge) {
    try {
      const charge =
        typeof legacy.charge === 'string'
          ? await stripe.charges.retrieve(legacy.charge)
          : legacy.charge
      paymentIntentId = stripeObjectId(charge.payment_intent)
    } catch (error) {
      console.warn('[Stripe Webhook] retrieve invoice charge 失敗:', invoice.id, error)
    }
  }
  return { invoice: full, paymentIntentId }
}

function subscriptionCustomerId(subscription: Stripe.Subscription): string | null {
  return stripeObjectId(subscription.customer)
}

async function ensureFixedTermStripeCancelAt(params: {
  stripe: Stripe
  stripeSubscription: Stripe.Subscription
  local: { id: string; planType: string; totalPeriods: number | null; interval: 'MONTH' | 'YEAR' }
}): Promise<void> {
  if (params.local.planType !== 'FIXED_TERM' || !params.local.totalPeriods) return
  const starts = params.stripeSubscription.items.data
    .map((item) => item.current_period_start)
    .filter((value): value is number => typeof value === 'number' && value > 0)
  const startSeconds = starts.length > 0
    ? Math.min(...starts)
    : params.stripeSubscription.start_date
  const boundary = addBillingIntervals(
    new Date(startSeconds * 1000),
    params.local.interval,
    params.local.totalPeriods
  )
  const cancelAt = Math.floor(boundary.getTime() / 1000)
  if (params.stripeSubscription.cancel_at === cancelAt) return
  await params.stripe.subscriptions.update(
    params.stripeSubscription.id,
    { cancel_at: cancelAt },
    { idempotencyKey: `subscription_cancel_at_${params.local.id}_${cancelAt}` }
  )
}

/**
 * checkout.session.completed（mode=subscription）（AC-34）。
 * 記 gatewaySubscriptionId、將第 1 期 PENDING Order 轉 PAID、訂閱 ACTIVE、
 * Purchase 展期，走 renewal.processSubscriptionPeriodPaid 的 isFirstPeriod 路徑。
 * 絕不落入既有一次性 handlePaidCheckoutSession。
 */
async function handleSubscriptionCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  stripeEnvironment: 'stripe:test' | 'stripe:live'
): Promise<NextResponse> {
  const subscriptionId = session.metadata?.subscriptionId
  if (!subscriptionId) {
    console.error('[Stripe Webhook] 訂閱 checkout 缺少 subscriptionId metadata')
    // 缺 metadata 無法對回本地訂閱 → 回非 2xx 讓 Stripe 重試
    return NextResponse.json(
      { success: false, message: '缺少 subscriptionId' },
      { status: 400 }
    )
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ success: true, message: '尚未付款' })
  }
  if (session.currency !== 'twd' || session.amount_total == null) {
    return NextResponse.json(
      { success: false, message: '付款幣別或金額不合法' },
      { status: 400 }
    )
  }

  const gatewaySubscriptionId = stripeObjectId(session.subscription)
  if (!gatewaySubscriptionId) {
    return NextResponse.json(
      { success: false, message: '缺少 Stripe subscription' },
      { status: 500 }
    )
  }

  const local = await prisma.courseSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: { select: { stripeCustomerId: true } },
      orders: {
        where: { periodNumber: 1 },
        take: 1,
        select: { stripeSessionId: true },
      },
    },
  })
  if (
    !local ||
    local.gateway !== 'stripe' ||
    (local.gatewayEnvironment &&
      local.gatewayEnvironment !== stripeEnvironment)
  ) {
    return NextResponse.json(
      { success: false, message: '本地 Stripe 訂閱不存在' },
      { status: 404 }
    )
  }

  // provider 建立完成但本地 session id 尚未提交時，要求 Stripe 重送；不能接受任意 session。
  const expectedSessionId = local.orders[0]?.stripeSessionId
  if (!expectedSessionId) {
    return NextResponse.json(
      { success: false, message: '本地 Checkout 尚未提交，請重試' },
      { status: 500 }
    )
  }
  if (expectedSessionId !== session.id) {
    console.error('[Stripe Webhook] 訂閱 Checkout Session 不符，已嘗試取消:', {
      subscriptionId,
      expectedSessionId,
      receivedSessionId: session.id,
    })
    try {
      await cancelAndRefundUnexpectedStripeSubscription({
        stripe,
        subscriptionId,
        gatewaySubscriptionId,
        actualAmount: Math.round(session.amount_total / 100),
      })
      return NextResponse.json({ success: true, message: '重複訂閱已取消並退款' })
    } catch (error) {
      console.error('[Stripe Webhook] 重複訂閱退款失敗:', error)
      return NextResponse.json(
        { success: false, message: '重複訂閱退款失敗' },
        { status: 500 }
      )
    }
  }

  const sessionCustomerId = stripeObjectId(session.customer)
  if (
    !local.user.stripeCustomerId ||
    !sessionCustomerId ||
    sessionCustomerId !== local.user.stripeCustomerId
  ) {
    await cancelAndRefundUnexpectedStripeSubscription({
      stripe,
      subscriptionId,
      gatewaySubscriptionId,
      actualAmount: Math.round(session.amount_total / 100),
    })
    return NextResponse.json({ success: true, message: '錯誤歸屬付款已退款' })
  }
  if (
    local.gatewaySubscriptionId &&
    local.gatewaySubscriptionId !== gatewaySubscriptionId
  ) {
    await cancelAndRefundUnexpectedStripeSubscription({
      stripe,
      subscriptionId,
      gatewaySubscriptionId,
      actualAmount: Math.round(session.amount_total / 100),
    })
    return NextResponse.json({ success: true, message: '重複 Stripe 訂閱已退款' })
  }

  try {
    const stripeSub = await stripe.subscriptions.retrieve(gatewaySubscriptionId, {
      expand: ['latest_invoice'],
    })
    if (
      stripeSub.metadata?.subscriptionId !== subscriptionId ||
      subscriptionCustomerId(stripeSub) !== local.user.stripeCustomerId
    ) {
      await cancelAndRefundUnexpectedStripeSubscription({
        stripe,
        subscriptionId,
        gatewaySubscriptionId,
        actualAmount: Math.round(session.amount_total / 100),
      })
      return NextResponse.json({ success: true, message: '錯誤歸屬付款已退款' })
    }
    if (
      !(await validateAndBindStripeSubscriptionPrice({
        stripeSubscription: stripeSub,
        local,
      }))
    ) {
      await cancelAndRefundUnexpectedStripeSubscription({
        stripe,
        subscriptionId,
        gatewaySubscriptionId,
        actualAmount: Math.round(session.amount_total / 100),
      })
      return NextResponse.json({ success: true, message: '錯誤方案付款已退款' })
    }
    await ensureFixedTermStripeCancelAt({
      stripe,
      stripeSubscription: stripeSub,
      local,
    })

    const periodEndAt = periodEndFromStripeSubscription(stripeSub)
    if (!periodEndAt) throw new Error('無法取得訂閱期末')

    const latestInvoice =
      typeof stripeSub.latest_invoice === 'string'
        ? await stripe.invoices.retrieve(stripeSub.latest_invoice)
        : stripeSub.latest_invoice
    const payment = latestInvoice
      ? await resolveInvoicePaymentIntent(stripe, latestInvoice)
      : { invoice: null, paymentIntentId: null }
    const invoiceId = payment.invoice?.id ?? null

    const result = await processSubscriptionPeriodPaid({
      subscriptionId,
      gatewayPeriodKey: invoiceId ?? `checkout_${session.id}`,
      periodNumber: 1,
      actualAmount: Math.round(session.amount_total / 100),
      periodEndAt,
      gatewaySubscriptionId,
      gatewayInvoiceId: invoiceId,
      gatewayPaymentId: payment.paymentIntentId,
      hostedInvoiceUrl: payment.invoice?.hosted_invoice_url ?? null,
      gatewayMeta: {
        source: 'checkout.session.completed',
        sessionId: session.id,
        subscription: gatewaySubscriptionId,
        invoiceId,
        amountTotal: session.amount_total,
      },
      isFirstPeriod: true,
    })

    if (result.outcome === 'anomalous') {
      const canceled = await cancelStripeSubscription({ gatewaySubscriptionId })
      if (!canceled.success) throw new Error(canceled.error ?? '異常訂閱取消失敗')
      if (!payment.invoice) throw new Error('異常首期無 invoice，無法退款')
      await handleAnomalousStripePeriod(
        stripe,
        subscriptionId,
        payment.invoice,
        Math.round(session.amount_total / 100)
      )
    } else if (result.outcome === 'duplicate' && payment.invoice) {
      await resumeAnomalousStripeRefundIfNeeded({
        stripe,
        subscriptionId,
        invoice: payment.invoice,
        actualAmount: Math.round(session.amount_total / 100),
      })
    } else if (result.needsGatewayCancel) {
      await handleNeedsGatewayCancel(subscriptionId, gatewaySubscriptionId)
    }

    return NextResponse.json({ success: true, message: '訂閱首期已開通' })
  } catch (err) {
    console.error('[Stripe Webhook] 訂閱首期開通失敗:', subscriptionId, err)
    return NextResponse.json(
      { success: false, message: '訂閱開通失敗' },
      { status: 500 }
    )
  }
}

/**
 * 從 invoice 解析本地訂閱 id（AC-35）。
 * 依 stripe SDK v20 / clover API：invoice 的訂閱資訊在 parent.subscription_details，
 * 先讀該層 metadata.subscriptionId；缺失時 retrieve subscription 讀 metadata。
 * 回傳 { subscriptionId, gatewaySubscriptionId }，解析不到 subscriptionId 回 null。
 */
async function resolveSubscriptionFromInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<{
  subscriptionId: string | null
  gatewaySubscriptionId: string | null
  stripeSub: Stripe.Subscription | null
  isSubscriptionInvoice: boolean
}> {
  const details = invoice.parent?.subscription_details ?? null
  const legacySubscription = (invoice as InvoiceWithLegacyFields).subscription
  const gatewaySubscriptionId = details
    ? stripeObjectId(details.subscription)
    : stripeObjectId(legacySubscription)

  // 優先讀 invoice 快照的 subscription metadata
  let subscriptionId =
    details?.metadata?.subscriptionId ?? invoice.metadata?.subscriptionId ?? null
  let stripeSub: Stripe.Subscription | null = null

  if (gatewaySubscriptionId) {
    try {
      stripeSub = await stripe.subscriptions.retrieve(gatewaySubscriptionId)
      subscriptionId = subscriptionId ?? stripeSub.metadata?.subscriptionId ?? null
    } catch (err) {
      console.error(
        '[Stripe Webhook] retrieve subscription 失敗（invoice 解析）:',
        err
      )
    }
  }

  return {
    subscriptionId,
    gatewaySubscriptionId,
    stripeSub,
    isSubscriptionInvoice: !!gatewaySubscriptionId,
  }
}

/**
 * invoice.paid（AC-35~37）。
 * billing_reason=subscription_create → isFirstPeriod（更新預建第 1 期 Order）；
 * 續期走「原子 create、unique 衝突=已處理」。currentPeriodEnd 取 line item period.end，
 * amount=invoice.amount_paid/100。解析不到本地訂閱回非 2xx 讓 Stripe 重試。
 */
async function handleSubscriptionInvoicePaid(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  stripeEnvironment: 'stripe:test' | 'stripe:live'
): Promise<NextResponse> {
  if (!invoice.id) {
    return NextResponse.json({ success: true, message: '缺少 invoice id' })
  }

  const { subscriptionId, gatewaySubscriptionId, stripeSub, isSubscriptionInvoice } =
    await resolveSubscriptionFromInvoice(stripe, invoice)

  if (!isSubscriptionInvoice) {
    return NextResponse.json({ success: true, message: '非訂閱發票，略過' })
  }
  if (!subscriptionId) {
    console.error(
      '[Stripe Webhook] invoice.paid 無法解析本地訂閱:',
      invoice.id
    )
    // 同帳號可能有非本站建立的 Stripe Billing 訂閱；不能讓事件永久重試。
    return NextResponse.json({ success: true, message: '非本站訂閱，略過' })
  }

  const periodEndAt = periodEndFromInvoice(invoice)
  if (!periodEndAt) {
    console.error('[Stripe Webhook] invoice.paid 無 line period.end:', invoice.id)
    return NextResponse.json(
      { success: false, message: '無法取得期末' },
      { status: 500 }
    )
  }

  if (invoice.currency !== 'twd' || invoice.amount_paid < 0) {
    return NextResponse.json(
      { success: false, message: '發票幣別或金額不合法' },
      { status: 400 }
    )
  }
  const actualAmount = Math.round(invoice.amount_paid / 100)

  const local = await prisma.courseSubscription.findUnique({
    where: { id: subscriptionId },
    include: { user: { select: { stripeCustomerId: true } } },
  })
  if (
    !local ||
    local.gateway !== 'stripe' ||
    (local.gatewayEnvironment &&
      local.gatewayEnvironment !== stripeEnvironment)
  ) {
    return NextResponse.json({ success: true, message: '非本站 Stripe 訂閱' })
  }
  if (!stripeSub) {
    return NextResponse.json(
      { success: false, message: '無法驗證 Stripe Subscription' },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }
  const isFirstPeriod =
    invoice.billing_reason === 'subscription_create' ||
    (local.status === 'PENDING' && local.paidPeriods === 0)
  const invoiceCustomerId = stripeObjectId(invoice.customer)
  if (!gatewaySubscriptionId || !local.user.stripeCustomerId) {
    return NextResponse.json(
      { success: false, message: 'Stripe 發票綁定尚未完整' },
      { status: 500 }
    )
  }
  if (
    (local.gatewaySubscriptionId &&
      local.gatewaySubscriptionId !== gatewaySubscriptionId) ||
    invoiceCustomerId !== local.user.stripeCustomerId ||
    subscriptionCustomerId(stripeSub) !== local.user.stripeCustomerId ||
    stripeSub.metadata?.subscriptionId !== subscriptionId
  ) {
    await cancelAndRefundUnexpectedStripeSubscription({
      stripe,
      subscriptionId,
      gatewaySubscriptionId,
      actualAmount,
    })
    return NextResponse.json({ success: true, message: '錯誤歸屬期款已退款' })
  }
  if (
    !(await validateAndBindStripeSubscriptionPrice({
      stripeSubscription: stripeSub,
      local,
    }))
  ) {
    await cancelAndRefundUnexpectedStripeSubscription({
      stripe,
      subscriptionId,
      gatewaySubscriptionId,
      actualAmount,
    })
    return NextResponse.json({ success: true, message: '錯誤方案期款已退款' })
  }
  await ensureFixedTermStripeCancelAt({
    stripe,
    stripeSubscription: stripeSub,
    local,
  })

  const payment = await resolveInvoicePaymentIntent(stripe, invoice)

  try {
    const result = await processSubscriptionPeriodPaid({
      subscriptionId,
      gatewayPeriodKey: invoice.id,
      // Stripe 續期不給 periodNumber（由交易內推導）；首期以預建第 1 期 Order
      periodNumber: null,
      actualAmount,
      periodEndAt,
      gatewaySubscriptionId,
      gatewayInvoiceId: invoice.id,
      gatewayPaymentId: payment.paymentIntentId,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      gatewayMeta: {
        source: 'invoice.paid',
        invoiceId: invoice.id,
        billingReason: invoice.billing_reason,
        amountPaid: invoice.amount_paid,
        customer: invoiceCustomerId,
        subscription: gatewaySubscriptionId,
        paymentIntentId: payment.paymentIntentId,
      },
      isFirstPeriod,
    })

    // 終態後晚到扣款（訂閱 CANCELED/COMPLETED/作廢）→ 異常期款（不展期、自動退款、告警）
    if (result.outcome === 'anomalous') {
      if (gatewaySubscriptionId) {
        const canceled = await cancelStripeSubscription({ gatewaySubscriptionId })
        if (!canceled.success) throw new Error(canceled.error ?? '異常訂閱取消失敗')
      }
      await handleAnomalousStripePeriod(stripe, subscriptionId, invoice, actualAmount)
      return NextResponse.json({ success: true, message: '異常期款已處理' })
    }
    if (result.outcome === 'duplicate') {
      await resumeAnomalousStripeRefundIfNeeded({
        stripe,
        subscriptionId,
        invoice,
        actualAmount,
      })
    }

    // 期滿轉永久後需交易外 gateway cancel（AC-39）
    if (result.needsGatewayCancel && gatewaySubscriptionId) {
      await handleNeedsGatewayCancel(subscriptionId, gatewaySubscriptionId)
    }

    return NextResponse.json({ success: true, message: '期款已入帳' })
  } catch (err) {
    console.error('[Stripe Webhook] invoice.paid 處理失敗:', invoice.id, err)
    return NextResponse.json(
      { success: false, message: '期款處理失敗' },
      { status: 500 }
    )
  }
}

/**
 * 終態後晚到扣款的 Stripe 自動退款（PRD §4.4）。
 * renewal.processAnomalousPeriodPayment 建異常 Order + 告警；
 * 此處以 invoice 反查 payment_intent，呼叫 gateway processRefund 全額退款。
 */
async function handleAnomalousStripePeriod(
  stripe: Stripe,
  subscriptionId: string,
  invoice: Stripe.Invoice,
  actualAmount: number
): Promise<void> {
  if (!invoice.id) throw new Error('異常期款缺少 invoice id')
  const resolvedPayment = await resolveInvoicePaymentIntent(stripe, invoice)
  const anomalous = await processAnomalousPeriodPayment({
    subscriptionId,
    gatewayPeriodKey: invoice.id,
    actualAmount,
    gatewayInvoiceId: invoice.id,
    gatewayPaymentId: resolvedPayment.paymentIntentId,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    gatewayMeta: {
      source: 'invoice.paid',
      invoiceId: invoice.id,
      billingReason: invoice.billing_reason,
    },
  })

  if (!anomalous.orderId) return

  try {
    if (actualAmount === 0) {
      await finalizeOrderRefund({
        orderId: anomalous.orderId,
        reason: '異常零元訂閱期款結案',
        terminateSubscription: false,
      })
      return
    }
    if (!resolvedPayment.paymentIntentId) {
      throw new Error('異常期款無法取得 payment_intent')
    }
    const gw = await getGatewayByType('stripe')
    const refund = await gw.processRefund({
      gatewayPaymentId: resolvedPayment.paymentIntentId,
      orderNo: `anomalous_${invoice.id}`,
    })
    if (!refund.success) throw new Error(refund.error ?? 'Stripe 退款失敗')
    if (refund.pending) {
      await prisma.order.update({
        where: { id: anomalous.orderId },
        data: { gatewayRefundId: refund.gatewayRefundId ?? null },
      })
      return
    }

    await finalizeOrderRefund({
      orderId: anomalous.orderId,
      reason: '異常訂閱期款自動退款',
      gatewayRefundId: refund.gatewayRefundId,
      terminateSubscription: false,
    })
    const invoiceSync = await processOrderInvoiceOutbox(
      anomalous.orderId,
      'SYNC_INVOICE_REFUND'
    )
    if (!invoiceSync.success) {
      console.error('[Stripe Webhook] 異常期款發票沖銷已排入重試:', invoiceSync.error)
    }
  } catch (err) {
    console.error('[Stripe Webhook] 異常期款退款流程失敗:', invoice.id, err)
    await markOrderRefundFailed(
      anomalous.orderId,
      err instanceof Error ? err.message : '未知退款錯誤'
    )
    throw err
  }
}

async function resumeAnomalousStripeRefundIfNeeded(params: {
  stripe: Stripe
  subscriptionId: string
  invoice: Stripe.Invoice
  actualAmount: number
}): Promise<void> {
  if (!params.invoice.id) return
  const existing = await prisma.order.findUnique({
    where: { gatewayPeriodKey: params.invoice.id },
    select: { refundReason: true, refundStatus: true },
  })
  if (
    existing?.refundReason !== 'ANOMALOUS_SUBSCRIPTION_PERIOD' ||
    existing.refundStatus === 'COMPLETED'
  ) {
    return
  }
  await prisma.order.updateMany({
    where: {
      gatewayPeriodKey: params.invoice.id,
      refundReason: 'ANOMALOUS_SUBSCRIPTION_PERIOD',
      refundStatus: 'FAILED',
    },
    data: { refundStatus: 'PROCESSING', refundError: null },
  })
  await handleAnomalousStripePeriod(
    params.stripe,
    params.subscriptionId,
    params.invoice,
    params.actualAmount
  )
}

async function cancelAndRefundUnexpectedStripeSubscription(params: {
  stripe: Stripe
  subscriptionId: string
  gatewaySubscriptionId: string
  actualAmount: number
}): Promise<void> {
  const canceled = await cancelStripeSubscription({
    gatewaySubscriptionId: params.gatewaySubscriptionId,
  })
  if (!canceled.success) {
    throw new Error(canceled.error ?? '無法取消重複 Stripe 訂閱')
  }
  const stripeSub = await params.stripe.subscriptions.retrieve(
    params.gatewaySubscriptionId,
    { expand: ['latest_invoice'] }
  )
  const invoice =
    typeof stripeSub.latest_invoice === 'string'
      ? await params.stripe.invoices.retrieve(stripeSub.latest_invoice)
      : stripeSub.latest_invoice
  if (!invoice) throw new Error('重複 Stripe 訂閱沒有首期 invoice')
  await handleAnomalousStripePeriod(
    params.stripe,
    params.subscriptionId,
    invoice,
    params.actualAmount
  )

  const local = await prisma.courseSubscription.findUnique({
    where: { id: params.subscriptionId },
    select: { gatewaySubscriptionId: true },
  })
  if (
    local &&
    (!local.gatewaySubscriptionId ||
      local.gatewaySubscriptionId === params.gatewaySubscriptionId)
  ) {
    // 錯誤資源就是本站原本等待的 provider subscription：退款後必須終止本地
    // 狀態，不能留下看似 ACTIVE/PENDING、實際已無後續扣款的幽靈訂閱。
    await prisma.courseSubscription.updateMany({
      where: {
        id: params.subscriptionId,
        status: { in: ['PENDING', 'ACTIVE', 'PAST_DUE'] },
      },
      data: {
        status: 'CANCELED',
        cancelRequestedAt: new Date(),
        canceledAt: new Date(),
        cancelReason: 'stripe_binding_mismatch',
        pendingGatewayCancelAt: null,
        attentionReason: 'ANOMALOUS_PERIOD_PAYMENT',
      },
    })
  }
}

/**
 * 期滿轉永久後的交易外 gateway cancel（AC-39）。
 * cancel 失敗 → 寫 pendingGatewayCancelAt，由 maintenance tick 重試。
 */
async function handleNeedsGatewayCancel(
  subscriptionId: string,
  gatewaySubscriptionId: string
): Promise<void> {
  const cancelResult = await cancelStripeSubscription({ gatewaySubscriptionId })
  if (!cancelResult.success) {
    console.error(
      '[Stripe Webhook] 期滿 gateway cancel 失敗，寫 pendingGatewayCancelAt:',
      subscriptionId,
      cancelResult.error
    )
    await prisma.courseSubscription
      .update({
        where: { id: subscriptionId },
        data: { pendingGatewayCancelAt: new Date() },
      })
      .catch((err) =>
        console.error('[Stripe Webhook] 寫 pendingGatewayCancelAt 失敗:', err)
      )
  }
}

/**
 * invoice.payment_failed（AC-38）。
 * → renewal.processSubscriptionPeriodFailed（僅 ACTIVE→PAST_DUE 首次轉態寄信/PostHog）。
 */
async function handleSubscriptionInvoicePaymentFailed(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  stripeEnvironment: 'stripe:test' | 'stripe:live'
): Promise<NextResponse> {
  if (!invoice.id) return NextResponse.json({ success: true, message: '缺 invoice id' })
  const { subscriptionId, isSubscriptionInvoice } =
    await resolveSubscriptionFromInvoice(stripe, invoice)

  if (!isSubscriptionInvoice) {
    return NextResponse.json({ success: true, message: '非訂閱發票，略過' })
  }
  if (!subscriptionId) {
    console.error(
      '[Stripe Webhook] invoice.payment_failed 無法解析本地訂閱:',
      invoice.id
    )
    return NextResponse.json({ success: true, message: '非本站訂閱，略過' })
  }

  const local = await prisma.courseSubscription.findUnique({
    where: { id: subscriptionId },
    select: { gateway: true, gatewayEnvironment: true },
  })
  if (
    !local ||
    local.gateway !== 'stripe' ||
    (local.gatewayEnvironment &&
      local.gatewayEnvironment !== stripeEnvironment)
  ) {
    return NextResponse.json({ success: true, message: '非目前 Stripe 環境訂閱' })
  }

  try {
    const latest = await stripe.invoices.retrieve(invoice.id)
    // Smart Retry 事件可能亂序；若 invoice 已補繳成功，失敗事件不得降級訂閱。
    if (latest.status === 'paid') {
      return NextResponse.json({ success: true, message: '發票已補繳，略過舊失敗事件' })
    }
    const payment = await resolveInvoicePaymentIntent(stripe, latest)
    await processSubscriptionPeriodFailed({
      subscriptionId,
      gatewayPeriodKey: invoice.id,
      actualAmount: Math.round(invoice.amount_due / 100),
      isFirstPeriod: invoice.billing_reason === 'subscription_create',
      gatewayInvoiceId: invoice.id,
      gatewayPaymentId: payment.paymentIntentId,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      gatewayMeta: {
        source: 'invoice.payment_failed',
        invoiceId: invoice.id,
        billingReason: invoice.billing_reason,
        attemptCount: invoice.attempt_count,
      },
    })
    return NextResponse.json({ success: true, message: '失敗期款已處理' })
  } catch (err) {
    console.error(
      '[Stripe Webhook] invoice.payment_failed 處理失敗:',
      invoice.id,
      err
    )
    return NextResponse.json(
      { success: false, message: '處理失敗' },
      { status: 500 }
    )
  }
}

async function handleStripeInvoiceRequiresAttention(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventType: string,
  stripeEnvironment: 'stripe:test' | 'stripe:live'
): Promise<NextResponse> {
  if (!invoice.id) return NextResponse.json({ success: true, message: '缺 invoice id' })
  const resolved = await resolveSubscriptionFromInvoice(stripe, invoice)
  if (!resolved.isSubscriptionInvoice || !resolved.subscriptionId) {
    return NextResponse.json({ success: true, message: '非本站訂閱，略過' })
  }
  const local = await prisma.courseSubscription.findUnique({
    where: { id: resolved.subscriptionId },
    select: { gateway: true, gatewayEnvironment: true },
  })
  if (
    !local ||
    local.gateway !== 'stripe' ||
    (local.gatewayEnvironment &&
      local.gatewayEnvironment !== stripeEnvironment)
  ) {
    return NextResponse.json({ success: true, message: '非目前 Stripe 環境訂閱' })
  }
  const latest = await stripe.invoices.retrieve(invoice.id)
  if (latest.status === 'paid') {
    return NextResponse.json({ success: true, message: '發票已付款，略過舊事件' })
  }
  const payment = await resolveInvoicePaymentIntent(stripe, latest)
  await processSubscriptionPeriodFailed({
    subscriptionId: resolved.subscriptionId,
    gatewayPeriodKey: invoice.id,
    actualAmount: Math.round(invoice.amount_due / 100),
    isFirstPeriod: invoice.billing_reason === 'subscription_create',
    gatewayInvoiceId: invoice.id,
    gatewayPaymentId: payment.paymentIntentId,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    gatewayMeta: {
      source: eventType,
      invoiceId: invoice.id,
      lastFinalizationError: invoice.last_finalization_error?.message ?? null,
    },
  })
  return NextResponse.json({ success: true, message: '需處理的發票已記錄' })
}

async function handleStripeSubscriptionUpdated(
  stripe: Stripe,
  eventSubscription: Stripe.Subscription,
  stripeEnvironment: 'stripe:test' | 'stripe:live'
): Promise<NextResponse> {
  // Stripe 不保證事件順序；以 provider 當下狀態為準，避免晚到的 past_due/paused
  // snapshot 在已補繳成功後再次撤權。
  let subscription = eventSubscription
  try {
    subscription = await stripe.subscriptions.retrieve(eventSubscription.id)
  } catch (error) {
    console.warn(
      '[Stripe Webhook] subscription.updated 即時狀態查詢失敗，要求重試:',
      eventSubscription.id,
      error
    )
    return NextResponse.json(
      { success: false, message: '無法確認 Stripe 訂閱最新狀態' },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }
  const metadataId = subscription.metadata?.subscriptionId
  const local = await prisma.courseSubscription.findFirst({
    where: {
      gateway: 'stripe',
      OR: [
        { gatewaySubscriptionId: subscription.id },
        ...(metadataId ? [{ id: metadataId }] : []),
      ],
    },
  })
  if (!local) {
    return NextResponse.json({ success: true, message: '非本站訂閱，略過' })
  }
  if (
    local.gatewayEnvironment &&
    local.gatewayEnvironment !== stripeEnvironment
  ) {
    return NextResponse.json({ success: true, message: '非目前 Stripe 環境訂閱' })
  }
  if (
    local.gatewaySubscriptionId &&
    local.gatewaySubscriptionId !== subscription.id
  ) {
    // 同一 metadata 的重複／已退款 provider subscription 可能晚到 updated；不得用它
    // 覆寫目前已綁定的合法訂閱，也不應 409 讓 Stripe 永久重試。
    console.warn('[Stripe Webhook] 略過非目前綁定的 subscription.updated:', {
      localId: local.id,
      expected: local.gatewaySubscriptionId,
      received: subscription.id,
    })
    return NextResponse.json({ success: true, message: '非目前綁定訂閱，略過' })
  }

  const stripeStatus = subscription.status as string
  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
    return handleStripeSubscriptionDeleted(subscription, stripeEnvironment)
  }

  const periodEnd = periodEndFromStripeSubscription(subscription)
  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    if (!local.cancelRequestedAt && local.paidPeriods > 0) {
      const failedOrders = await prisma.order.count({
        where: { subscriptionId: local.id, status: 'FAILED' },
      })
      await prisma.courseSubscription.updateMany({
        where: {
          id: local.id,
          cancelRequestedAt: null,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        data: {
          status: failedOrders === 0 ? 'ACTIVE' : 'PAST_DUE',
          currentPeriodEnd:
            periodEnd &&
            (!local.currentPeriodEnd || periodEnd > local.currentPeriodEnd)
              ? periodEnd
              : local.currentPeriodEnd,
        },
      })
    }
    return NextResponse.json({ success: true, message: 'Stripe 訂閱狀態已同步' })
  }

  if (
    stripeStatus === 'past_due' ||
    stripeStatus === 'unpaid' ||
    stripeStatus === 'paused' ||
    stripeStatus === 'incomplete'
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.courseSubscription.updateMany({
        where: {
          id: local.id,
          status: { in: ['PENDING', 'ACTIVE', 'PAST_DUE'] },
        },
        data: {
          status: 'PAST_DUE',
          attentionReason:
            stripeStatus === 'unpaid' || stripeStatus === 'paused'
              ? 'STRIPE_ACCESS_SUSPENDED'
              : local.attentionReason,
        },
      })
      if (stripeStatus === 'unpaid' || stripeStatus === 'paused') {
        await tx.purchase.updateMany({
          where: {
            userId: local.userId,
            courseId: local.courseId,
            source: 'SUBSCRIPTION',
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        })
      }
    })
  }

  return NextResponse.json({ success: true, message: 'Stripe 訂閱狀態已同步' })
}

async function handleStripeChargeRefunded(
  charge: Stripe.Charge
): Promise<NextResponse> {
  const paymentIntentId = stripeObjectId(charge.payment_intent)
  if (!paymentIntentId) {
    return NextResponse.json({ success: true, message: '退款無 PaymentIntent，略過' })
  }
  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    orderBy: { paidAt: 'desc' },
  })
  if (!order) return NextResponse.json({ success: true, message: '非本站退款' })

  const fullyRefunded = charge.refunded || charge.amount_refunded >= charge.amount
  const latestRefundId = charge.refunds?.data.at(-1)?.id ?? null
  if (!fullyRefunded) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        refundStatus: 'PARTIAL',
        refundRequestedAt: order.refundRequestedAt ?? new Date(),
        gatewayRefundId: latestRefundId ?? order.gatewayRefundId,
      },
    })
    return NextResponse.json({ success: true, message: '部分退款已記錄' })
  }

  const isAnomalousPeriod =
    order.refundReason === 'ANOMALOUS_SUBSCRIPTION_PERIOD'
  const finalized = await finalizeOrderRefund({
    orderId: order.id,
    reason: order.refundReason ?? 'Stripe 全額退款 webhook',
    gatewayRefundId: latestRefundId,
    terminateSubscription: !isAnomalousPeriod,
  })
  if (finalized.subscriptionId && !isAnomalousPeriod) {
    await cancelLocalSubscription({
      subscriptionId: finalized.subscriptionId,
      reason: 'stripe_refund',
    })
  }
  const invoiceSync = await processOrderInvoiceOutbox(order.id, 'SYNC_INVOICE_REFUND')
  if (!invoiceSync.success) {
    console.error('[Stripe Webhook] 退款發票沖銷已排入重試:', invoiceSync.error)
  }
  return NextResponse.json({ success: true, message: 'Stripe 退款已同步' })
}

async function handleStripeDispute(
  dispute: Stripe.Dispute,
  eventType: string
): Promise<NextResponse> {
  let charge = typeof dispute.charge === 'string' ? null : dispute.charge
  if (!charge && typeof dispute.charge === 'string') {
    const gateway = await getGatewayByType('stripe')
    if (!(gateway instanceof StripeGateway)) {
      throw new Error('Stripe gateway type mismatch')
    }
    charge = await gateway.getStripeInstance().charges.retrieve(dispute.charge)
  }
  const paymentIntentId = stripeObjectId(charge?.payment_intent)
  if (!paymentIntentId) {
    return NextResponse.json({ success: true, message: '爭議無 PaymentIntent，略過' })
  }
  const disputeStatus: 'NEEDS_RESPONSE' | 'WON' | 'LOST' | 'CLOSED' =
    eventType === 'charge.dispute.created'
      ? 'NEEDS_RESPONSE'
      : dispute.status === 'won'
        ? 'WON'
        : dispute.status === 'lost'
          ? 'LOST'
          : 'CLOSED'
  const marked = await markOrderDispute({
    paymentIntentId,
    status: disputeStatus,
    disputeId: dispute.id,
  })
  if (marked?.subscriptionId && disputeStatus === 'NEEDS_RESPONSE') {
    await cancelLocalSubscription({
      subscriptionId: marked.subscriptionId,
      reason: 'payment_dispute',
    })
  }
  return NextResponse.json({ success: true, message: 'Stripe 爭議已同步' })
}

/**
 * customer.subscription.deleted（AC-38，PRD §4.5/§4.6）。
 * Stripe 重試耗盡 / 期滿排程走完後 Stripe 端刪除訂閱：
 *   - 已 COMPLETED / CANCELED（本地已終態）→ 不動作（冪等）
 *   - FIXED_TERM 未繳滿 → 不轉 COMPLETED，設 attentionReason='TERM_ENDED_UNDERPAID' + 管理員告警
 *   - 其餘（含 UNLIMITED、FIXED_TERM 已繳滿卻未收到 invoice.paid 的兜底）→ CANCELED + 終止信 + 管理員告警
 */
async function handleStripeSubscriptionDeleted(
  subscription: Stripe.Subscription,
  stripeEnvironment: 'stripe:test' | 'stripe:live'
): Promise<NextResponse> {
  const metadataId = subscription.metadata?.subscriptionId
  const localIdentity = await prisma.courseSubscription.findFirst({
    where: {
      gateway: 'stripe',
      OR: [
        { gatewaySubscriptionId: subscription.id },
        ...(metadataId ? [{ id: metadataId }] : []),
      ],
    },
    select: { id: true },
  })
  const subscriptionId = localIdentity?.id ?? metadataId
  if (!subscriptionId) {
    console.warn(
      '[Stripe Webhook] subscription.deleted 缺少 subscriptionId metadata:',
      subscription.id
    )
    // 無 metadata：舊訂閱或非本站訂閱 → 回 200 不重試
    return NextResponse.json({ success: true, message: '無對應訂閱' })
  }

  type DeletedAction =
    | { kind: 'noop' }
    | {
        kind: 'underpaid'
        courseTitle: string
        userEmail: string | null
        paidPeriods: number
        totalPeriods: number | null
      }
    | {
        kind: 'terminated'
        courseTitle: string
        userEmail: string | null
        userName: string | null
        accessEndsAt: Date | null
      }

  const resolved: DeletedAction = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CourseSubscription" WHERE "id" = ${subscriptionId} FOR UPDATE`
    const sub = await tx.courseSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        course: { select: { title: true } },
        user: { select: { email: true, name: true } },
      },
    })
    if (!sub) return { kind: 'noop' }
    if (
      sub.gateway !== 'stripe' ||
      (sub.gatewayEnvironment &&
        sub.gatewayEnvironment !== stripeEnvironment) ||
      (sub.gatewaySubscriptionId &&
        sub.gatewaySubscriptionId !== subscription.id)
    ) {
      // 被取消的重複 Stripe Subscription 也會發 deleted；metadata 仍指向本地 id，
      // 但它不能終止另一筆已正確綁定且仍有效的訂閱。
      return { kind: 'noop' }
    }

    // 已終態（COMPLETED / CANCELED）→ 冪等，不動作
    if (sub.status === 'COMPLETED' || sub.status === 'CANCELED') {
      return { kind: 'noop' }
    }

    // 本站已先持久化取消意圖：provider deleted 是成功確認，不應誤報非自願終止。
    if (sub.cancelRequestedAt) {
      await tx.courseSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'CANCELED',
          canceledAt: sub.canceledAt ?? new Date(),
          cancelReason: sub.cancelReason ?? 'requested_cancel',
          pendingGatewayCancelAt: null,
          attentionReason:
            sub.attentionReason === 'CANCEL_RETRY_PENDING' ||
            sub.attentionReason === 'CANCEL_RETRY_EXHAUSTED'
              ? null
              : sub.attentionReason,
        },
      })
      return { kind: 'noop' }
    }

    const isFixedTerm =
      sub.planType === 'FIXED_TERM' && sub.totalPeriods != null
    const underpaid =
      isFixedTerm && sub.paidPeriods < (sub.totalPeriods as number)

    if (underpaid) {
      // 事件可能先於最後一張 invoice.paid 抵達；保留 PAST_DUE，讓晚到的合法
      // 最後一期仍可在 row lock 下完成，不可過早 CANCELED 後誤退款。
      await tx.courseSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'PAST_DUE',
          cancelReason: 'gateway_terminated',
          attentionReason: 'TERM_ENDED_UNDERPAID',
        },
      })
      return {
        kind: 'underpaid',
        courseTitle: sub.course.title,
        userEmail: sub.user.email,
        paidPeriods: sub.paidPeriods,
        totalPeriods: sub.totalPeriods,
      }
    }

    // 一般非自願終止 → CANCELED（權限於已付期末+寬限自然斷）
    await tx.courseSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancelReason: 'gateway_terminated',
      },
    })
    return {
      kind: 'terminated',
      courseTitle: sub.course.title,
      userEmail: sub.user.email,
      userName: sub.user.name,
      accessEndsAt: sub.currentPeriodEnd
        ? new Date(
            sub.currentPeriodEnd.getTime() +
              SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000
          )
        : null,
    }
  })

  // ---- 交易外通知（fire-and-forget 容錯）----
  if (resolved.kind === 'underpaid') {
    const a = resolved
    sendAdminSubscriptionAlert({
      reason: 'TERM_ENDED_UNDERPAID',
      subscriptionId,
      courseTitle: a.courseTitle,
      userEmail: a.userEmail,
      detail: `已終止但未繳滿（${a.paidPeriods}/${a.totalPeriods ?? '?'}）`,
    }).catch(() => {})
  } else if (resolved.kind === 'terminated') {
    const a = resolved
    sendSubscriptionTerminated({
      subscriptionId,
      toEmail: a.userEmail,
      userName: a.userName,
      courseTitle: a.courseTitle,
      accessEndsAt: a.accessEndsAt,
    }).catch(() => {})
    sendAdminSubscriptionAlert({
      reason: 'GATEWAY_TERMINATED',
      subscriptionId,
      courseTitle: a.courseTitle,
      userEmail: a.userEmail,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, message: '訂閱終止已處理' })
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Stripe Webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  })
}
