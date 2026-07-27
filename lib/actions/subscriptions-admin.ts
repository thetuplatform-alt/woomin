// lib/actions/subscriptions-admin.ts
// 後台訂閱管理 Server Actions（/admin/subscriptions）。
//
// 職責：
// - 統計卡（活躍數、MRR、PAST_DUE 數）（AC-59）
// - 列表查詢（狀態 / 課程篩選、分頁、attentionReason 標示）（AC-59）
// - 詳情查詢（訂戶、方案快照、期款 Order 歷史、consent、gateway 識別碼）（AC-59）
// - 代學員取消（AC-60，AdminLog CANCEL_SUBSCRIPTION）
// - PAYUNi PAST_DUE 重新扣款 reauth
// - 發票偏好編輯 + AdminLog
// - 排程心跳逾時 / Stripe webhook 失聯偵測告警（AC-64）
//
// 全部 requireOnlyAdminAuth（僅 ADMIN）；統一回傳 { success, error?, data? }。

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { checkoutInvoiceSchema } from '@/lib/validations/einvoice'
import { cancelSubscription } from '@/lib/subscription/service'
import { reauthPayuniPeriod } from '@/lib/subscription/payuni-period'
import {
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_HEARTBEAT_SETTING_KEY,
  SUBSCRIPTION_HEARTBEAT_STALE_HOURS,
} from '@/lib/subscription/constants'
import type {
  SubscriptionStatus,
  Prisma,
  InvoiceType,
} from '@prisma/client'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 列表 / 詳情共用：附上實際可觀看至日期（currentPeriodEnd + 寬限）。
 */
function accessEndsAt(currentPeriodEnd: Date | null): Date | null {
  if (!currentPeriodEnd) return null
  return new Date(currentPeriodEnd.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS)
}

// ============================================================
// 統計卡（AC-59）
// ============================================================

export interface SubscriptionStats {
  /** 活躍訂閱數（ACTIVE） */
  activeCount: number
  /** MRR：活躍訂閱依 interval 折月加總（年繳 /12） */
  mrr: number
  /** 扣款失敗 / 寬限中（PAST_DUE） */
  pastDueCount: number
}

/**
 * 取得訂閱統計。
 * MRR 定義：所有 ACTIVE 訂閱的每期金額折算為「每月」後加總
 *   - MONTH：pricePerPeriod
 *   - YEAR：pricePerPeriod / 12（四捨五入到元）
 */
export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  await requireOnlyAdminAuth()

  const [activeCount, pastDueCount, activeSubs] = await Promise.all([
    prisma.courseSubscription.count({ where: { status: 'ACTIVE' } }),
    prisma.courseSubscription.count({ where: { status: 'PAST_DUE' } }),
    prisma.courseSubscription.findMany({
      where: { status: 'ACTIVE' },
      select: { interval: true, pricePerPeriod: true },
    }),
  ])

  const mrr = activeSubs.reduce((sum, sub) => {
    const monthly =
      sub.interval === 'YEAR'
        ? Math.round(sub.pricePerPeriod / 12)
        : sub.pricePerPeriod
    return sum + monthly
  }, 0)

  return { activeCount, mrr, pastDueCount }
}

// ============================================================
// 列表（AC-59）
// ============================================================

export interface SubscriptionListItem {
  id: string
  status: SubscriptionStatus
  gateway: string
  planType: 'UNLIMITED' | 'FIXED_TERM'
  interval: 'MONTH' | 'YEAR'
  pricePerPeriod: number
  paidPeriods: number
  totalPeriods: number | null
  currentPeriodEnd: Date | null
  accessEndsAt: Date | null
  attentionReason: string | null
  createdAt: Date
  user: { id: string; name: string | null; email: string } | null
  course: { id: string; title: string } | null
  planLabel: string | null
}

