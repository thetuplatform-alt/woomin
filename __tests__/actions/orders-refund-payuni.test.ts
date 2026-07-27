import { markAsRefunded } from '@/lib/actions/orders'
import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { cancelSubscription } from '@/lib/subscription/service'
import { finalizeOrderRefund } from '@/lib/subscription/refund-reconciliation'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    adminLog: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/require-admin', () => ({
  requireAdminAuth: jest.fn(),
  requireOnlyAdminAuth: jest.fn(),
}))

jest.mock('@/lib/course-permissions', () => ({
  canManageCourse: jest.fn(),
  getManageableCourseIds: jest.fn(),
  isFullAdmin: jest.fn(),
}))

jest.mock('@/lib/payment/gateway-factory', () => ({
  getGatewayByType: jest.fn(),
}))

jest.mock('@/lib/subscription/service', () => ({
  cancelSubscription: jest.fn(),
}))

jest.mock('@/lib/subscription/refund-reconciliation', () => ({
  finalizeOrderRefund: jest.fn(),
  markOrderRefundFailed: jest.fn(),
}))

jest.mock('@/lib/subscription/outbox', () => ({
  processOrderInvoiceOutbox: jest.fn().mockResolvedValue({ success: true }),
}))

const mockedPrisma = prisma as unknown as {
  order: {
    findUnique: jest.Mock
    updateMany: jest.Mock
    update: jest.Mock
  }
  adminLog: { create: jest.Mock }
}
const mockedRequireOnlyAdminAuth = requireOnlyAdminAuth as jest.Mock
const mockedGetGatewayByType = getGatewayByType as jest.Mock
const mockedCancelSubscription = cancelSubscription as jest.Mock
const mockedFinalizeOrderRefund = finalizeOrderRefund as jest.Mock

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    orderNo: 'ORD-001',
    userId: 'user_1',
    courseId: 'course_1',
    bundleId: null,
    amount: 1234,
    status: 'PAID',
    paymentGateway: 'payuni',
    paymentMethod: 'CREDIT_CARD',
    stripePaymentIntentId: 'trade_single_123',
    gatewayPaymentId: null,
    subscriptionId: null,
    periodNumber: null,
    refundStatus: null,
    refundRequestedAt: null,
    refundReason: null,
    ...overrides,
  }
}

