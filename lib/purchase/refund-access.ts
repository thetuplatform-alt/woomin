// lib/purchase/refund-access.ts
// 退款時重新整理課程授權，避免組合包退款誤收仍由其他訂單支撐的課程權限

import type { Prisma, PrismaClient } from '@prisma/client'
import { computeExpiresAt } from './compute-expires-at'

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface RefundedOrder {
  id: string
  userId: string
  courseId: string | null
  bundleId: string | null
}

interface ReconcileRefundedOrderAccessParams {
  tx: TxClient | Prisma.TransactionClient
  order: RefundedOrder
  now?: Date
}

interface PaidOrderCandidate {
  id: string
  courseId: string | null
  bundleId: string | null
  paidAt: Date | null
  createdAt: Date
}

const PAID_ORDER_SELECT = {
  id: true,
  courseId: true,
  bundleId: true,
  paidAt: true,
  createdAt: true,
} as const

async function getProductCourseIdsForOrder(
  tx: TxClient | Prisma.TransactionClient,
  order: RefundedOrder
): Promise<string[]> {
  if (order.courseId) {
    return [order.courseId]
  }

  if (!order.bundleId) {
    return []
  }

  const bundle = await tx.bundle.findUnique({
    where: { id: order.bundleId },
    select: {
      courses: {
        select: { courseId: true },
      },
    },
  })

  return bundle?.courses.map((item) => item.courseId) ?? []
}

async function getCourseIdsForRefund(
  tx: TxClient | Prisma.TransactionClient,
  order: RefundedOrder
): Promise<string[]> {
  const [productCourseIds, linkedPurchases] = await Promise.all([
    getProductCourseIdsForOrder(tx, order),
    tx.purchase.findMany({
      where: {
        orderId: order.id,
        revokedAt: null,
      },
      select: { courseId: true },
    }),
  ])

  return [
    ...new Set([
      ...productCourseIds,
      ...linkedPurchases.map((purchase) => purchase.courseId),
    ]),
  ]
}

async function findActiveFallbackOrderForCourse(
  tx: TxClient | Prisma.TransactionClient,
  params: {
    userId: string
    courseId: string
    excludedOrderId: string
    now: Date
  }
): Promise<{
  order: PaidOrderCandidate
  source: 'PAID' | 'BUNDLE'
  bundleId: string | null
  expiresAt: Date | null
} | null> {
  const course = await tx.course.findUnique({
    where: { id: params.courseId },
    select: {
      accessType: true,
      accessDurationDays: true,
      accessExpiresAt: true,
    },
  })

  if (!course) {
    return null
  }

  const [directOrders, bundleOrders] = await Promise.all([
    tx.order.findMany({
      where: {
        id: { not: params.excludedOrderId },
        userId: params.userId,
        status: 'PAID',
        paidAt: { not: null },
        courseId: params.courseId,
      },
      select: PAID_ORDER_SELECT,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    }),
    tx.order.findMany({
      where: {
        id: { not: params.excludedOrderId },
        userId: params.userId,
        status: 'PAID',
        paidAt: { not: null },
        bundle: {
          is: {
            courses: {
              some: { courseId: params.courseId },
            },
          },
        },
      },
      select: PAID_ORDER_SELECT,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    }),
  ])

  const candidates = [...directOrders, ...bundleOrders]
    .filter((order, index, orders) => orders.findIndex((item) => item.id === order.id) === index)
    .sort((a, b) => {
      const aTime = (a.paidAt ?? a.createdAt).getTime()
      const bTime = (b.paidAt ?? b.createdAt).getTime()
      return bTime - aTime
    })

  for (const order of candidates) {
    const expiresAt = computeExpiresAt(course, order.paidAt ?? order.createdAt)
    if (expiresAt && expiresAt <= params.now) {
      continue
    }

    return {
      order,
      source: order.bundleId ? 'BUNDLE' : 'PAID',
      bundleId: order.bundleId ?? null,
      expiresAt,
    }
  }

  return null
}

export async function reconcileRefundedOrderAccess({
  tx,
  order,
  now = new Date(),
}: ReconcileRefundedOrderAccessParams): Promise<void> {
  const courseIds = await getCourseIdsForRefund(tx, order)

  for (const courseId of courseIds) {
    const fallback = await findActiveFallbackOrderForCourse(tx, {
      userId: order.userId,
      courseId,
      excludedOrderId: order.id,
      now,
    })

    if (fallback) {
      await tx.purchase.updateMany({
        where: {
          userId: order.userId,
          courseId,
          orderId: order.id,
          revokedAt: null,
        },
        data: {
          orderId: fallback.order.id,
          source: fallback.source,
          bundleId: fallback.bundleId,
          expiresAt: fallback.expiresAt,
          revokedAt: null,
        },
      })
      continue
    }

    await tx.purchase.updateMany({
      where: {
        userId: order.userId,
        courseId,
        orderId: order.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    })
  }
}
