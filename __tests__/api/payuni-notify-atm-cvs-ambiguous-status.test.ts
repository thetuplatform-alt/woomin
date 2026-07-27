// __tests__/api/payuni-notify-atm-cvs-ambiguous-status.test.ts
//
// 對應 docs/audits/payment-invoice-audit-2026-06-22.md #3（CRITICAL）：
// 「PayUni ATM/CVS 取號通知靠猜測欄位反推狀態，失敗時待繳訂單被誤標
// FAILED → 真實付款被冪等吞掉（收錢不開通不開發票）」。
//
// app/api/payment/notify/route.ts 的邏輯：
//   isSuccess = service.isTradeSuccess(status)   // status === 'SUCCESS' 才算成功
//   若 !isSuccess，嘗試 extractPayUniPaymentInstructions() 解析 ATM/CVS 取號資訊；
//   解析成功 → 保留 PENDING（M24 修法）。
//   解析失敗（extractPayUniPaymentInstructions 回傳 instructions:null，例如
//   PAYUNi 實際欄位名稱與程式猜測的不同）→ 目前程式碼會直接落到
//   `newStatus = isSuccess ? 'PAID' : 'FAILED'`，把訂單標記為 FAILED。
//
// 這是危險的：往後同一張訂單真正的 SUCCESS 通知送達時，
// `if (order.status !== 'PENDING') return OK` 這條冪等防線會把它當「已處理過」
// 直接略過 —— 於是「已經收到錢，但訂單永久卡在 FAILED，不開課、不開發票」。
//
// 修法方向（與 Fish 確認）：無法確認的模糊狀態，保守保留 PENDING，
// 不要輕易標記為 FAILED —— 寧可訂單卡 PENDING 等人工介入，
// 也不能讓已經到帳的錢被冪等防線吞掉。

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { PayUniGateway } from '@/lib/payment/payuni-gateway'
import { extractPayUniPaymentInstructions } from '@/lib/payment/payment-instructions'
import { enqueueOrderInvoiceOutbox } from '@/lib/subscription/outbox'
import { grantPaidOrderAccess } from '@/lib/payment/post-payment-actions'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/payment/gateway-factory', () => ({
  getGatewayByType: jest.fn(),
}))

jest.mock('@/lib/payment/payuni-gateway', () => {
  class PayUniGateway {
    getService() {
      return undefined
    }
  }
  return { PayUniGateway }
})

jest.mock('@/lib/payment/payment-instructions', () => ({
  extractPayUniPaymentInstructions: jest.fn(),
}))

jest.mock('@/lib/subscription/outbox', () => ({
  enqueueOrderInvoiceOutbox: jest.fn(),
  processOrderInvoiceOutbox: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock('@/lib/payment/post-payment-actions', () => ({
  grantPaidOrderAccess: jest.fn(),
  executePostPaymentActions: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/payment/coupon-redemption', () => ({
  recordCouponRedemption: jest.fn(),
}))

const mockedPrisma = prisma as unknown as {
  order: { findUnique: jest.Mock; updateMany: jest.Mock }
  $transaction: jest.Mock
}
const mockedGetGatewayByType = getGatewayByType as jest.Mock
const mockedExtractInstructions = extractPayUniPaymentInstructions as jest.Mock

function buildFormRequest(fields: Record<string, string>): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value)
  }
  return { formData: async () => form } as unknown as NextRequest
}