export interface GetSubscriptionsResult {
  subscriptions: SubscriptionListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface GetSubscriptionsParams {
  status?: SubscriptionStatus
  courseId?: string
  page?: number
  pageSize?: number
}

export async function getSubscriptions(
  params: GetSubscriptionsParams = {}
): Promise<GetSubscriptionsResult> {
  await requireOnlyAdminAuth()

  const page = params.page && params.page > 0 ? params.page : 1
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 20

  const where: Prisma.CourseSubscriptionWhereInput = {}
  if (params.status) where.status = params.status
  if (params.courseId) where.courseId = params.courseId

  const [total, subs] = await Promise.all([
    prisma.courseSubscription.count({ where }),
    prisma.courseSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
        plan: { select: { label: true } },
      },
    }),
  ])

  const subscriptions: SubscriptionListItem[] = subs.map((sub) => ({
    id: sub.id,
    status: sub.status,
    gateway: sub.gateway,
    planType: sub.planType,
    interval: sub.interval,
    pricePerPeriod: sub.pricePerPeriod,
    paidPeriods: sub.paidPeriods,
    totalPeriods: sub.totalPeriods,
    currentPeriodEnd: sub.currentPeriodEnd,
    accessEndsAt: accessEndsAt(sub.currentPeriodEnd),
    attentionReason: sub.attentionReason,
    createdAt: sub.createdAt,
    user: sub.user,
    course: sub.course,
    planLabel: sub.plan?.label ?? null,
  }))

  return {
    subscriptions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/** 課程篩選下拉用：有訂閱方案或有訂閱紀錄的課程 */
export async function getSubscriptionCourseOptions(): Promise<
  Array<{ id: string; title: string }>
> {
  await requireOnlyAdminAuth()

  const courses = await prisma.course.findMany({
    where: {
      OR: [
        { subscriptionPlans: { some: {} } },
        { subscriptions: { some: {} } },
      ],
    },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  })
  return courses
}

// ============================================================
// 詳情（AC-59）
// ============================================================

export interface SubscriptionPeriodOrder {
  id: string
  orderNo: string
  periodNumber: number | null
  amount: number
  status: string
  paidAt: Date | null
  createdAt: Date
  gatewayPeriodKey: string | null
  hasInvoice: boolean
}

export interface SubscriptionDetail {
  id: string
  status: SubscriptionStatus
  gateway: string
  gatewaySubscriptionId: string | null
  gatewayTradeNo: string | null
  planType: 'UNLIMITED' | 'FIXED_TERM'
  interval: 'MONTH' | 'YEAR'
  pricePerPeriod: number
  totalPeriods: number | null
  termEndBehavior: 'GRANT_LIFETIME' | 'END_ACCESS'
  paidPeriods: number
  currentPeriodEnd: Date | null
  accessEndsAt: Date | null
  lastPaymentAt: Date | null
  canceledAt: Date | null
  cancelReason: string | null
  completedAt: Date | null
  attentionReason: string | null
  pendingGatewayCancelAt: Date | null
  consentAt: Date | null
  consentTextVersion: string | null
  createdAt: Date
  user: { id: string; name: string | null; email: string } | null
  course: { id: string; title: string } | null
  planLabel: string | null
  /** 電子發票偏好快照（可編輯） */
  invoice: {
    invoiceType: InvoiceType | null
    carrierType: string | null
    carrierId: string | null
    taxId: string | null
    title: string | null
    loveCode: string | null
    address: string | null
  }
  periodOrders: SubscriptionPeriodOrder[]
}

export async function getSubscriptionById(
  id: string
): Promise<SubscriptionDetail | null> {
  await requireOnlyAdminAuth()

  const sub = await prisma.courseSubscription.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
      plan: { select: { label: true } },
      orders: {
        orderBy: [{ periodNumber: 'asc' }, { createdAt: 'asc' }],
        include: { invoice: { select: { id: true } } },
      },
    },
  })

  if (!sub) return null

  return {
    id: sub.id,
    status: sub.status,
    gateway: sub.gateway,
    gatewaySubscriptionId: sub.gatewaySubscriptionId,
    gatewayTradeNo: sub.gatewayTradeNo,
    planType: sub.planType,
    interval: sub.interval,
    pricePerPeriod: sub.pricePerPeriod,
    totalPeriods: sub.totalPeriods,
    termEndBehavior: sub.termEndBehavior,
    paidPeriods: sub.paidPeriods,
    currentPeriodEnd: sub.currentPeriodEnd,
    accessEndsAt: accessEndsAt(sub.currentPeriodEnd),
    lastPaymentAt: sub.lastPaymentAt,
    canceledAt: sub.canceledAt,
    cancelReason: sub.cancelReason,
    completedAt: sub.completedAt,
    attentionReason: sub.attentionReason,
    pendingGatewayCancelAt: sub.pendingGatewayCancelAt,
    consentAt: sub.consentAt,
    consentTextVersion: sub.consentTextVersion,
    createdAt: sub.createdAt,
    user: sub.user,
    course: sub.course,
    planLabel: sub.plan?.label ?? null,
    invoice: {
      invoiceType: sub.invoiceType,
      carrierType: sub.invoiceCarrierType,
      carrierId: sub.invoiceCarrierId,
      taxId: sub.invoiceTaxId,
      title: sub.invoiceTitle,
      loveCode: sub.invoiceLoveCode,
      address: sub.invoiceAddress,
    },
    periodOrders: sub.orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      periodNumber: o.periodNumber,
      amount: o.amount,
      status: o.status,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      gatewayPeriodKey: o.gatewayPeriodKey,
      hasInvoice: !!o.invoice,
    })),
  }
}