describe('markAsRefunded：PAYUNi 一鍵退款', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireOnlyAdminAuth.mockResolvedValue({ id: 'admin_1' })
    mockedPrisma.order.updateMany.mockResolvedValue({ count: 1 })
    mockedPrisma.adminLog.create.mockResolvedValue({})
    mockedCancelSubscription.mockResolvedValue({ success: true })
    mockedFinalizeOrderRefund.mockResolvedValue({
      changed: true,
      subscriptionId: null,
    })
  })

  it('單次刷卡 PAYUNi 訂單會用 stripePaymentIntentId 當 TradeNo 呼叫退款 API，成功後直接完成退款', async () => {
    const processRefund = jest.fn().mockResolvedValue({ success: true })
    mockedPrisma.order.findUnique.mockResolvedValue(buildOrder())
    mockedGetGatewayByType.mockResolvedValue({ processRefund })

    const result = await markAsRefunded({
      orderId: 'order_1',
      reason: '客戶申請退款',
      manualRefundConfirmed: false,
    })

    expect(result.success).toBe(true)
    expect(result.requiresManualAction).toBe(false)
    expect(mockedGetGatewayByType).toHaveBeenCalledWith('payuni')
    expect(processRefund).toHaveBeenCalledWith({
      gatewayPaymentId: 'trade_single_123',
      orderNo: 'ORD-001',
    })
    expect(mockedFinalizeOrderRefund).toHaveBeenCalledWith({
      orderId: 'order_1',
      reason: '客戶申請退款',
      gatewayRefundId: null,
      terminateSubscription: true,
    })
  })

  it('訂閱期款 PAYUNi 訂單會用 gatewayPaymentId 當 TradeNo 呼叫退款 API', async () => {
    const processRefund = jest.fn().mockResolvedValue({ success: true })
    mockedPrisma.order.findUnique.mockResolvedValue(
      buildOrder({
        subscriptionId: 'sub_1',
        periodNumber: 2,
        stripePaymentIntentId: 'unused_single_field',
        gatewayPaymentId: 'trade_period_456',
      })
    )
    mockedGetGatewayByType.mockResolvedValue({ processRefund })
    mockedFinalizeOrderRefund.mockResolvedValue({
      changed: true,
      subscriptionId: 'sub_1',
    })

    const result = await markAsRefunded({
      orderId: 'order_1',
      reason: '客戶申請退款',
      manualRefundConfirmed: false,
    })

    expect(result.success).toBe(true)
    expect(processRefund).toHaveBeenCalledWith({
      gatewayPaymentId: 'trade_period_456',
      orderNo: 'ORD-001',
    })
  })

  it('PAYUNi API 退款失敗時降級為 PENDING_MANUAL，不會標成 REFUNDED', async () => {
    const processRefund = jest.fn().mockResolvedValue({
      success: false,
      error: 'PAYUNi 退款失敗',
    })
    mockedPrisma.order.findUnique.mockResolvedValue(buildOrder())
    mockedGetGatewayByType.mockResolvedValue({ processRefund })

    const result = await markAsRefunded({
      orderId: 'order_1',
      reason: '客戶申請退款',
      manualRefundConfirmed: false,
    })

    expect(result.success).toBe(true)
    expect(result.requiresManualAction).toBe(true)
    expect(result.warning).toContain('PAYUNi 人工退款待辦')
    expect(processRefund).toHaveBeenCalled()
    expect(mockedPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'order_1', status: 'PAID' }),
        data: expect.objectContaining({
          refundStatus: 'PENDING_MANUAL',
          refundError: 'PAYUNi 退款失敗',
        }),
      })
    )
    expect(mockedFinalizeOrderRefund).not.toHaveBeenCalled()
  })

  it('PAYUNi API 拋出例外時降級為 PENDING_MANUAL，不會標成 REFUNDED', async () => {
    const processRefund = jest.fn().mockRejectedValue(new Error('PAYUNi API 連線逾時'))
    mockedPrisma.order.findUnique.mockResolvedValue(buildOrder())
    mockedGetGatewayByType.mockResolvedValue({ processRefund })

    const result = await markAsRefunded({
      orderId: 'order_1',
      reason: '客戶申請退款',
      manualRefundConfirmed: false,
    })

    expect(result.success).toBe(true)
    expect(result.requiresManualAction).toBe(true)
    expect(result.warning).toContain('PAYUNi 人工退款待辦')
    expect(mockedFinalizeOrderRefund).not.toHaveBeenCalled()
  })

  it.each(['ATM', 'CVS'])('%s 訂單不呼叫 PAYUNi 退款 API，維持人工流程', async (paymentMethod) => {
    const processRefund = jest.fn().mockResolvedValue({ success: true })
    mockedPrisma.order.findUnique.mockResolvedValue(buildOrder({ paymentMethod }))
    mockedGetGatewayByType.mockResolvedValue({ processRefund })

    const result = await markAsRefunded({
      orderId: 'order_1',
      reason: '客戶申請退款',
      manualRefundConfirmed: false,
    })

    expect(result.success).toBe(true)
    expect(result.requiresManualAction).toBe(true)
    expect(mockedGetGatewayByType).not.toHaveBeenCalled()
    expect(processRefund).not.toHaveBeenCalled()
    expect(mockedPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundStatus: 'PENDING_MANUAL' }),
      })
    )
    expect(mockedFinalizeOrderRefund).not.toHaveBeenCalled()
  })

  it('PENDING_MANUAL 且已勾選人工退款時，保留原本人工確認路徑並完成退款', async () => {
    mockedPrisma.order.findUnique.mockResolvedValue(
      buildOrder({ refundStatus: 'PENDING_MANUAL' })
    )

    const result = await markAsRefunded({
      orderId: 'order_1',
      reason: '已人工退款',
      manualRefundConfirmed: true,
    })

    expect(result.success).toBe(true)
    expect(mockedGetGatewayByType).not.toHaveBeenCalled()
    expect(mockedFinalizeOrderRefund).toHaveBeenCalledWith({
      orderId: 'order_1',
      reason: '已人工退款',
      gatewayRefundId: null,
      terminateSubscription: true,
    })
  })
})
