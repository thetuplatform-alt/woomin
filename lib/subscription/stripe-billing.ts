// lib/subscription/stripe-billing.ts
// Stripe Billing 實作層（Stripe 組）。
//
// 硬性規定（PRD §2 / AC-09）：所有訂閱相關 Stripe 呼叫一律使用 gateway-factory 的
// DB 設定 client（StripeGateway 內部實例，經 getStripeInstance() 取得），
// 禁止走 lib/stripe.ts 的 env-only client。「只在後台填 key」的客戶站必須完整可用。
//
// 簽名穩定：renewal.ts / service.ts / gateway / webhook 依此簽名呼叫，不得變更簽名。

import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { StripeGateway } from '@/lib/payment/stripe-gateway'

/**
 * 取得 gateway-factory DB 設定的 Stripe client（AC-09）。
 * 一律走此函式，不得改用 lib/stripe.ts 的 env-only client。
 */
async function getDbKeyStripe(): Promise<Stripe> {
  const gw = await getGatewayByType('stripe')
  if (!(gw instanceof StripeGateway)) {
    throw new Error('Stripe gateway 設定不完整，無法執行訂閱 Stripe 呼叫')
  }
  return gw.getStripeInstance()
}

/**
 * TWD 金額轉 Stripe 最小單位。
 * 與 lib/stripe.ts 的 toStripeTwdAmount 一致：TWD 支援兩位小數，NT$ *100。
 */
function toStripeTwdAmount(amountTwdDollars: number): number {
  return Math.round(amountTwdDollars * 100)
}

/**
 * Find-or-create Stripe Customer 並回傳 customer id（AC-32）。
 *
 * 實作要點：
 *   - 已有 existingStripeCustomerId → 直接回傳（不重複建立）
 *   - customers.create 帶冪等鍵 `customer_create_{userId}`（防快速雙擊 / 事件亂序重複建立）
 *   - 本地以 updateMany({ where: { id, stripeCustomerId: null } }) 條件寫入，
 *     count=0（併發下已被另一路徑寫入）→ 改讀既有值回傳
 */
export async function ensureStripeCustomer(params: {
  userId: string
  email: string | null
  existingStripeCustomerId?: string | null
}): Promise<string> {
  const { userId, email, existingStripeCustomerId } = params

  // 已有 customer → 先向目前 Stripe account 驗證；不可盲目跨 test/live/account 復用。
  if (existingStripeCustomerId) {
    const stripe = await getDbKeyStripe()
    try {
      const existing = await stripe.customers.retrieve(existingStripeCustomerId)
      if (!existing.deleted) {
        const owner = existing.metadata?.userId
        if (owner && owner !== userId) {
          throw new Error('Stripe Customer 歸屬與本地使用者不符')
        }
        if (!owner) {
          await stripe.customers.update(existing.id, {
            metadata: { ...existing.metadata, userId },
          })
        }
        return existing.id
      }
    } catch (error) {
      if (
        error instanceof Error &&
        !/no such customer|resource_missing/i.test(error.message)
      ) {
        throw error
      }
      // Customer 已刪除或屬於另一個 Stripe account → 在目前 account 重建。
    }
  }

  const stripe = await getDbKeyStripe()

  // 以 userId 組冪等鍵：即使因競態 / 亂序重複呼叫，Stripe 只會建立一次 Customer
  const customer = await stripe.customers.create(
    {
      ...(email ? { email } : {}),
      metadata: { userId },
    },
    { idempotencyKey: `customer_create_${userId}` }
  )

  // 條件式寫回：只有 stripeCustomerId 仍為 null 時才寫入本次建立的 id
  const updated = await prisma.user.updateMany({
    where: {
      id: userId,
      stripeCustomerId: existingStripeCustomerId ?? null,
    },
    data: { stripeCustomerId: customer.id },
  })

  if (updated.count === 0) {
    // 併發：另一路徑已寫入 → 改讀既有值（避免站內 customer 與 Stripe 端不一致）
    const fresh = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })
    if (fresh?.stripeCustomerId) {
      return fresh.stripeCustomerId
    }
  }

  return customer.id
}

