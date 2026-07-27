// lib/actions/subscriptions.ts
// 前台「我的訂閱」Server Actions。
//
// getMySubscriptions：查當前用戶所有訂閱（逐狀態卡片資料 + 期款歷史），供 /my-subscriptions 渲染。
// cancelMySubscription：本人自助取消（先 gateway 後本地由 lib/subscription/service.ts 統一處理）。
// updateMySubscriptionInvoicePrefs：更新訂閱的電子發票偏好快照（適用未來期款）。

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isPurchaseActive } from '@/lib/purchase/is-active'
import { cancelSubscription } from '@/lib/subscription/service'
import { getHostedInvoiceUrl } from '@/lib/subscription/stripe-billing'
import { sendSubscriptionCanceled } from '@/lib/subscription/notifications'
import { getPublicSiteSettings } from '@/lib/site-settings-public'
import { checkoutInvoiceSchema } from '@/lib/validations/einvoice'
import type { CheckoutInvoiceInput } from '@/lib/validations/einvoice'
import type {
  SubscriptionStatus,
  SubscriptionPlanType,
  BillingInterval,
  TermEndBehavior,
  InvoiceType,
} from '@prisma/client'

/** 訂閱期款歷史單筆 */
export interface SubscriptionPeriodOrder {
  orderId: string
  orderNo: string
  periodNumber: number | null
  amount: number
  paidAt: Date | null
  createdAt: Date
  /** Stripe：該期 invoice 的 hosted 檢視連結（收據入口）；PAYUNi 為 null */
  invoiceUrl: string | null
}

/** 訂閱電子發票偏好（快照） */
export interface SubscriptionInvoicePrefs {
  invoiceType: InvoiceType | null
  carrierType: string | null
  carrierId: string | null
  taxId: string | null
  title: string | null
  loveCode: string | null
  address: string | null
}

/** /my-subscriptions 逐狀態卡片所需的完整資料 */
export interface MySubscription {
  id: string
  status: SubscriptionStatus
  gateway: string
  courseId: string
  courseTitle: string
  courseSlug: string
  courseCoverImage: string | null
  planLabel: string
  planType: SubscriptionPlanType
  interval: BillingInterval
  pricePerPeriod: number
  totalPeriods: number | null
  termEndBehavior: TermEndBehavior
  paidPeriods: number
  /** 下次扣款日（ACTIVE）；來源為 currentPeriodEnd（含寬限前的週期末） */
  nextBillingAt: Date | null
  /** 實際可觀看至（= Purchase.expiresAt，含寬限）；null 代表永久或尚未開通 */
  accessEndsAt: Date | null
  /** 課程權限目前是否有效（含寬限） */
  hasActiveAccess: boolean
  /** FIXED_TERM 期滿轉永久後為 true */
  isLifetimeGranted: boolean
  canceledAt: Date | null
  completedAt: Date | null
  attentionReason: string | null
  /** PAST_DUE 時的 Stripe 補繳連結（hosted_invoice_url） */
  pastDueInvoiceUrl: string | null
  /** 期款歷史（新到舊） */
  periodOrders: SubscriptionPeriodOrder[]
  /** 電子發票偏好快照 */
  invoicePrefs: SubscriptionInvoicePrefs
}

/** getMySubscriptions 結果（含站台聯絡信箱，供 PAYUNi 自救卡片顯示） */
export interface MySubscriptionsResult {
  subscriptions: MySubscription[]
  contactEmail: string
}

/**
 * 取得當前用戶所有訂閱（供 /my-subscriptions）。
 * 需登入；未登入回空清單（頁面層負責 redirect）。
 */
