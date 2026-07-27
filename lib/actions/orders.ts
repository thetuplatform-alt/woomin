// lib/actions/orders.ts
// 訂單管理 Server Actions
// 提供訂單查詢、退款、統計、匯出等功能

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, requireOnlyAdminAuth } from '@/lib/require-admin'
import { canManageCourse, getManageableCourseIds, isFullAdmin } from '@/lib/course-permissions'
import {
  orderSearchSchema,
  refundSchema,
  exportCsvSchema,
  type OrderSearchInput,
  type RefundData,
  type ExportCsvData,
} from '@/lib/validations/order'
import type { OrderStatus, PaymentMethod, InvoiceStatus, Prisma } from '@prisma/client'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import type { PaymentGatewayType } from '@/lib/payment/types'
import { cancelSubscription } from '@/lib/subscription/service'
import {
  finalizeOrderRefund,
  markOrderRefundFailed,
} from '@/lib/subscription/refund-reconciliation'
import { processOrderInvoiceOutbox } from '@/lib/subscription/outbox'

/**
 * 訂單資料（含用戶和課程資訊）
 */
export interface OrderWithDetails {
  id: string
  orderNo: string
  userId: string
  courseId: string | null
  bundleId: string | null
  amount: number
  originalAmount: number
  couponId: string | null
  couponDiscount: number | null
  status: OrderStatus
  /** 所屬訂閱（買斷訂單為 null）；用於訂單列表/詳情標記「訂閱・第 N 期」 */
  subscriptionId: string | null
  /** 期別編號（首期 = 1；異常期款可能為 null） */
  periodNumber: number | null
  paymentMethod: PaymentMethod | null
  paymentGateway: string | null
  stripeSessionId: string | null
  stripePaymentIntentId: string | null
  stripeResponse: Prisma.JsonValue | null
  paidAt: Date | null
  refundedAt: Date | null
  refundReason: string | null
  refundStatus: string | null
  refundError: string | null
  refundRequestedAt: Date | null
  refundCompletedAt: Date | null
  gatewayRefundId: string | null
  disputeStatus: string | null
  gatewayDisputeId: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
  course: {
    id: string
    title: string
    coverImage: string | null
  } | null
  bundle: {
    id: string
    title: string
    coverImage: string | null
  } | null
  coupon: {
    code: string
    name: string
  } | null
  invoice: {
    id: string
    status: InvoiceStatus
    provider: string
    invoiceNumber: string | null
    invoiceDate: Date | null
    amount: number
    allowanceNumber: string | null
    allowanceAmount: number | null
    allowanceTotal: number
    allowancePendingNumber: string | null
    allowancePendingAmount: number | null
    allowancePendingExpiresAt: Date | null
    operationType: string | null
    voidedAt: Date | null
    failReason: string | null
  } | null
}

/**
 * 臺灣電子發票於訂單查詢時要 select 的欄位（列表與詳情共用）
 */
const INVOICE_SELECT = {
  id: true,
  status: true,
  provider: true,
  invoiceNumber: true,
  invoiceDate: true,
  amount: true,
  allowanceNumber: true,
  allowanceAmount: true,
  allowanceTotal: true,
  allowancePendingNumber: true,
  allowancePendingAmount: true,
  allowancePendingExpiresAt: true,
  operationType: true,
  voidedAt: true,
  failReason: true,
} as const

/**
 * 訂單列表回傳結果
 */
export interface GetOrdersResult {
  orders: OrderWithDetails[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 訂單統計
 */
export interface OrderStats {
  totalOrders: number
  totalRevenue: number
  paidOrders: number
  pendingOrders: number
  refundedOrders: number
  failedOrders: number
}

// requireAdminAuth 從 @/lib/require-admin 引入（直接查 DB 確保角色即時生效）

/**
 * 記錄管理員操作日誌
 */
async function logAdminAction(
  adminId: string,
  action: 'PROCESS_REFUND',
  targetId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType: 'Order',
        targetId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    })
  } catch (error) {
    console.error('記錄操作日誌失敗:', error)
  }
}

function isPayuniOfflinePaymentMethod(method: PaymentMethod | null): boolean {
  return method === 'ATM' || method === 'CVS'
}

