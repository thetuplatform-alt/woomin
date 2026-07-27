// lib/payment/stripe-gateway.ts
// Stripe 金流閘道實作

import Stripe from 'stripe'
import type {
  PaymentGateway,
  CreatePaymentSessionParams,
  CreatePaymentResult,
  CreateSubscriptionSessionParams,
  RefundResult,
} from './types'
import type { CourseSubscription } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ensureStripeCustomer,
  ensureRecurringPrice,
  cancelStripeSubscription,
} from '@/lib/subscription/stripe-billing'

export class StripeGateway implements PaymentGateway {
  readonly type = 'stripe' as const
  /** 靜態能力宣告：Stripe 支援訂閱（原生 Billing） */
  readonly supportsSubscription = true
  private stripe: Stripe
  private secretKey: string
  private webhookSecret: string

  constructor(config: { secretKey: string; webhookSecret: string }) {
    this.secretKey = config.secretKey
    this.webhookSecret = config.webhookSecret
    this.stripe = new Stripe(config.secretKey, { typescript: true })
  }

  async createPaymentSession(
    params: CreatePaymentSessionParams
  ): Promise<CreatePaymentResult> {
    const { order, course, customerEmail, baseUrl, isOnSale, userId, courseId, bundleId, identityType } =
      params

    const activePriceId = isOnSale
      ? params.stripeSalePriceId
      : params.stripePriceId

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      metadata: {
        orderNo: order.orderNo,
        orderId: order.id,
        ...(courseId ? { courseId } : {}),
        ...(bundleId ? { bundleId } : {}),
        userId,
        identityType,
      },
      customer_email: customerEmail || undefined,
      success_url: `${baseUrl}/checkout/success?orderNo=${order.orderNo}`,
      cancel_url: `${baseUrl}/checkout/failed?orderNo=${order.orderNo}`,
      line_items: activePriceId
        ? [{ price: activePriceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: 'twd',
                product_data: {
                  name: course.title,
                  ...(course.subtitle ? { description: course.subtitle } : {}),
                },
                unit_amount: Math.round(order.amount * 100),
              },
              quantity: 1,
            },
          ],
    }

    if (!activePriceId) {
      sessionParams.currency = 'twd'
      console.warn(
        '[Stripe Gateway] 課程無預建 Price，使用 price_data 降級模式:',
        courseId || bundleId || order.orderNo
      )
    }

    const checkoutSession =
      await this.stripe.checkout.sessions.create(sessionParams)

    return {
      type: 'redirect',
      checkoutUrl: checkoutSession.url!,
      gatewaySessionId: checkoutSession.id,
    }
  }

  /**
   * 建立訂閱結帳會話（AC-33）。
   * mode:'subscription'，line_items 用方案的 recurring Price（缺失時 price_data.recurring 降級），
   * session 與 subscription 兩層 metadata 都塞 subscriptionId / orderNo，
   * success / cancel URL 沿用一次性結帳的格式（以首期 Order.orderNo 導向）。
   */
  async createSubscriptionSession(
    params: CreateSubscriptionSessionParams
  ): Promise<CreatePaymentResult> {
    const { subscription, plan, order, user, courseTitle, baseUrl } = params

    if (!subscription.checkoutIdempotencyKey) {
      throw new Error('訂閱缺少 Checkout 冪等鍵，拒絕建立 Stripe Session')
    }

    // 1. Find-or-create Stripe Customer（DB-key client；帶冪等鍵；回寫 User.stripeCustomerId）
    const customerId = await ensureStripeCustomer({
      userId: user.id,
      email: user.email,
      existingStripeCustomerId: user.stripeCustomerId,
    })

    // 2. 確保方案有 recurring Price（缺失時建立並回寫 plan.stripePriceId）
    let recurringPriceId = plan.stripePriceId
    try {
      recurringPriceId = await ensureRecurringPrice({
        planId: plan.id,
        courseTitle,
        interval: plan.interval,
        unitAmount: plan.price,
        existingStripePriceId: plan.stripePriceId,
      })
      await prisma.courseSubscription.updateMany({
        where: { id: subscription.id, status: 'PENDING' },
        data: { gatewayPriceId: recurringPriceId },
      })
    } catch (error) {
      // Price 同步失敗不阻擋結帳 → 走 price_data.recurring 降級
      console.warn(
        '[Stripe Gateway] recurring Price 同步失敗，改用 price_data 降級:',
        plan.id,
        error
      )
      recurringPriceId = null
      await prisma.courseSubscription.updateMany({
        where: { id: subscription.id, status: 'PENDING' },
        data: { gatewayPriceId: null },
      })
    }

    const stripeInterval: Stripe.PriceCreateParams.Recurring.Interval =
      plan.interval === 'YEAR' ? 'year' : 'month'

    // 兩層 metadata 都塞 subscriptionId / orderNo（AC-33 / AC-35 亂序安全）
    const sharedMetadata = {
      subscriptionId: subscription.id,
      orderNo: order.orderNo,
      orderId: order.id,
      userId: user.id,
      ...(subscription.courseId ? { courseId: subscription.courseId } : {}),
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      metadata: sharedMetadata,
      subscription_data: {
        metadata: sharedMetadata,
      },
      success_url: `${baseUrl}/checkout/success?orderNo=${order.orderNo}`,
      cancel_url: `${baseUrl}/checkout/failed?orderNo=${order.orderNo}`,
      line_items: recurringPriceId
        ? [{ price: recurringPriceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: 'twd',
                product_data: { name: courseTitle },
                unit_amount: Math.round(order.amount * 100),
                recurring: { interval: stripeInterval },
              },
              quantity: 1,
            },
          ],
    }

    if (!recurringPriceId) {
      console.warn(
        '[Stripe Gateway] 訂閱方案無 recurring Price，使用 price_data.recurring 降級模式:',
        plan.id
      )
    }

    const checkoutSession = await this.stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: subscription.checkoutIdempotencyKey }
    )

    return {
      type: 'redirect',
      checkoutUrl: checkoutSession.url!,
      gatewaySessionId: checkoutSession.id,
    }
  }

  /**
   * 取消訂閱（subscriptions.cancel）。
   * 委派 stripe-billing 的 cancelStripeSubscription（走 DB-key client、冪等）。
   */
  async cancelSubscription(params: {
    subscription: CourseSubscription
  }): Promise<{ success: boolean; error?: string }> {
    const { subscription } = params
    if (!subscription.gatewaySubscriptionId) {
      // 尚未取得 Stripe sub id（首期未完成）→ 無 gateway 端可取消，回成功由本地轉態
      return { success: true }
    }
    return cancelStripeSubscription({
      gatewaySubscriptionId: subscription.gatewaySubscriptionId,
    })
  }

  async processRefund(params: {
    gatewayPaymentId: string | null
    orderNo?: string
  }): Promise<RefundResult> {
    if (!params.gatewayPaymentId) {
      return { success: false, error: '缺少 Stripe Payment Intent ID，無法退款' }
    }

    try {
      // 以 payment intent 為基礎組成冪等鍵：即使因競態 / 快速雙擊重複呼叫，
      // Stripe 也只會建立一次退款，杜絕重複退款造成的金錢損失。
      const refund = await this.stripe.refunds.create(
        { payment_intent: params.gatewayPaymentId },
        { idempotencyKey: `refund_${params.orderNo || params.gatewayPaymentId}` }
      )
      if (refund.status === 'failed' || refund.status === 'canceled') {
        return {
          success: false,
          error: `Stripe 退款未成功（status=${refund.status}）`,
          gatewayRefundId: refund.id,
        }
      }
      return {
        success: true,
        gatewayRefundId: refund.id,
        pending: refund.status !== 'succeeded',
      }
    } catch (error) {
      return {
        success: false,
        error: `Stripe 退款失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const balance = await this.stripe.balance.retrieve()
      const isTestMode = this.secretKey.startsWith('sk_test_')
      const currencies = balance.available.map((b) => b.currency.toUpperCase())
      return {
        success: true,
        message: `連線成功（${isTestMode ? '測試' : '正式'}環境）。支援幣別：${currencies.join(', ')}`,
      }
    } catch (error) {
      return {
        success: false,
        message: `連線失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
      }
    }
  }

  getSettingsSummary(baseUrl: string) {
    return {
      keyHint: this.secretKey
        ? `${this.secretKey.slice(0, 7)}...${this.secretKey.slice(-4)}`
        : '',
      isTestMode: this.secretKey.startsWith('sk_test_'),
      webhookUrl: `${baseUrl}/api/webhooks/stripe`,
    }
  }

  /** 取得 Stripe 實例（供 webhook 驗證等直接使用） */
  getStripeInstance(): Stripe {
    return this.stripe
  }

  getWebhookSecret(): string {
    return this.webhookSecret
  }

  isTestMode(): boolean {
    return this.secretKey.startsWith('sk_test_')
  }
}