export async function getMySubscriptions(): Promise<MySubscriptionsResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { subscriptions: [], contactEmail: '' }
  }
  const userId = session.user.id

  const [subs, publicSettings] = await Promise.all([
    prisma.courseSubscription.findMany({
      where: {
        userId,
        // PENDING（尚未開通 / 已放棄結帳）不對用戶顯示
        status: { in: ['ACTIVE', 'PAST_DUE', 'CANCELED', 'COMPLETED'] },
      },
      include: {
        plan: { select: { label: true } },
        course: {
          select: { id: true, title: true, slug: true, coverImage: true },
        },
        orders: {
          where: { status: 'PAID' },
          select: {
            id: true,
            orderNo: true,
            periodNumber: true,
            amount: true,
            paidAt: true,
            createdAt: true,
            gatewayPeriodKey: true,
            gatewayInvoiceId: true,
            hostedInvoiceUrl: true,
          },
          orderBy: [{ periodNumber: 'desc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getPublicSiteSettings(),
  ])

  // 一次撈齊所有相關課程的 Purchase（判斷實際存取截止日與是否仍有效）
  const courseIds = Array.from(new Set(subs.map((s) => s.courseId)))
  const purchases = courseIds.length
    ? await prisma.purchase.findMany({
        where: { userId, courseId: { in: courseIds } },
        select: { courseId: true, expiresAt: true, revokedAt: true },
      })
    : []
  const purchaseByCourse = new Map(purchases.map((p) => [p.courseId, p]))

  const subscriptions: MySubscription[] = await Promise.all(
    subs.map(async (sub) => {
      const purchase = purchaseByCourse.get(sub.courseId) ?? null
      const hasActiveAccess = isPurchaseActive(purchase)
      const accessEndsAt = purchase?.revokedAt === null ? purchase.expiresAt : null
      const isLifetimeGranted =
        sub.status === 'COMPLETED' &&
        sub.termEndBehavior === 'GRANT_LIFETIME' &&
        purchase?.revokedAt === null &&
        purchase.expiresAt === null

      // Stripe PAST_DUE 補繳連結：以未付款當期 invoice 的 gatewayPeriodKey（invoice id）取 hosted url。
      // 續期失敗時若已建立該期 Order（記錄了 open invoice id），即可解析補繳連結；
      // 解析不到（stub 未實作 / 無 invoice id）一律回 null，卡片改顯示一般補繳指引 + 「取消並重新訂閱」。
      let pastDueInvoiceUrl: string | null = null
      if (sub.status === 'PAST_DUE' && sub.gateway === 'stripe') {
        pastDueInvoiceUrl = await resolvePastDueInvoiceUrl(sub.id)
      }

      const periodOrders: SubscriptionPeriodOrder[] = await Promise.all(
        sub.orders.map(async (o) => {
          let invoiceUrl: string | null = null
          if (sub.gateway === 'stripe') {
            invoiceUrl =
              o.hostedInvoiceUrl ??
              (o.gatewayInvoiceId
                ? await safeHostedInvoiceUrlByInvoiceId(o.gatewayInvoiceId)
                : null)
          }
          return {
            orderId: o.id,
            orderNo: o.orderNo,
            periodNumber: o.periodNumber,
            amount: o.amount,
            paidAt: o.paidAt,
            createdAt: o.createdAt,
            invoiceUrl,
          }
        })
      )

      return {
        id: sub.id,
        status: sub.status,
        gateway: sub.gateway,
        courseId: sub.courseId,
        courseTitle: sub.course.title,
        courseSlug: sub.course.slug,
        courseCoverImage: sub.course.coverImage,
        planLabel: sub.plan.label,
        planType: sub.planType,
        interval: sub.interval,
        pricePerPeriod: sub.pricePerPeriod,
        totalPeriods: sub.totalPeriods,
        termEndBehavior: sub.termEndBehavior,
        paidPeriods: sub.paidPeriods,
        nextBillingAt: sub.status === 'ACTIVE' ? sub.currentPeriodEnd : null,
        accessEndsAt,
        hasActiveAccess,
        isLifetimeGranted,
        canceledAt: sub.canceledAt,
        completedAt: sub.completedAt,
        attentionReason: sub.attentionReason,
        pastDueInvoiceUrl,
        periodOrders,
        invoicePrefs: {
          invoiceType: sub.invoiceType,
          carrierType: sub.invoiceCarrierType,
          carrierId: sub.invoiceCarrierId,
          taxId: sub.invoiceTaxId,
          title: sub.invoiceTitle,
          loveCode: sub.invoiceLoveCode,
          address: sub.invoiceAddress,
        },
      }
    })
  )

  return {
    subscriptions,
    contactEmail: publicSettings.contactEmail,
  }
}

/**
 * 取消當前用戶的訂閱（AC-56）。
 * - 本人驗證
 * - 僅 ACTIVE / PAST_DUE 可取消
 * - 委派 lib/subscription/service.ts 的 cancelSubscription（先 gateway 後本地）
 * - 取消確認信由本函式觸發（service 只做狀態機）
 */
export async function cancelMySubscription(subscriptionId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: '請先登入' }
    }
    const userId = session.user.id

    // 本人驗證：只查自己的訂閱
    const sub = await prisma.courseSubscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        userId: true,
        status: true,
        planType: true,
        courseId: true,
        course: { select: { title: true } },
        user: { select: { email: true, name: true } },
      },
    })
    if (!sub || sub.userId !== userId) {
      return { success: false, error: '找不到訂閱' }
    }
    if (sub.status !== 'ACTIVE' && sub.status !== 'PAST_DUE') {
      return { success: false, error: '此訂閱狀態無法取消' }
    }

    // 委派共用取消服務（先 gateway 後本地）
    const result = await cancelSubscription({
      subscriptionId,
      reason: 'user_request',
    })
    if (!result.success) {
      return { success: false, error: result.error || '取消失敗，請稍後再試' }
    }

    // 取消確認信：顯示實際存取截止日（含寬限）＝ Purchase.expiresAt
    const purchase = await prisma.purchase.findUnique({
      where: { userId_courseId: { userId, courseId: sub.courseId } },
      select: { expiresAt: true, revokedAt: true },
    })
    const accessEndsAt =
      purchase && purchase.revokedAt === null ? purchase.expiresAt : null

    // fire-and-forget，寄信失敗不影響取消結果
    void sendSubscriptionCanceled({
      subscriptionId: sub.id,
      toEmail: sub.user.email,
      userName: sub.user.name,
      courseTitle: sub.course.title,
      accessEndsAt,
      isFixedTerm: sub.planType === 'FIXED_TERM',
    })

    revalidatePath('/my-subscriptions')
    revalidatePath('/my-courses')

    return { success: true }
  } catch (error) {
    console.error('取消訂閱失敗:', error)
    return { success: false, error: '取消訂閱時發生錯誤' }
  }
}