/**
 * 確保方案有對應的 recurring Price，回傳 priceId（AC-13 / AC-33）。
 *
 * 實作要點（PRD §2 硬性規定：DB-key client）：
 *   - 已有 existingStripePriceId 且金額 / 週期未變 → 直接沿用（不重建）
 *   - 缺失或變價 → 建新 recurring Price（不歸檔仍被進行中訂閱綁定的舊 Price）
 *   - Price 以 product_data 內聯建立 Product（無需課程 stripeProductId），
 *     並回寫 plan.stripePriceId
 */
export async function ensureRecurringPrice(params: {
  planId: string
  courseTitle: string
  interval: 'MONTH' | 'YEAR'
  unitAmount: number
  existingStripePriceId?: string | null
}): Promise<string> {
  const { planId, courseTitle, interval, unitAmount, existingStripePriceId } =
    params

  const stripe = await getDbKeyStripe()
  const stripeInterval: Stripe.PriceCreateParams.Recurring.Interval =
    interval === 'YEAR' ? 'year' : 'month'
  const targetAmount = toStripeTwdAmount(unitAmount)

  // 已有 Price → 若金額 / 週期一致則沿用；否則建新（Price immutable）
  if (existingStripePriceId) {
    try {
      const existing = await stripe.prices.retrieve(existingStripePriceId)
      if (
        existing.active &&
        existing.currency === 'twd' &&
        existing.unit_amount === targetAmount &&
        existing.recurring?.interval === stripeInterval &&
        existing.metadata?.planId === planId
      ) {
        return existing.id
      }
    } catch {
      // 讀取失敗（Price 不存在 / test-live 換 key / 不同帳戶）→ 走建新 Price
    }
  }

  // 建新 recurring Price（以 product_data 內聯建立 Product，DB-key client 自足）
  const created = await stripe.prices.create(
    {
      currency: 'twd',
      unit_amount: targetAmount,
      recurring: { interval: stripeInterval },
      product_data: { name: courseTitle },
      nickname: `subscription-plan:${planId}`,
      metadata: { planId },
    },
    {
      idempotencyKey: `subscription_price_${planId}_${targetAmount}_${stripeInterval}`,
    }
  )

  // 回寫 plan.stripePriceId（不歸檔舊 Price——進行中訂閱仍綁在舊 Price 上）
  await prisma.courseSubscriptionPlan.update({
    where: { id: planId },
    data: { stripePriceId: created.id },
  })

  return created.id
}

/**
 * 取消 Stripe 訂閱（subscriptions.cancel）（AC-39 / AC-56 / AC-62）。
 * 供期滿主動取消、用戶/管理員取消、退款後取消共用。
 *
 * 冪等：訂閱已在 Stripe 端取消（No such subscription / already canceled）視為成功，
 * 避免 maintenance 重試或重複退款流程把「已取消」誤判為失敗。
 */
export async function cancelStripeSubscription(params: {
  gatewaySubscriptionId: string
}): Promise<{ success: boolean; error?: string }> {
  const { gatewaySubscriptionId } = params

  try {
    const stripe = await getDbKeyStripe()
    await stripe.subscriptions.cancel(gatewaySubscriptionId)
    return { success: true }
  } catch (error) {
    // 已取消 / 不存在 → 視為冪等成功
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'resource_missing'
    ) {
      return { success: true }
    }
    const message =
      error instanceof Error ? error.message : 'Stripe 訂閱取消失敗'
    // 若訂閱已是取消狀態，Stripe 會回錯誤，仍視為成功
    if (/already canceled|no such subscription/i.test(message)) {
      return { success: true }
    }
    return { success: false, error: `Stripe 訂閱取消失敗: ${message}` }
  }
}

