// lib/stripe.ts
// Stripe 金流工具函式

import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * 取得 Stripe client（延遲初始化，避免在沒有環境變數時報錯）
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    })
  }
  return _stripe
}

/**
 * 匯出 stripe proxy，使用方式與直接匯出 Stripe instance 相同
 * 但延遲到實際呼叫方法時才初始化
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripe()
    const value = Reflect.get(instance, prop, instance)
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})

/**
 * 檢查 Stripe 環境變數是否已正確設定
 */
export function isStripeConfigured(): boolean {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[Stripe] STRIPE_SECRET_KEY 未設定')
    return false
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET 未設定')
    return false
  }
  return true
}

// Re-export from shared（向下相容）
export { generateOrderNo } from '@/lib/payment/shared'

// ==================== Stripe Product/Price 管理 ====================

/**
 * Stripe expects amounts in the currency's minor unit.
 *
 * For TWD charges, Stripe supports two-decimal amounts (minor unit = 0.01),
 * so we convert NT$ dollars to cents by *100 when sending to Stripe.
 *
 * Reference: Stripe "Minor units in API amounts" (TWD special case).
 */
function toStripeTwdAmount(amountTwdDollars: number): number {
  return Math.round(amountTwdDollars * 100)
}

interface CourseForStripeSync {
  id: string
  title: string
  subtitle?: string | null
  coverImage?: string | null
  price: number
  salePrice: number | null
  stripeProductId?: string | null
  stripePriceId?: string | null
  stripeSalePriceId?: string | null
}

export interface StripeSyncResult {
  stripeProductId: string | null
  stripePriceId: string | null
  stripeSalePriceId: string | null
}

/**
 * 確保課程有對應的 Stripe Product
 * 若已有且有效則同步資訊，若無效或不存在則建立新的
 */
async function ensureStripeProduct(course: {
  id: string
  title: string
  subtitle?: string | null
  coverImage?: string | null
  stripeProductId?: string | null
}): Promise<string> {
  if (course.stripeProductId) {
    try {
      const existing = await stripe.products.retrieve(course.stripeProductId)
      if (!existing.deleted) {
        // 更新失敗不應觸發「重建 Product」；沿用既有 Product 仍可繼續建立 Price。
        try {
          await stripe.products.update(course.stripeProductId, {
            name: course.title,
            ...(course.subtitle ? { description: course.subtitle } : {}),
          })
        } catch (error) {
          console.warn(
            '[Stripe] 更新 Product 失敗（沿用既有 Product，不重建）:',
            course.stripeProductId,
            error
          )
        }
        return course.stripeProductId
      }
    } catch (error) {
      // 常見原因：prod_... 不存在、key 模式不一致（test vs live）、不同 Stripe 帳戶。
      console.warn(
        '[Stripe] Product 讀取失敗，將重新建立:',
        course.stripeProductId,
        error
      )
    }
  }

  const product = await stripe.products.create({
    name: course.title,
    ...(course.subtitle ? { description: course.subtitle } : {}),
    metadata: { courseId: course.id },
  })

  return product.id
}

/**
 * 歸檔舊的 Price（設為 inactive），失敗不影響主流程
 */
async function archiveOldPrices(
  priceIds: (string | null | undefined)[]
): Promise<void> {
  for (const priceId of priceIds) {
    if (!priceId) continue
    try {
      await stripe.prices.update(priceId, { active: false })
    } catch (error) {
      console.warn('[Stripe] 歸檔 Price 失敗（不影響主流程）:', priceId, error)
    }
  }
}

/**
 * 刪除課程時歸檔對應的 Stripe Product 與 Price（L56）。
 * best-effort：失敗只記錄、不影響課程刪除主流程。
 */
export async function archiveCourseStripeResources(course: {
  stripeProductId?: string | null
  stripePriceId?: string | null
  stripeSalePriceId?: string | null
}): Promise<void> {
  if (!isStripeConfigured()) return

  await archiveOldPrices([course.stripePriceId, course.stripeSalePriceId])

  if (course.stripeProductId) {
    try {
      await stripe.products.update(course.stripeProductId, { active: false })
    } catch (error) {
      console.warn('[Stripe] 歸檔 Product 失敗（不影響主流程）:', course.stripeProductId, error)
    }
  }
}

/**
 * 檢查價格是否與 Stripe 上的 Price 一致，避免不必要的重建
 */