/**
 * 更新訂閱電子發票偏好（AC-55；適用未來期款）。
 * - 本人驗證
 * - checkoutInvoiceSchema 驗證（複用結帳頁邏輯）
 * - 更新訂閱快照欄位（不動已開立的過往發票）
 */
export async function updateMySubscriptionInvoicePrefs(
  subscriptionId: string,
  input: CheckoutInvoiceInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: '請先登入' }
    }
    const userId = session.user.id

    // 本人驗證
    const sub = await prisma.courseSubscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, userId: true, status: true },
    })
    if (!sub || sub.userId !== userId) {
      return { success: false, error: '找不到訂閱' }
    }

    // 複用結帳頁發票驗證
    const parsed = checkoutInvoiceSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || '發票資訊有誤',
      }
    }
    const invoice = parsed.data
    const nz = (v?: string | null) => (v && v.length > 0 ? v : null)

    await prisma.courseSubscription.update({
      where: { id: subscriptionId },
      data: {
        invoiceType: invoice.invoiceType,
        invoiceCarrierType: nz(invoice.carrierType),
        invoiceCarrierId: nz(invoice.carrierId),
        invoiceTaxId: nz(invoice.taxId),
        invoiceTitle: nz(invoice.title),
        invoiceLoveCode: nz(invoice.loveCode),
        invoiceAddress: nz(invoice.address),
      },
    })

    revalidatePath('/my-subscriptions')
    return { success: true }
  } catch (error) {
    console.error('更新發票偏好失敗:', error)
    return { success: false, error: '更新發票資訊時發生錯誤' }
  }
}

/**
 * 安全取得 Stripe 某期 invoice 的 hosted 檢視連結（供期款歷史收據入口）。
 * stripe-billing 為契約 stub（未實作會 throw）；此處全數容錯回 null，
 * 不讓 stub 未實作阻斷整個「我的訂閱」頁面渲染。
 */
async function safeHostedInvoiceUrlByInvoiceId(
  invoiceId: string
): Promise<string | null> {
  try {
    return await getHostedInvoiceUrl({ invoiceId })
  } catch {
    return null
  }
}

/**
 * 解析 PAST_DUE 訂閱的 Stripe 補繳連結。
 * 續期失敗時（invoice.payment_failed）該期的 open invoice 若已落地為未付款 Order，
 * 其 gatewayPeriodKey 即為 invoice id，可用來取 hosted_invoice_url 補繳。
 * 取不到（尚未建 Order / stub 未實作）一律回 null，卡片改顯示一般補繳指引。
 */
async function resolvePastDueInvoiceUrl(
  subscriptionId: string
): Promise<string | null> {
  const openOrder = await prisma.order.findFirst({
    where: {
      subscriptionId,
      status: { in: ['PENDING', 'FAILED'] },
      gatewayInvoiceId: { not: null },
    },
    orderBy: [{ periodNumber: 'desc' }, { createdAt: 'desc' }],
    select: { gatewayInvoiceId: true, hostedInvoiceUrl: true },
  })
  if (!openOrder?.gatewayInvoiceId) return null
  return (
    openOrder.hostedInvoiceUrl ??
    safeHostedInvoiceUrlByInvoiceId(openOrder.gatewayInvoiceId)
  )
}