// ============================================================
// 代取消（AC-60）
// ============================================================

/**
 * 後台代學員取消訂閱（同前台取消語意，PRD §4.7）。
 * 先 gateway 後本地（service.cancelSubscription），成功後記 AdminLog CANCEL_SUBSCRIPTION。
 */
export async function adminCancelSubscription(
  subscriptionId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireOnlyAdminAuth()

    const sub = await prisma.courseSubscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, courseId: true, userId: true },
    })
    if (!sub) {
      return { success: false, error: '找不到訂閱' }
    }

    const result = await cancelSubscription({
      subscriptionId,
      reason: reason?.trim() ? `admin:${reason.trim()}` : 'admin_request',
    })
    if (!result.success) {
      return { success: false, error: result.error ?? '取消失敗' }
    }

    await logSubscriptionAction(admin.id, subscriptionId, {
      action: 'CANCEL_SUBSCRIPTION',
      reason: reason?.trim() || undefined,
      courseId: sub.courseId,
      userId: sub.userId,
    })

    revalidatePath('/admin/subscriptions')
    revalidatePath(`/admin/subscriptions/${subscriptionId}`)
    return { success: true }
  } catch (error) {
    console.error('後台取消訂閱失敗:', error)
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '取消訂閱時發生錯誤' }
  }
}

// ============================================================
// PAYUNi 重新扣款（reauth）
// ============================================================

/**
 * 對 PAYUNi PAST_DUE 訂閱的失敗期重新授權補扣（mdfStatus reauth）。
 * 僅呼叫 gateway；扣款成功後由 period Notify 回來走正常入帳路徑（不在此改本地狀態）。
 */
export async function reauthSubscription(
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireOnlyAdminAuth()

    const sub = await prisma.courseSubscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        gateway: true,
        status: true,
        gatewaySubscriptionId: true,
        paidPeriods: true,
        gatewayTradeNo: true,
        lastFailedPeriodNumber: true,
        lastFailedPeriodKey: true,
        cancelRequestedAt: true,
      },
    })
    if (!sub) return { success: false, error: '找不到訂閱' }
    if (sub.gateway !== 'payuni') {
      return { success: false, error: '重新扣款僅適用 PAYUNi 訂閱' }
    }
    if (sub.status !== 'PAST_DUE') {
      return { success: false, error: '僅扣款失敗（PAST_DUE）的訂閱可重新扣款' }
    }
    if (sub.cancelRequestedAt) {
      return {
        success: false,
        error: '此訂閱已提出取消／退款，禁止重新扣款',
      }
    }
    if (!sub.gatewaySubscriptionId) {
      return { success: false, error: '缺少 PAYUNi 交易編號，無法重新扣款' }
    }

    // 必須使用 Notify 持久化的真正失敗期別；不可用 paidPeriods + 1 猜測，
    // 否則中間缺期、後一期成功時會對已付款期重複扣款。
    const failedPeriod = sub.lastFailedPeriodNumber
    if (!failedPeriod) {
      return {
        success: false,
        error: '找不到可重新授權的失敗期別，請先執行 PAYUNi 訂單對帳',
      }
    }

    const result = await reauthPayuniPeriod({
      periodTradeNo: sub.gatewaySubscriptionId,
      periodNumber: failedPeriod,
    })
    if (!result.success) {
      return { success: false, error: result.error ?? '重新扣款失敗' }
    }

    await logSubscriptionAction(admin.id, subscriptionId, {
      action: 'REAUTH_SUBSCRIPTION',
      periodNumber: failedPeriod,
      periodOrderNo: sub.lastFailedPeriodKey,
    })

    revalidatePath(`/admin/subscriptions/${subscriptionId}`)
    return { success: true }
  } catch (error) {
    console.error('重新扣款失敗:', error)
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '重新扣款時發生錯誤' }
  }
}

// ============================================================
// 發票偏好編輯
// ============================================================

/**
 * 編輯訂閱的電子發票偏好快照（適用未來期款）。
 * 複用 checkoutInvoiceSchema 驗證；記 AdminLog。
 */