async function hasPriceChanged(course: CourseForStripeSync): Promise<boolean> {
  try {
    // 原價需要 Price 但還沒有
    if (!course.stripePriceId && course.price > 0) return true

    // 促銷價需要 Price 但還沒有
    if (!course.stripeSalePriceId && course.salePrice !== null && course.salePrice > 0)
      return true

    // 促銷價已移除但還有舊的 Price ID
    if ((course.salePrice === null || course.salePrice === 0) && course.stripeSalePriceId)
      return true

    // 檢查原價是否一致
    if (course.stripePriceId) {
      const existing = await stripe.prices.retrieve(course.stripePriceId)
      if (existing.unit_amount !== toStripeTwdAmount(course.price)) return true
    }

    // 檢查促銷價是否一致
    if (course.salePrice !== null && course.salePrice > 0 && course.stripeSalePriceId) {
      const existing = await stripe.prices.retrieve(course.stripeSalePriceId)
      if (existing.unit_amount !== toStripeTwdAmount(course.salePrice)) return true
    }

    return false
  } catch {
    // 查詢失敗，安全起見重新建立
    return true
  }
}

/**
 * 同步建立 Stripe Price（原價 + 促銷價）
 * Stripe Price 是 immutable 的，每次價格變動都建立新的 Price
 */
async function syncStripePrices(params: {
  courseId: string
  stripeProductId: string
  price: number
  salePrice: number | null
  oldStripePriceId?: string | null
  oldStripeSalePriceId?: string | null
}): Promise<{ stripePriceId: string | null; stripeSalePriceId: string | null }> {
  const result: { stripePriceId: string | null; stripeSalePriceId: string | null } = {
    stripePriceId: null,
    stripeSalePriceId: null,
  }

  // 建立原價 Price（price > 0 時）
  if (params.price > 0) {
    const newPrice = await stripe.prices.create({
      product: params.stripeProductId,
      currency: 'twd',
      unit_amount: toStripeTwdAmount(params.price),
      nickname: `course:${params.courseId}:original`,
      metadata: {
        courseId: params.courseId,
        priceType: 'original',
      },
    })
    result.stripePriceId = newPrice.id
  }

  // 建立促銷價 Price（salePrice > 0 時）
  if (params.salePrice !== null && params.salePrice > 0) {
    const newSalePrice = await stripe.prices.create({
      product: params.stripeProductId,
      currency: 'twd',
      unit_amount: toStripeTwdAmount(params.salePrice),
      nickname: `course:${params.courseId}:sale`,
      metadata: {
        courseId: params.courseId,
        priceType: 'sale',
      },
    })
    result.stripeSalePriceId = newSalePrice.id
  }

  // 歸檔舊 Price（非阻塞）
  await archiveOldPrices([params.oldStripePriceId, params.oldStripeSalePriceId])

  return result
}

/**
 * 將課程資料同步到 Stripe（Product + Price）
 * 容錯策略：Stripe API 失敗不阻擋課程儲存
 */
export async function syncCourseToStripe(
  course: CourseForStripeSync
): Promise<StripeSyncResult> {
  const fallback: StripeSyncResult = {
    stripeProductId: course.stripeProductId ?? null,
    stripePriceId: course.stripePriceId ?? null,
    stripeSalePriceId: course.stripeSalePriceId ?? null,
  }

  if (!isStripeConfigured()) {
    return fallback
  }

  try {
    // 1. 確保 Product 存在
    const stripeProductId = await ensureStripeProduct(course)

    // 2. 檢查價格是否需要更新
    const priceChangedByAmount = await hasPriceChanged(course)
    // 若 Product 曾被重建/更換，舊 Price 可能仍存在但綁定舊 Product。
    // 為了容錯與一致性，這種情況強制重建 Price（並歸檔舊 Price）。
    const productChanged = stripeProductId !== (course.stripeProductId ?? null)
    const priceChanged = priceChangedByAmount || productChanged

    if (!priceChanged) {
      return {
        stripeProductId,
        stripePriceId: course.stripePriceId ?? null,
        stripeSalePriceId: course.stripeSalePriceId ?? null,
      }
    }

    // 3. 同步 Price
    const priceResult = await syncStripePrices({
      courseId: course.id,
      stripeProductId,
      price: course.price,
      salePrice: course.salePrice,
      oldStripePriceId: course.stripePriceId,
      oldStripeSalePriceId: course.stripeSalePriceId,
    })

    console.log('[Stripe] 課程同步完成:', {
      courseId: course.id,
      stripeProductId,
      ...priceResult,
    })

    return {
      stripeProductId,
      ...priceResult,
    }
  } catch (error) {
    console.error('[Stripe] 同步課程到 Stripe 失敗（不阻擋課程儲存）:', error)
    return fallback
  }
}