async function createPayuniManualRefundTodo(params: {
  adminId: string
  order: {
    id: string
    orderNo: string
    amount: number
    subscriptionId: string | null
    refundStatus: string | null
    paymentMethod: PaymentMethod | null
  }
  reason: string
  isAnomalousPeriod: boolean
  refundError?: string
}): Promise<{
  success: true
  requiresManualAction: true
  warning: string
}> {
  const { adminId, order, reason, isAnomalousPeriod, refundError } = params
  let warningExtra: string | undefined

  const pending = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: 'PAID',
      OR: [
        { refundStatus: null },
        { refundStatus: { in: ['PROCESSING', 'PENDING_MANUAL', 'FAILED'] } },
      ],
    },
    data: {
      refundStatus: 'PENDING_MANUAL',
      refundRequestedAt: new Date(),
      refundReason: isAnomalousPeriod
        ? 'ANOMALOUS_SUBSCRIPTION_PERIOD'
        : reason,
      refundError: refundError ? refundError.slice(0, 1000) : null,
    },
  })
  if (pending.count === 0 && order.refundStatus !== 'PENDING_MANUAL') {
    return {
      success: true,
      requiresManualAction: true,
      warning: '此訂單已有退款流程進行中，請重新整理後確認狀態。',
    }
  }

  if (order.subscriptionId && !isAnomalousPeriod) {
    const canceled = await cancelSubscription({
      subscriptionId: order.subscriptionId,
      reason: 'refund_pending_manual',
    })
    if (!canceled.success) warningExtra = canceled.error
  }

  const offlineNote = isPayuniOfflinePaymentMethod(order.paymentMethod)
    ? '這筆是 ATM/CVS 離線繳費，需走 PAYUNi 後台人工退款。'
    : 'PAYUNi 自動退款未完成，已改走人工確認流程。'
  const warning = `已建立 PAYUNi 人工退款待辦。${offlineNote}請先在 PAYUNi 後台全額退款 NT$${order.amount}，再回到本頁勾選「已完成全額退款」確認；確認前訂單仍維持已付款。${refundError ? ` 原因：${refundError}` : ''}${warningExtra ? ` 自動停止續扣尚待重試：${warningExtra}` : ''}`

  await logAdminAction(adminId, 'PROCESS_REFUND', order.id, {
    orderNo: order.orderNo,
    gateway: 'payuni',
    status: 'PENDING_MANUAL',
    subscriptionId: order.subscriptionId,
    refundError,
  })
  revalidatePath(`/admin/orders/${order.id}`)

  return {
    success: true,
    requiresManualAction: true,
    warning,
  }
}

/**
 * 取得訂單列表
 */