describe('POST /api/payment/notify：PayUni 狀態不明（非 SUCCESS 且解不出 ATM/CVS 取號資訊）', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockedPrisma))
    mockedPrisma.order.updateMany.mockResolvedValue({ count: 1 })
  })

  it('訂單不應被標記為 FAILED —— 應保留 PENDING 等待後續真正的付款結果', async () => {
    const decrypted = {
      MerTradeNo: 'ORD-AMBIGUOUS-001',
      Status: 'SOME_UNRECOGNIZED_STATUS', // 不是 'SUCCESS'，但也不是明確失敗碼
      TradeAmt: '790',
      TradeNo: 'TN123',
      PaymentType: 'CREDITCARD',
      Timestamp: String(Math.floor(Date.now() / 1000)),
    }

    mockedGetGatewayByType.mockResolvedValue(
      Object.assign(Object.create(PayUniGateway.prototype), {
        getService: () => ({
          verifyAndDecrypt: () => decrypted,
          isTradeSuccess: (status: string) => status === 'SUCCESS',
        }),
      })
    )

    // 關鍵：欄位名稱對不上（模擬 PAYUNi 實際欄位跟程式猜測的不同），解析不到任何取號資訊
    mockedExtractInstructions.mockReturnValue({ instructions: null, expiresAt: null })

    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderNo: 'ORD-AMBIGUOUS-001',
      userId: 'user_1',
      courseId: 'course_1',
      bundleId: null,
      amount: 790,
      status: 'PENDING',
      clientIpAddress: null,
      clientUserAgent: null,
      couponId: null,
      couponDiscount: null,
      newsletterCampaignId: null,
      subscriptionId: null,
    })

    const { POST } = await import('@/app/api/payment/notify/route')
    const response = await POST(
      buildFormRequest({ EncryptInfo: 'fake-encrypt-info', HashInfo: 'fake-hash-info' })
    )

    expect(response.status).toBe(200)

    // 核心斷言：不允許把這筆訂單標記為 FAILED。
    const failedCalls = mockedPrisma.order.updateMany.mock.calls.filter(
      (call) => call[0]?.data?.status === 'FAILED'
    )
    expect(failedCalls).toHaveLength(0)
  })

  it('回歸防護：真正付款成功（status=SUCCESS）仍然正確標記為 PAID，本次修法沒有動到這條路徑', async () => {
    const decrypted = {
      MerTradeNo: 'ORD-SUCCESS-001',
      Status: 'SUCCESS',
      TradeAmt: '790',
      TradeNo: 'TN456',
      PaymentType: 'CREDITCARD',
      Timestamp: String(Math.floor(Date.now() / 1000)),
    }

    mockedGetGatewayByType.mockResolvedValue(
      Object.assign(Object.create(PayUniGateway.prototype), {
        getService: () => ({
          verifyAndDecrypt: () => decrypted,
          isTradeSuccess: (status: string) => status === 'SUCCESS',
        }),
      })
    )
    mockedExtractInstructions.mockReturnValue({ instructions: null, expiresAt: null })

    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'order_2',
      orderNo: 'ORD-SUCCESS-001',
      userId: 'user_1',
      courseId: 'course_1',
      bundleId: null,
      amount: 790,
      status: 'PENDING',
      clientIpAddress: null,
      clientUserAgent: null,
      couponId: null,
      couponDiscount: null,
      newsletterCampaignId: null,
      subscriptionId: null,
    })
    ;(grantPaidOrderAccess as jest.Mock).mockResolvedValue(undefined)
    ;(enqueueOrderInvoiceOutbox as jest.Mock).mockResolvedValue(undefined)

    const { POST } = await import('@/app/api/payment/notify/route')
    const response = await POST(
      buildFormRequest({ EncryptInfo: 'fake-encrypt-info', HashInfo: 'fake-hash-info' })
    )

    expect(response.status).toBe(200)
    expect(mockedPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_2', status: 'PENDING' },
        data: expect.objectContaining({ status: 'PAID' }),
      })
    )
    expect(grantPaidOrderAccess).toHaveBeenCalled()
  })

  it('回歸防護：ATM/CVS 取號成功解析（M24 既有行為）仍然保留 PENDING 並寫入待付款資訊', async () => {
    const decrypted = {
      MerTradeNo: 'ORD-ATM-001',
      Status: 'WAITING',
      TradeAmt: '790',
      TradeNo: '',
      PaymentType: 'ATM',
      Timestamp: String(Math.floor(Date.now() / 1000)),
    }

    mockedGetGatewayByType.mockResolvedValue(
      Object.assign(Object.create(PayUniGateway.prototype), {
        getService: () => ({
          verifyAndDecrypt: () => decrypted,
          isTradeSuccess: (status: string) => status === 'SUCCESS',
        }),
      })
    )
    mockedExtractInstructions.mockReturnValue({
      instructions: {
        provider: 'payuni',
        method: 'ATM',
        bankCode: '808',
        bankName: null,
        virtualAccount: '1234567890123456',
        amount: 790,
        currency: 'TWD',
        expiresAt: null,
        message: null,
      },
      expiresAt: null,
    })

    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'order_3',
      orderNo: 'ORD-ATM-001',
      userId: 'user_1',
      courseId: 'course_1',
      bundleId: null,
      amount: 790,
      status: 'PENDING',
      clientIpAddress: null,
      clientUserAgent: null,
      couponId: null,
      couponDiscount: null,
      newsletterCampaignId: null,
      subscriptionId: null,
    })

    const { POST } = await import('@/app/api/payment/notify/route')
    const response = await POST(
      buildFormRequest({ EncryptInfo: 'fake-encrypt-info', HashInfo: 'fake-hash-info' })
    )

    expect(response.status).toBe(200)
    const failedCalls = mockedPrisma.order.updateMany.mock.calls.filter(
      (call) => call[0]?.data?.status === 'FAILED'
    )
    expect(failedCalls).toHaveLength(0)
    expect(mockedPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_3', status: 'PENDING' },
        data: expect.objectContaining({
          gatewayPaymentInstructions: expect.objectContaining({ virtualAccount: '1234567890123456' }),
        }),
      })
    )
  })
})