export async function updateSubscriptionInvoicePreference(
  subscriptionId: string,
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireOnlyAdminAuth()

    const sub = await prisma.courseSubscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true },
    })
    if (!sub) return { success: false, error: '找不到訂閱' }

    const data = checkoutInvoiceSchema.parse(input)
    const nz = (v?: string | null) => (v && v.length > 0 ? v : null)

    await prisma.courseSubscription.update({
      where: { id: subscriptionId },
      data: {
        invoiceType: data.invoiceType,
        invoiceCarrierType: nz(data.carrierType),
        invoiceCarrierId: nz(data.carrierId),
        invoiceTaxId: nz(data.taxId),
        invoiceTitle: nz(data.title),
        invoiceLoveCode: nz(data.loveCode),
        invoiceAddress: nz(data.address),
      },
    })

    await logSubscriptionAction(admin.id, subscriptionId, {
      action: 'UPDATE_SUBSCRIPTION_INVOICE',
      invoiceType: data.invoiceType,
    })

    revalidatePath(`/admin/subscriptions/${subscriptionId}`)
    return { success: true }
  } catch (error) {
    console.error('更新訂閱發票偏好失敗:', error)
    // Zod 錯誤取第一則訊息
    if (
      typeof error === 'object' &&
      error !== null &&
      'issues' in error &&
      Array.isArray((error as { issues: unknown[] }).issues)
    ) {
      const issues = (error as { issues: Array<{ message?: string }> }).issues
      return { success: false, error: issues[0]?.message ?? '發票資訊格式有誤' }
    }
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '更新發票資訊時發生錯誤' }
  }
}

// ============================================================
// 維運告警（AC-64）
// ============================================================

export interface SubscriptionOpsAlerts {
  /** 排程心跳逾 48h（或從未執行）→ 排程未運作 */
  heartbeatStale: boolean
  /** 最近一次心跳時間（null 表示從未執行） */
  lastHeartbeatAt: Date | null
  /** 存在 ACTIVE Stripe 訂閱且已過一個週期無新 invoice.paid → webhook 疑似失聯 */
  stripeWebhookStale: boolean
  /** 疑似 webhook 失聯的 Stripe 訂閱數 */
  stripeWebhookStaleCount: number
}

/**
 * 後台維運告警偵測。
 *
 * 1) 心跳：讀 SUBSCRIPTION_HEARTBEAT_SETTING_KEY，逾 48h 或缺失 → heartbeatStale
 * 2) Stripe webhook 失聯：存在 ACTIVE 的 stripe 訂閱，且 currentPeriodEnd + 寬限已過
 *    （代表早該有下一期 invoice.paid 展期卻沒有）→ 疑似 webhook 未設定 / 失聯
 */
export async function getSubscriptionOpsAlerts(): Promise<SubscriptionOpsAlerts> {
  await requireOnlyAdminAuth()

  const now = Date.now()

  // 1) 心跳（直接讀 SiteSetting，避免 getSettingByKey 對非敏感 key 的多餘處理）
  const heartbeat = await prisma.siteSetting.findUnique({
    where: { key: SUBSCRIPTION_HEARTBEAT_SETTING_KEY },
    select: { value: true },
  })
  let lastHeartbeatAt: Date | null = null
  if (heartbeat?.value) {
    const parsed = new Date(heartbeat.value)
    if (!Number.isNaN(parsed.getTime())) lastHeartbeatAt = parsed
  }
  const heartbeatStale =
    !lastHeartbeatAt ||
    now - lastHeartbeatAt.getTime() >
      SUBSCRIPTION_HEARTBEAT_STALE_HOURS * 60 * 60 * 1000

  // 2) Stripe webhook 失聯：ACTIVE stripe 訂閱，且 currentPeriodEnd + 寬限已過仍未展期
  const graceCutoff = new Date(now - SUBSCRIPTION_GRACE_DAYS * DAY_MS)
  const stripeWebhookStaleCount = await prisma.courseSubscription.count({
    where: {
      status: 'ACTIVE',
      gateway: 'stripe',
      currentPeriodEnd: { not: null, lt: graceCutoff },
    },
  })

  return {
    heartbeatStale,
    lastHeartbeatAt,
    stripeWebhookStale: stripeWebhookStaleCount > 0,
    stripeWebhookStaleCount,
  }
}

// ============================================================
// AdminLog
// ============================================================

/**
 * 記錄訂閱後台操作到 AdminLog。
 * 取消用 CANCEL_SUBSCRIPTION enum；其餘（reauth / 發票編輯）以 UPDATE_SETTINGS 記錄
 * （AdminAction enum 未含這些細分值，避免 migration；細節放 details JSON）。
 */
async function logSubscriptionAction(
  adminId: string,
  subscriptionId: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const action = details.action === 'CANCEL_SUBSCRIPTION'
      ? 'CANCEL_SUBSCRIPTION'
      : 'UPDATE_SETTINGS'
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType: 'CourseSubscription',
        targetId: subscriptionId,
        details: JSON.parse(JSON.stringify(details)),
      },
    })
  } catch (error) {
    console.error('記錄訂閱操作日誌失敗:', error)
  }
}
