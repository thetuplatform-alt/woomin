// lib/subscription/service.ts
// 訂閱結帳建立與取消的共用服務。
//
// createSubscriptionCheckout：建 PENDING 訂閱 + 首期 Order 的交易
//   （阻擋規則 AC-25、PENDING 復用/汰換 AC-26、consent 存證 AC-23），
//   然後呼叫 gateway.createSubscriptionSession。
// cancelSubscription：先 gateway 後本地（PRD §4.7），供前台/後台/退款共用。

import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateOrderNo } from '@/lib/payment/shared'
import { isPurchaseActive } from '@/lib/purchase/is-active'
import {
  getPaymentGatewaySettings,
  getGatewayByType,
} from '@/lib/payment/gateway-factory'
import { gatewayTypeSupportsSubscription } from '@/lib/payment/subscription-support'
import { getPostHogClient, flushPostHogInBackground } from '@/lib/posthog-server'
import type { CreatePaymentResult } from '@/lib/payment/types'
import type { PaymentGatewayType } from '@/lib/payment/types'
import type { CheckoutInvoiceInput } from '@/lib/validations/einvoice'
import { resolveCourseInviteToken } from '@/lib/actions/course-invites'
import { withCourseInviteOrderMetadata } from '@/lib/payment/course-invite-order-metadata'
import { validateCheckoutInvoiceBeforePayment } from '@/lib/invoice/preflight'
import {
  SUBSCRIPTION_CONSENT_TEXT_VERSION,
  SUBSCRIPTION_PENDING_REUSE_MINUTES,
  SUBSCRIPTION_TRADE_NO_PREFIX,
} from './constants'

/** createSubscriptionCheckout 結果 */
export type CreateSubscriptionCheckoutResult =
  | {
      success: true
      data: {
        subscriptionId: string
        orderNo: string
        payment: CreatePaymentResult
      }
    }
  | {
      success: false
      error: string
      /** 阻擋原因碼，供前端顯示對應提示 */
      code?:
        | 'NOT_LOGGED_IN'
        | 'GUEST_NOT_ALLOWED'
        | 'GATEWAY_UNSUPPORTED'
        | 'PLAN_NOT_FOUND'
        | 'PLAN_DISABLED'
        | 'COURSE_UNAVAILABLE'
        | 'ALREADY_ACTIVE_PURCHASE'
        | 'ALREADY_SUBSCRIBED'
        | 'CONSENT_REQUIRED'
        | 'INVOICE_INVALID'
      /** ALREADY_ACTIVE_PURCHASE 時附上可觀看至日期 */
      accessEndsAt?: Date | null
    }

export interface CreateSubscriptionCheckoutParams {
  userId: string
  /** 是否為正式會員（訪客 / guest shell 拒絕） */
  isGuest: boolean
  courseId: string
  planId: string
  /** 前端自動扣款同意（後端必為 true 否則 4xx） */
  recurringConsent: boolean
  /** 電子發票偏好（結帳頁收集；寫入訂閱快照與首期 Order） */
  invoice?: CheckoutInvoiceInput | null
  invite?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  baseUrl: string
}

function storedSubscriptionCheckout(value: unknown): CreatePaymentResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const payment = (value as Record<string, unknown>).subscriptionCheckout
  if (!payment || typeof payment !== 'object' || Array.isArray(payment)) return null
  const candidate = payment as Record<string, unknown>
  if (candidate.type !== 'redirect' && candidate.type !== 'form_post') return null
  return candidate as unknown as CreatePaymentResult
}

function gatewayEnvironment(
  gateway: PaymentGatewayType,
  settings: Awaited<ReturnType<typeof getPaymentGatewaySettings>>
): string {
  if (gateway === 'stripe') {
    return settings.stripe.secretKey.includes('_live_')
      ? 'stripe:live'
      : 'stripe:test'
  }
  return settings.payuni.testMode ? 'payuni:sandbox' : 'payuni:production'
}