export async function getOrders(
  params: OrderSearchInput = {}
): Promise<GetOrdersResult> {
  const actor = await requireAdminAuth()

  // 驗證參數
  const validatedParams = orderSearchSchema.parse(params)
  const {
    search,
    status,
    paymentMethod,
    startDate,
    endDate,
    page,
    pageSize,
  } = validatedParams

  // 建立查詢條件
  const where: Prisma.OrderWhereInput = {}

  // 講師僅能看到自己可管理課程的訂單（ADMIN 回傳 null 表示不限制）
  // bundle 訂單（courseId 為 null）因此自動被排除，僅 ADMIN 可見
  const manageableCourseIds = await getManageableCourseIds(actor)
  if (manageableCourseIds !== null) {
    where.courseId = { in: manageableCourseIds }
  }

  // 搜尋訂單編號、Stripe ID、學員 Email、課程名稱
  if (search) {
    const [matchingUsers, matchingCourses] = await Promise.all([
      prisma.user.findMany({
        where: { email: { contains: search, mode: 'insensitive' } },
        select: { id: true },
      }),
      prisma.course.findMany({
        where: { title: { contains: search, mode: 'insensitive' } },
        select: { id: true },
      }),
    ])

    where.OR = [
      { orderNo: { contains: search, mode: 'insensitive' } },
      { stripeSessionId: { contains: search, mode: 'insensitive' } },
      ...(matchingUsers.length > 0
        ? [{ userId: { in: matchingUsers.map((u) => u.id) } }]
        : []),
      ...(matchingCourses.length > 0
        ? [{ courseId: { in: matchingCourses.map((c) => c.id) } }]
        : []),
    ]
  }

  // 狀態篩選
  if (status) {
    where.status = status
  }

  // 付款方式篩選
  if (paymentMethod) {
    where.paymentMethod = paymentMethod
  }

  // 日期範圍篩選
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) {
      where.createdAt.gte = new Date(startDate)
    }
    if (endDate) {
      // 設定為該日的結束時間
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }

  // 查詢總數
  const total = await prisma.order.count({ where })

  // 查詢訂單列表
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { invoice: { select: INVOICE_SELECT } },
  })

  // 取得用戶、課程、優惠券資訊
  const userIds = [...new Set(orders.map((o) => o.userId))]
  const courseIds = [
    ...new Set(orders.map((o) => o.courseId).filter((id): id is string => !!id)),
  ]
  const bundleIds = [
    ...new Set(orders.map((o) => o.bundleId).filter((id): id is string => !!id)),
  ]
  const couponIds = [...new Set(orders.map((o) => o.couponId).filter(Boolean))] as string[]

  const [users, courses, bundles, coupons] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    }),
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true, coverImage: true },
    }),
    bundleIds.length > 0
      ? prisma.bundle.findMany({
          where: { id: { in: bundleIds } },
          select: { id: true, title: true, coverImage: true },
        })
      : [],
    couponIds.length > 0
      ? prisma.coupon.findMany({
          where: { id: { in: couponIds } },
          select: { id: true, code: true, name: true },
        })
      : [],
  ])

  const userMap = new Map(users.map((u) => [u.id, u]))
  const courseMap = new Map(courses.map((c) => [c.id, c]))
  const bundleMap = new Map(bundles.map((b) => [b.id, b]))
  const couponMap = new Map(coupons.map((c) => [c.id, c]))

  // 組合結果
  const ordersWithDetails: OrderWithDetails[] = orders.map((order) => ({
    ...order,
    user: userMap.get(order.userId) || null,
    course: order.courseId ? courseMap.get(order.courseId) || null : null,
    bundle: order.bundleId ? bundleMap.get(order.bundleId) || null : null,
    coupon: order.couponId ? couponMap.get(order.couponId) || null : null,
  }))

  return {
    orders: ordersWithDetails,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * 取得單一訂單詳情
 */
export async function getOrderById(id: string): Promise<OrderWithDetails | null> {
  const actor = await requireAdminAuth()

  const order = await prisma.order.findUnique({
    where: { id },
    include: { invoice: { select: INVOICE_SELECT } },
  })

  if (!order) {
    return null
  }

  // 講師僅能檢視自己可管理課程的訂單；bundle 訂單僅 ADMIN 可見
  if (!isFullAdmin(actor.role)) {
    if (!order.courseId || !(await canManageCourse(actor, order.courseId))) {
      return null
    }
  }

  // 取得用戶、課程、優惠券資訊
  const [user, course, bundle, coupon] = await Promise.all([
    prisma.user.findUnique({
      where: { id: order.userId },
      select: { id: true, name: true, email: true, image: true },
    }),
    order.courseId
      ? prisma.course.findUnique({
          where: { id: order.courseId },
          select: { id: true, title: true, coverImage: true },
        })
      : null,
    order.bundleId
      ? prisma.bundle.findUnique({
          where: { id: order.bundleId },
          select: { id: true, title: true, coverImage: true },
        })
      : null,
    order.couponId
      ? prisma.coupon.findUnique({
          where: { id: order.couponId },
          select: { code: true, name: true },
        })
      : null,
  ])

  return {
    ...order,
    user,
    course,
    bundle,
    coupon,
  }
}

/**
 * 將退款狀態回滾為 PAID（金流退款失敗時使用）。
 * 僅在仍為 REFUNDED 時回滾，避免覆蓋其他狀態。
 */
/**
 * 標記訂單為已退款
 *
 * 修正重點：
 * - H8：退款屬不可逆金流操作，僅限 ADMIN（requireOnlyAdminAuth）。
 * - M11：以條件式 updateMany 原子搶鎖（PAID→REFUNDED），杜絕競態 / 雙擊重複退款；
 *        金流退款失敗時回滾狀態；Stripe / Shopline 退款帶冪等鍵。
 * - H2：退款成功後自動沖銷電子發票（作廢 / 折讓），失敗只告警不回滾退款。
 * - M10：退款時回補優惠券名額（timesRedeemed）與兌換紀錄（CouponRedemption）。
 * - H3：PAYUNi 先嘗試 trade/query + trade/close/trade/cancel；失敗或 ATM/CVS 才降級人工退款。
 */
export async function markAsRefunded(
  data: RefundData
): Promise<{
  success: boolean
  error?: string
  requiresManualAction?: boolean
  refundPending?: boolean
  warning?: string
}> {
  try {
    const currentUser = await requireOnlyAdminAuth()

    // 驗證資料
    const validatedData = refundSchema.parse(data)

    // 查詢訂單
    const order = await prisma.order.findUnique({
      where: { id: validatedData.orderId },
    })

    if (!order) {
      return { success: false, error: '訂單不存在' }
    }

    // 檢查訂單狀態。PAYUNi 人工退款待確認時 Order 仍保持 PAID，避免帳務說謊。
    if (order.status !== 'PAID') {
      return { success: false, error: '只有已付款的訂單可以退款' }
    }

    const gatewayType = (order.paymentGateway as PaymentGatewayType) || 'stripe'
    const isPayUni = gatewayType === 'payuni'
    const isAnomalousPeriod =
      order.refundReason === 'ANOMALOUS_SUBSCRIPTION_PERIOD'
    const manualConfirmed = validatedData.manualRefundConfirmed === true
    let warningExtra: string | undefined

    if (isPayUni && !manualConfirmed && isPayuniOfflinePaymentMethod(order.paymentMethod)) {
      return createPayuniManualRefundTodo({
        adminId: currentUser.id as string,
        order,
        reason: validatedData.reason,
        isAnomalousPeriod,
      })
    }

    // 原子 claim 只鎖 refund workflow，不提前改變實際付款狀態。
    const claim = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: 'PAID',
        ...(isPayUni
          ? {
              OR: [
                { refundStatus: null },
                { refundStatus: { in: ['PENDING_MANUAL', 'FAILED'] } },
              ],
            }
          : { OR: [{ refundStatus: null }, { refundStatus: 'FAILED' }] }),
      },
      data: {
        refundStatus: 'PROCESSING',
        refundRequestedAt: order.refundRequestedAt ?? new Date(),
        refundReason: isAnomalousPeriod
          ? 'ANOMALOUS_SUBSCRIPTION_PERIOD'
          : validatedData.reason,
        refundError: null,
      },
    })
    if (claim.count === 0) {
      return { success: false, error: '此訂單已有退款流程進行中，請重新整理' }
    }

    let gatewayRefundId: string | null = null
    let providerRefundPending = false
    if (!isPayUni || !manualConfirmed) {
      try {
        const gateway = await getGatewayByType(gatewayType)
        const maybePayuniGatewayPaymentId = (
          order as typeof order & { gatewayPaymentId?: string | null }
        ).gatewayPaymentId
        const gatewayPaymentId =
          isPayUni && order.subscriptionId
            ? maybePayuniGatewayPaymentId ?? order.stripePaymentIntentId
            : order.stripePaymentIntentId
        const refundResult = await gateway.processRefund({
          gatewayPaymentId,
          orderNo: order.orderNo,
        })
        if (!refundResult.success) {
          if (isPayUni) {
            return createPayuniManualRefundTodo({
              adminId: currentUser.id as string,
              order,
              reason: validatedData.reason,
              isAnomalousPeriod,
              refundError: refundResult.error || 'PAYUNi 退款失敗',
            })
          }
          await markOrderRefundFailed(order.id, refundResult.error || '金流退款失敗')
          return { success: false, error: refundResult.error || '金流退款失敗' }
        }
        gatewayRefundId = refundResult.gatewayRefundId ?? null
        providerRefundPending = refundResult.pending === true
      } catch (refundError) {
        console.error('金流退款失敗:', refundError)
        const message =
          refundError instanceof Error ? refundError.message : '未知錯誤'
        if (isPayUni) {
          return createPayuniManualRefundTodo({
            adminId: currentUser.id as string,
            order,
            reason: validatedData.reason,
            isAnomalousPeriod,
            refundError: message,
          })
        }
        await markOrderRefundFailed(order.id, message)
        return { success: false, error: `退款失敗: ${message}` }
      }
    }

    if (providerRefundPending) {
      await prisma.order.update({
        where: { id: order.id },
        data: { gatewayRefundId },
      })
      if (order.subscriptionId && !isAnomalousPeriod) {
        const canceled = await cancelSubscription({
          subscriptionId: order.subscriptionId,
          reason: 'refund_processing',
        })
        if (!canceled.success) warningExtra = canceled.error
      }
      revalidatePath('/admin/orders')
      revalidatePath(`/admin/orders/${order.id}`)
      return {
        success: true,
        refundPending: true,
        warning: `Stripe 已接受退款，目前仍在處理中；系統會在退款 webhook 到達後撤權與沖銷發票。${warningExtra ? ` 停止續扣尚待重試：${warningExtra}` : ''}`,
      }
    }

    await finalizeOrderRefund({
      orderId: order.id,
      reason: validatedData.reason,
      gatewayRefundId,
      terminateSubscription: !isAnomalousPeriod,
    })

    // AC-62 / PRD §4.8：訂閱期款退款 → 取消整筆訂閱（先 gateway 後本地，
    // gateway 取消失敗會寫 pendingGatewayCancelAt 由 maintenance 重試）。
    // 訂閱已在終態（CANCELED / COMPLETED）時無未來扣款可停，視為非致命，僅記警示。
    if (order.subscriptionId && !isAnomalousPeriod) {
      try {
        const cancelResult = await cancelSubscription({
          subscriptionId: order.subscriptionId,
          reason: 'refund',
        })
        if (!cancelResult.success) {
          const note = `退款已完成，但自動取消訂閱未成功（${cancelResult.error ?? '訂閱可能已為終態'}），請至訂閱管理確認`
          warningExtra = note
        }
      } catch (e) {
        console.error('退款後取消訂閱失敗:', e)
        warningExtra = '退款已完成，但自動取消訂閱發生例外，請至訂閱管理手動確認並取消'
      }
    }

    // H2：退款後自動沖銷電子發票（作廢 / 折讓）。失敗不回滾退款，但需告警提示人工處理。
    let warning: string | undefined
    let invoiceNote: string | undefined
    try {
      const inv = await processOrderInvoiceOutbox(
        validatedData.orderId,
        'SYNC_INVOICE_REFUND'
      )
      if (!inv.success) {
        warning = `電子發票自動沖銷尚未完成，已排入重試（${inv.error ?? '未知錯誤'}）`
      } else {
        invoiceNote = '已自動沖銷電子發票'
      }
    } catch (e) {
      console.error('電子發票自動沖銷例外:', e)
      warning = '電子發票自動沖銷發生例外，請至發票後台手動處理'
    }

    // 訂閱取消提示（AC-62）
    if (warningExtra) {
      warning = warning ? `${warningExtra}；${warning}` : warningExtra
    }

    // 記錄操作日誌
    await logAdminAction(
      currentUser.id as string,
      'PROCESS_REFUND',
      validatedData.orderId,
      {
        orderNo: order.orderNo,
        amount: order.amount,
        reason: validatedData.reason,
        gateway: gatewayType,
        requiresManualAction: false,
        invoiceSync: invoiceNote ?? warning ?? '無發票需沖銷',
        ...(order.subscriptionId
          ? {
              subscriptionId: order.subscriptionId,
              periodNumber: order.periodNumber,
            }
          : {}),
      }
    )

    // 重新驗證頁面快取
    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${validatedData.orderId}`)
    if (order.subscriptionId) {
      revalidatePath('/admin/subscriptions')
      revalidatePath(`/admin/subscriptions/${order.subscriptionId}`)
    }

    return { success: true, requiresManualAction: false, warning }
  } catch (error) {
    console.error('標記退款失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '處理退款時發生錯誤' }
  }
}

/**
 * 取得訂單統計
 */
export async function getOrderStats(): Promise<OrderStats> {
  const actor = await requireAdminAuth()

  // 講師統計僅涵蓋自己可管理課程的訂單（ADMIN 回 null 表示全站）
  const manageableCourseIds = await getManageableCourseIds(actor)
  const scope: Prisma.OrderWhereInput =
    manageableCourseIds !== null ? { courseId: { in: manageableCourseIds } } : {}

  // 並行查詢各項統計
  const [
    totalOrders,
    paidOrders,
    pendingOrders,
    refundedOrders,
    failedOrders,
    revenueResult,
  ] = await Promise.all([
    prisma.order.count({ where: scope }),
    prisma.order.count({ where: { ...scope, status: 'PAID' } }),
    prisma.order.count({ where: { ...scope, status: 'PENDING' } }),
    prisma.order.count({ where: { ...scope, status: 'REFUNDED' } }),
    prisma.order.count({ where: { ...scope, status: 'FAILED' } }),
    prisma.order.aggregate({
      where: { ...scope, status: 'PAID' },
      _sum: { amount: true },
    }),
  ])

  return {
    totalOrders,
    totalRevenue: revenueResult._sum.amount || 0,
    paidOrders,
    pendingOrders,
    refundedOrders,
    failedOrders,
  }
}

/**
 * 匯出訂單 CSV
 */
export async function exportOrdersCsv(
  params: ExportCsvData = {}
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const actor = await requireAdminAuth()

    // 驗證參數
    const validatedParams = exportCsvSchema.parse(params)
    const { search, status, paymentMethod, startDate, endDate } = validatedParams

    // 建立查詢條件
    const where: Prisma.OrderWhereInput = {}

    // 講師僅能匯出自己可管理課程的訂單；bundle 訂單僅 ADMIN 可匯出
    const manageableCourseIds = await getManageableCourseIds(actor)
    if (manageableCourseIds !== null) {
      where.courseId = { in: manageableCourseIds }
    }

    if (search) {
      const [matchingUsers, matchingCourses] = await Promise.all([
        prisma.user.findMany({
          where: { email: { contains: search, mode: 'insensitive' } },
          select: { id: true },
        }),
        prisma.course.findMany({
          where: { title: { contains: search, mode: 'insensitive' } },
          select: { id: true },
        }),
      ])

      where.OR = [
        { orderNo: { contains: search, mode: 'insensitive' } },
        { stripeSessionId: { contains: search, mode: 'insensitive' } },
        ...(matchingUsers.length > 0
          ? [{ userId: { in: matchingUsers.map((u) => u.id) } }]
          : []),
        ...(matchingCourses.length > 0
          ? [{ courseId: { in: matchingCourses.map((c) => c.id) } }]
          : []),
      ]
    }

    if (status) {
      where.status = status
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // 查詢訂單
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 取得用戶和課程資訊
    const userIds = [...new Set(orders.map((o) => o.userId))]
    const courseIds = [
      ...new Set(orders.map((o) => o.courseId).filter((id): id is string => !!id)),
    ]

    const [users, courses] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      }),
      prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true },
      }),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const courseMap = new Map(courses.map((c) => [c.id, c]))

    // 狀態對應
    const statusMap: Record<OrderStatus, string> = {
      PENDING: '待付款',
      PAID: '已付款',
      FAILED: '付款失敗',
      REFUNDED: '已退款',
      CANCELLED: '已取消',
    }

    // 付款方式對應
    const paymentMethodMap: Record<PaymentMethod, string> = {
      CREDIT_CARD: '信用卡',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      ATM: 'ATM 轉帳',
      CVS: '超商代碼',
    }

    // 產生 CSV 內容
    const headers = [
      '訂單編號',
      '學員姓名',
      '學員 Email',
      '課程名稱',
      '原價',
      '實付金額',
      '付款方式',
      '狀態',
      'Stripe Session ID',
      'Stripe Payment Intent ID',
      '建立時間',
      '付款時間',
      '退款時間',
      '退款原因',
    ]

    const rows = orders.map((order) => {
      const user = userMap.get(order.userId)
      const course = order.courseId ? courseMap.get(order.courseId) : null

      return [
        order.orderNo,
        user?.name || '未知',
        user?.email || '未知',
        course?.title || '未知',
        order.originalAmount.toString(),
        order.amount.toString(),
        order.paymentMethod ? paymentMethodMap[order.paymentMethod] : '未知',
        statusMap[order.status],
        order.stripeSessionId || '',
        order.stripePaymentIntentId || '',
        order.createdAt.toISOString(),
        order.paidAt?.toISOString() || '',
        order.refundedAt?.toISOString() || '',
        order.refundReason || '',
      ]
    })

    // 組合 CSV（加入 BOM 以支援 Excel 中文）
    const BOM = '\uFEFF'
    const csv =
      BOM +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n')

    return { success: true, data: csv }
  } catch (error) {
    console.error('匯出 CSV 失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '匯出 CSV 時發生錯誤' }
  }
}