/**
 * Best-effort 作廢 Stripe Checkout Session（AC-26）。
 * 結帳汰換路徑（service.ts）作廢 stale / 換方案的 PENDING 訂閱時呼叫，
 * 讓殘留的 hosted checkout 連結失效，避免用戶回頭付到已作廢的訂閱。
 *
 * 純 best-effort：session 已過期 / 已完成 / 不存在皆視為無需處理，
 * 任何失敗都吞掉不拋，不得阻擋新結帳建立。
 */
export async function expireStripeCheckoutSession(params: {
  sessionId: string
}): Promise<void> {
  try {
    const stripe = await getDbKeyStripe()
    await stripe.checkout.sessions.expire(params.sessionId)
  } catch (error) {
    // 已過期 / 已完成 / 不存在 → 無需處理；其餘錯誤僅記錄不阻擋
    console.warn(
      '[stripe-billing] 作廢 Checkout Session best-effort 失敗（略過）:',
      params.sessionId,
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * maintenance 清理 stale PENDING 前的強一致檢查。
 * 只有 Stripe 明確為 open/expired 且 open 已成功 expire 時，才允許本地取消。
 */
export async function closeStripePendingCheckout(params: {
  sessionId: string
}): Promise<{ safeToCancel: boolean; paid: boolean; error?: string }> {
  try {
    const stripe = await getDbKeyStripe()
    const session = await stripe.checkout.sessions.retrieve(params.sessionId)
    if (session.payment_status === 'paid' || session.status === 'complete') {
      return { safeToCancel: false, paid: true }
    }
    if (session.status === 'expired') {
      return { safeToCancel: true, paid: false }
    }
    if (session.status !== 'open') {
      return {
        safeToCancel: false,
        paid: false,
        error: `未知 Stripe Checkout 狀態：${session.status ?? 'null'}`,
      }
    }
    await stripe.checkout.sessions.expire(params.sessionId)
    return { safeToCancel: true, paid: false }
  } catch (error) {
    return {
      safeToCancel: false,
      paid: false,
      error: error instanceof Error ? error.message : 'Stripe Checkout 查詢失敗',
    }
  }
}

/**
 * 取得某期 invoice 的 hosted_invoice_url（PAST_DUE 補繳連結、期款收據入口）。
 */
export async function getHostedInvoiceUrl(params: {
  invoiceId: string
}): Promise<string | null> {
  try {
    const stripe = await getDbKeyStripe()
    const invoice = await stripe.invoices.retrieve(params.invoiceId)
    return invoice.hosted_invoice_url ?? null
  } catch (error) {
    console.error('[stripe-billing] 取得 hosted_invoice_url 失敗:', error)
    return null
  }
}

/**
 * 驗證 provider Subscription 僅含一個符合方案快照的 recurring Price；動態
 * price_data 降級建立的 Price 在首次 webhook 時回綁，後續每期即可用 ID 驗證。
 */
export async function validateAndBindStripeSubscriptionPrice(params: {
  stripeSubscription: Stripe.Subscription
  local: {
    id: string
    gatewayPriceId: string | null
    pricePerPeriod: number
    interval: 'MONTH' | 'YEAR'
  }
}): Promise<boolean> {
  const items = params.stripeSubscription.items.data
  if (items.length !== 1) return false
  const item = items[0]
  if (!item || item.quantity !== 1) return false
  const expectedInterval = params.local.interval === 'YEAR' ? 'year' : 'month'
  if (
    item.price.currency !== 'twd' ||
    item.price.unit_amount !== params.local.pricePerPeriod * 100 ||
    item.price.recurring?.interval !== expectedInterval ||
    item.price.recurring?.interval_count !== 1
  ) {
    return false
  }
  if (params.local.gatewayPriceId) {
    return item.price.id === params.local.gatewayPriceId
  }

  await prisma.courseSubscription.updateMany({
    where: {
      id: params.local.id,
      gatewayPriceId: null,
      OR: [
        { gatewaySubscriptionId: null },
        { gatewaySubscriptionId: params.stripeSubscription.id },
      ],
    },
    data: { gatewayPriceId: item.price.id },
  })
  return true
}