/** 將結帳發票偏好正規化為 Order / CourseSubscription 的 invoice* 欄位（空字串→null） */
function invoiceSnapshot(invoice?: CheckoutInvoiceInput | null) {
  const nz = (v?: string | null) => (v && v.length > 0 ? v : null)
  return {
    invoiceType: invoice?.invoiceType ?? null,
    invoiceCarrierType: nz(invoice?.carrierType),
    invoiceCarrierId: nz(invoice?.carrierId),
    invoiceTaxId: nz(invoice?.taxId),
    invoiceTitle: nz(invoice?.title),
    invoiceLoveCode: nz(invoice?.loveCode),
    invoiceAddress: nz(invoice?.address),
  }
}

/** 產生 PAYUNi MerTradeNo（gatewayTradeNo）：SUB + YYYYMMDD + 12 hex = 23 碼（≤25） */
function generateSubscriptionTradeNo(): string {
  const now = new Date()
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0')
  const random = crypto.randomBytes(6).toString('hex') // 12 hex
  return `${SUBSCRIPTION_TRADE_NO_PREFIX}${dateStr}${random}`
}

/**
 * 建立訂閱結帳。
 * 建單交易成功後（PENDING 訂閱 + 第 1 期 PENDING Order）呼叫 gateway 建立扣款會話。
 */
