import { prisma } from '@/lib/prisma'
import { enqueueOrderInvoiceOutbox } from './outbox'
import { reconcileRefundedOrderAccess } from '@/lib/purchase/refund-access'

export async function finalizeOrderRefund(params: {
  orderId: string
  reason: string
  gatewayRefundId?: string | null
  /** 異常晚到扣款只退該筆，不得終止原本已完成／已取消的合法訂閱權限。 */
  terminateSubscription?: boolean
}): Promise<{ changed: boolean; subscriptionId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: params.orderId } })
    if (!order) throw new Error('退款訂單不存在')
    if (order.status === 'REFUNDED' && order.refundStatus === 'COMPLETED') {
      await enqueueOrderInvoiceOutbox(tx, {
        orderId: order.id,
        subscriptionId: order.subscriptionId,
        eventType: 'SYNC_INVOICE_REFUND',
        reason: order.refundReason ?? params.reason,
      })
      return { changed: false, subscriptionId: order.subscriptionId }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'REFUNDED',
        refundStatus: 'COMPLETED',
        refundedAt: new Date(),
        refundCompletedAt: new Date(),
        refundReason:
          order.refundReason === 'ANOMALOUS_SUBSCRIPTION_PERIOD'
            ? order.refundReason
            : params.reason,
        refundError: null,
        gatewayRefundId: params.gatewayRefundId ?? order.gatewayRefundId,
      },
    })

    if (
      params.terminateSubscription !== false &&
      order.subscriptionId &&
      order.courseId
    ) {
      await tx.courseSubscription.updateMany({
        where: {
          id: order.subscriptionId,
          status: { in: ['PENDING', 'ACTIVE', 'PAST_DUE'] },
        },
        data: {
          cancelRequestedAt: new Date(),
          cancelReason: 'refund',
          pendingGatewayCancelAt: new Date(),
        },
      })
      // 只撤銷仍由訂閱提供的 entitlement；不得撤銷後來的買斷／人工／bundle 授權。
      await tx.purchase.updateMany({
        where: {
          userId: order.userId,
          courseId: order.courseId,
          source: 'SUBSCRIPTION',
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      })
    } else {
      // 本站客製：多課程（bundle）訂單退款時，若同一門課仍有其他有效訂單支撐權限，
      // 只把 Purchase 接回該有效訂單，不整批撤銷；沒有才真正撤銷。
      // 對應本站舊有邏輯 lib/actions/orders.ts 的 reconcileRefundedOrderAccess，
      // v1.8.0 官方版本此處原為不分課程來源的 `updateMany({ where: { orderId } })`
      // 整批撤銷，會誤傷「同一門課由另一張有效訂單支撐權限」的情境，故改為呼叫此函式。
      await reconcileRefundedOrderAccess({
        tx,
        order: {
          id: order.id,
          userId: order.userId,
          courseId: order.courseId,
          bundleId: order.bundleId,
        },
        now: new Date(),
      })
    }

    if (order.couponId) {
      const deleted = await tx.couponRedemption.deleteMany({
        where: { orderId: order.id },
      })
      if (deleted.count > 0) {
        await tx.coupon.updateMany({
          where: { id: order.couponId, timesRedeemed: { gt: 0 } },
          data: { timesRedeemed: { decrement: 1 } },
        })
      }
    }

    // 和 REFUNDED 狀態同一交易持久化，不論 webhook / process 何時中斷都能重試。
    await enqueueOrderInvoiceOutbox(tx, {
      orderId: order.id,
      subscriptionId: order.subscriptionId,
      eventType: 'SYNC_INVOICE_REFUND',
      reason: params.reason,
    })

    return { changed: true, subscriptionId: order.subscriptionId }
  })
}

export async function markOrderRefundFailed(
  orderId: string,
  message: string
): Promise<void> {
  await prisma.order.updateMany({
    where: { id: orderId, refundStatus: 'PROCESSING' },
    data: {
      refundStatus: 'FAILED',
      refundError: message.slice(0, 1000),
    },
  })
}

export async function markOrderDispute(params: {
  paymentIntentId: string
  status: 'NEEDS_RESPONSE' | 'WON' | 'LOST' | 'CLOSED'
  disputeId: string
}): Promise<{ orderId: string; subscriptionId: string | null } | null> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { stripePaymentIntentId: params.paymentIntentId },
      orderBy: { paidAt: 'desc' },
    })
    if (!order) return null

    await tx.order.update({
      where: { id: order.id },
      data: {
        disputeStatus: params.status,
        disputedAt: params.status === 'NEEDS_RESPONSE' ? new Date() : order.disputedAt,
        gatewayDisputeId: params.disputeId,
      },
    })

    if (params.status === 'NEEDS_RESPONSE' && order.subscriptionId && order.courseId) {
      await tx.courseSubscription.updateMany({
        where: {
          id: order.subscriptionId,
          status: { in: ['PENDING', 'ACTIVE', 'PAST_DUE'] },
        },
        data: {
          cancelRequestedAt: new Date(),
          cancelReason: 'payment_dispute',
          pendingGatewayCancelAt: new Date(),
          attentionReason: 'PAYMENT_DISPUTE',
        },
      })
      await tx.purchase.updateMany({
        where: {
          userId: order.userId,
          courseId: order.courseId,
          source: 'SUBSCRIPTION',
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      })
    }

    return { orderId: order.id, subscriptionId: order.subscriptionId }
  })
}