export async function createSubscriptionCheckout(
  params: CreateSubscriptionCheckoutParams
): Promise<CreateSubscriptionCheckoutResult> {
  const {
    userId,
    isGuest,
    courseId,
    planId,
    recurringConsent,
    invoice,
    invite,
    clientIpAddress,
    clientUserAgent,
    baseUrl,
  } = params

  // 訪客 / guest shell 拒絕（AC-24）
  if (isGuest) {
    return {
      success: false,
      error: '訂閱僅限已登入的正式會員',
      code: 'GUEST_NOT_ALLOWED',
    }
  }

  // 同意後端驗證（AC-22）
  if (recurringConsent !== true) {
    return {
      success: false,
      error: '必須同意定期自動扣款條款才能訂閱',
      code: 'CONSENT_REQUIRED',
    }
  }

  // gateway 支援檢查（AC-08 gating）
  const paymentSettings = await getPaymentGatewaySettings()
  const gatewayType = paymentSettings.gateway
  if (!gatewayTypeSupportsSubscription(gatewayType)) {
    return {
      success: false,
      error: '目前金流不支援訂閱制',
      code: 'GATEWAY_UNSUPPORTED',
    }
  }

  // 方案與課程檢查
  const plan = await prisma.courseSubscriptionPlan.findUnique({
    where: { id: planId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          status: true,
          salesVisibility: true,
        },
      },
    },
  })
  if (!plan || plan.courseId !== courseId) {
    return { success: false, error: '找不到訂閱方案', code: 'PLAN_NOT_FOUND' }
  }
  if (!plan.enabled) {
    return { success: false, error: '此訂閱方案已停用', code: 'PLAN_DISABLED' }
  }
  if (plan.course.status === 'DRAFT') {
    return {
      success: false,
      error: '課程尚未開放',
      code: 'COURSE_UNAVAILABLE',
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  })
  if (!user) {
    return { success: false, error: '請先登入', code: 'NOT_LOGGED_IN' }
  }

  const invoicePreflight = await validateCheckoutInvoiceBeforePayment({
    invoice,
    buyerEmail: user.email,
  })
  if (!invoicePreflight.success) {
    return {
      success: false,
      error: invoicePreflight.error ?? '發票資料驗證失敗',
      code: 'INVOICE_INVALID',
    }
  }

  let inviteMetadata:
    | { inviteId: string; courseId: string; maxUses: number | null; consumedAt: null }
    | null = null
  if (plan.course.salesVisibility === 'INVITE_ONLY') {
    const resolution = await resolveCourseInviteToken({
      token: invite,
      courseId,
      userEmail: user.email,
    })
    if (!resolution.valid) {
      return {
        success: false,
        error: '此課程需要有效邀請連結才能訂閱',
        code: 'COURSE_UNAVAILABLE',
      }
    }
    inviteMetadata = {
      inviteId: resolution.inviteId,
      courseId,
      maxUses: resolution.maxUses,
      consumedAt: null,
    }
  }

  // 阻擋規則（AC-25）：任何有效（未撤銷未過期）Purchase → 拒絕
  const existingPurchase = await prisma.purchase.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { revokedAt: true, expiresAt: true },
  })
  if (isPurchaseActive(existingPurchase)) {
    return {
      success: false,
      error: '你目前仍可觀看此課程，屆時可重新訂閱',
      code: 'ALREADY_ACTIVE_PURCHASE',
      accessEndsAt: existingPurchase?.expiresAt ?? null,
    }
  }

  const tradeNo = generateSubscriptionTradeNo()

  // ---- 建單交易：PENDING 復用 / 汰換 + 建 PENDING 訂閱 + 首期 Order ----
  let subscriptionId: string
  let orderNo: string
  let orderId: string
  try {
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date()
      const reuseThreshold = new Date(
        now.getTime() - SUBSCRIPTION_PENDING_REUSE_MINUTES * 60 * 1000
      )

      // 已有 ACTIVE/PAST_DUE 訂閱 → 阻擋（AC-25）
      const activeSub = await tx.courseSubscription.findFirst({
        where: {
          userId,
          courseId,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        select: { id: true },
      })
      if (activeSub) {
        throw new BlockError('ALREADY_SUBSCRIBED', '你已經訂閱此課程')
      }

      // PENDING 復用 / 汰換（AC-26）
      const pending = await tx.courseSubscription.findFirst({
        where: { userId, courseId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: {
          orders: {
            where: { periodNumber: 1 },
            take: 1,
          },
        },
      })

      if (pending) {
        const isSamePlan = pending.planId === planId
        const isSameGateway = pending.gateway === gatewayType
        const hasSameSnapshot =
          pending.pricePerPeriod === plan.price &&
          pending.interval === plan.interval &&
          pending.planType === plan.type &&
          pending.totalPeriods === plan.totalPeriods &&
          pending.termEndBehavior === plan.termEndBehavior
        const isFresh = pending.createdAt.getTime() >= reuseThreshold.getTime()
        const firstOrder = pending.orders[0]
        const canRetryUncreatedPayUniCheckout =
          pending.gateway === 'payuni' && !pending.gatewaySubscriptionId

        if (
          isSamePlan &&
          isSameGateway &&
          hasSameSnapshot &&
          (isFresh || canRetryUncreatedPayUniCheckout) &&
          firstOrder
        ) {
          // 30 分鐘內同方案復用。PAYUNi 若連 PeriodTradeNo 都尚未建立，超時後仍以
          // 同一 MerTradeNo 重新產生付款表單；該編號可防建立第二筆外部訂閱，並
          // 避免 Notify/Return 都未發生時形成無法自行恢復的永久 PENDING。
          const snapshot = invoiceSnapshot(invoice)
          await tx.courseSubscription.update({
            where: { id: pending.id },
            data: snapshot,
          })
          await tx.order.update({
            where: { id: firstOrder.id },
            data: snapshot,
          })
          return {
            subscriptionId: pending.id,
            orderId: firstOrder.id,
            orderNo: firstOrder.orderNo,
          }
        }

        // Provider checkout 必須先在外部安全關閉才能釋放本地名額。不可先把本地
        // 改成 CANCELED 再 best-effort expire，否則舊付款頁仍可能真的扣款。
        throw new BlockError(
          'ALREADY_SUBSCRIBED',
          '你已有未完成的訂閱結帳。請使用原付款頁完成，或等待系統確認付款頁失效後再更換方案。'
        )
      }

      // 建 PENDING 訂閱
      const created = await tx.courseSubscription.create({
        data: {
          userId,
          courseId,
          planId,
          status: 'PENDING',
          gateway: gatewayType,
          gatewayTradeNo: tradeNo,
          checkoutIdempotencyKey: `subscription_checkout_${crypto.randomUUID()}`,
          gatewayPriceId: gatewayType === 'stripe' ? plan.stripePriceId : null,
          gatewayEnvironment: gatewayEnvironment(gatewayType, paymentSettings),
          // 方案快照
          planType: plan.type,
          interval: plan.interval,
          pricePerPeriod: plan.price,
          totalPeriods: plan.totalPeriods,
          termEndBehavior: plan.termEndBehavior,
          // 同意存證（AC-23）
          consentAt: now,
          consentTextVersion: SUBSCRIPTION_CONSENT_TEXT_VERSION,
          // 電子發票偏好快照
          ...invoiceSnapshot(invoice),
        },
      })

      // 建第 1 期 PENDING Order
      const order = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          userId,
          courseId,
          subscriptionId: created.id,
          periodNumber: 1,
          amount: plan.price,
          originalAmount: plan.price,
          status: 'PENDING',
          paymentGateway: gatewayType,
          gatewayPaymentInstructions: inviteMetadata
            ? withCourseInviteOrderMetadata(null, inviteMetadata)
            : undefined,
          clientIpAddress: clientIpAddress ?? null,
          clientUserAgent: clientUserAgent ?? null,
          // 發票偏好同步寫入 Order
          ...invoiceSnapshot(invoice),
        },
      })

      return {
        subscriptionId: created.id,
        orderId: order.id,
        orderNo: order.orderNo,
      }
    })

    subscriptionId = result.subscriptionId
    orderId = result.orderId
    orderNo = result.orderNo
  } catch (err) {
    if (err instanceof BlockError) {
      return { success: false, error: err.message, code: err.code }
    }
    // partial unique index 併發衝突（P2002）→ 已有進行中訂閱
    if (isUniqueViolation(err)) {
      return {
        success: false,
        error: '你已經有進行中的訂閱',
        code: 'ALREADY_SUBSCRIBED',
      }
    }
    throw err
  }

  // ---- 交易外：呼叫 gateway 建立訂閱扣款會話 ----
  const subscription = await prisma.courseSubscription.findUnique({
    where: { id: subscriptionId },
  })
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!subscription || !order) {
    return { success: false, error: '建立訂閱失敗' }
  }


  // Fresh PENDING 的重試直接回傳原 provider session/form，避免建立第二筆外部訂閱。
  const storedPayment = storedSubscriptionCheckout(order.stripeResponse)
  const storedFormIsFresh =
    storedPayment?.type === 'form_post' &&
    Date.now() - order.updatedAt.getTime() < 10 * 60 * 1000
  if (storedPayment?.type === 'redirect' || storedFormIsFresh) {
    return {
      success: true,
      data: { subscriptionId, orderNo, payment: storedPayment },
    }
  }

  const subscriptionGateway = subscription.gateway as PaymentGatewayType
  const gateway = await getGatewayByType(subscriptionGateway)
  if (!gateway.createSubscriptionSession) {
    return {
      success: false,
      error: '目前金流不支援訂閱制',
      code: 'GATEWAY_UNSUPPORTED',
    }
  }

  const frozenPlan = {
    ...plan,
    price: subscription.pricePerPeriod,
    interval: subscription.interval,
    type: subscription.planType,
    totalPeriods: subscription.totalPeriods,
    termEndBehavior: subscription.termEndBehavior,
    stripePriceId: subscription.gatewayPriceId,
  }

  const payment = await gateway.createSubscriptionSession({
    subscription,
    plan: frozenPlan,
    order: { id: order.id, orderNo: order.orderNo, amount: order.amount },
    user: {
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
    },
    courseTitle: plan.course.title,
    baseUrl,
  })

  // gateway 回傳的 session id 存入首期 Order
  await prisma.order.updateMany({
    where: { id: order.id, status: 'PENDING' },
    data: {
      stripeSessionId: payment.gatewaySessionId ?? order.stripeSessionId,
      stripeResponse: {
        subscriptionCheckout: payment as unknown as Prisma.InputJsonValue,
      },
    },
  })

  return { success: true, data: { subscriptionId, orderNo, payment } }
}

/** 取消結果 */
export interface CancelSubscriptionResult {
  success: boolean
  error?: string
}

/**
 * 取消訂閱（先 gateway 後本地，PRD §4.7）。
 * 供前台自助取消、後台代取消、退款流程共用。
 * 呼叫端負責權限（本人 / 管理員）與 AdminLog；本函式只做狀態機。
 *
 * @param reason cancelReason（如 'user_request' / 'admin_request' / 'refund'）
 */
export async function cancelSubscription(params: {
  subscriptionId: string
  reason: string
}): Promise<CancelSubscriptionResult> {
  const { subscriptionId, reason } = params

  const sub = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CourseSubscription" WHERE "id" = ${subscriptionId} FOR UPDATE`
    const current = await tx.courseSubscription.findUnique({
      where: { id: subscriptionId },
    })
    if (!current) return null
    if (current.status === 'CANCELED' || current.status === 'COMPLETED') {
      return current
    }
    if (current.status !== 'ACTIVE' && current.status !== 'PAST_DUE') {
      return current
    }

    return tx.courseSubscription.update({
      where: { id: subscriptionId },
      data: {
        // durable cancellation intent is written before the network call. Renewal checks
        // this field under row lock and can no longer revive access while cancellation runs.
        cancelRequestedAt: current.cancelRequestedAt ?? new Date(),
        cancelReason: current.cancelReason ?? reason,
        pendingGatewayCancelAt: new Date(),
      },
    })
  })
  if (!sub) {
    return { success: false, error: '找不到訂閱' }
  }

  if (sub.status === 'CANCELED' || sub.status === 'COMPLETED') {
    return { success: true }
  }

  // 僅 ACTIVE / PAST_DUE 可取消（PENDING 由 checkout 汰換、終態不需再取消）
  if (sub.status !== 'ACTIVE' && sub.status !== 'PAST_DUE') {
    return { success: false, error: '此訂閱狀態無法取消' }
  }

  // ---- 先 gateway ----
  const gateway = await getGatewayByType(sub.gateway as 'stripe' | 'payuni')
  if (gateway.cancelSubscription) {
    const gatewayResult = await gateway.cancelSubscription({ subscription: sub })
    if (!gatewayResult.success) {
      // 所有 gateway 都保留 durable intent，由 maintenance 重試。此時不宣稱已取消，
      // 但 renewal 已被 cancelRequestedAt 阻擋，不會再次授權。
      await prisma.courseSubscription.updateMany({
        where: { id: subscriptionId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        data: {
          pendingGatewayCancelAt: new Date(),
          attentionReason: 'CANCEL_RETRY_PENDING',
        },
      })
      return {
        success: false,
        error: gatewayResult.error || '取消請求已記錄，系統將自動重試；請勿重複操作',
      }
    }
  }

  // ---- 後本地 ----
  await prisma.courseSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
      cancelReason: reason,
      pendingGatewayCancelAt: null,
      attentionReason:
        sub.attentionReason === 'CANCEL_RETRY_PENDING' ||
        sub.attentionReason === 'CANCEL_RETRY_EXHAUSTED'
          ? null
          : sub.attentionReason,
    },
  })

  // PostHog: subscription_canceled（AC-75）。所有取消入口（前台自助 / 後台代取消 /
  // 退款）都經此共用路徑，於此單點發送即涵蓋三者。fire-and-forget 容錯不阻斷取消。
  try {
    const posthog = await getPostHogClient()
    if (posthog) {
      posthog.capture({
        distinctId: sub.userId,
        event: 'subscription_canceled',
        properties: {
          subscription_id: subscriptionId,
          course_id: sub.courseId,
          gateway: sub.gateway,
          plan_type: sub.planType,
          reason,
        },
      })
      flushPostHogInBackground(posthog)
    }
  } catch (err) {
    console.error('[subscription] PostHog subscription_canceled 發送失敗:', err)
  }

  return { success: true }
}

/** 建單交易內阻擋用的具名錯誤 */
class BlockError extends Error {
  constructor(
    public code: 'ALREADY_SUBSCRIBED',
    message: string
  ) {
    super(message)
    this.name = 'BlockError'
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
