// __tests__/invoice/retry.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 2.3 / specs/invoice-provider-integrity/spec.md
// 「failed invoice issuance is retryable without duplication」。
//
// 目標函式：lib/invoice/service.ts 的 issueInvoiceForOrder()。
// 冪等保證依賴 Invoice.orderId @unique（見 prisma/schema.prisma Invoice model
// 註解）：同一訂單第二次呼叫，若既有 Invoice 列狀態不是 ISSUED（例如 FAILED），
// 會沿用同一列（invoiceRowId = order.invoice.id）重新開立，而不是 create() 出
// 第二筆 Invoice。
//
// 這份測試驗證 spec 的 Example：
// 「GIVEN 訂單 order_abc 有一筆 status=FAILED 的 Invoice，
//   WHEN 重試且 provider 呼叫成功，
//   THEN 同一筆 Invoice 轉為 ISSUED，THEN 不存在第二筆 Invoice」。
//
// 這是 1.7.3 既有邏輯，本測試是為了在 v1.8.0 合併 lib/invoice/service.ts
// （任務 3.4，官方版本納入 ECPay 折讓 + operation lock）時當迴歸守門，
// 預期結果見任務回報。

import { issueInvoiceForOrder } from '@/lib/invoice/service'
import { prisma } from '@/lib/prisma'
import { createInvoiceProvider } from '@/lib/invoice/provider'
import { getEInvoiceConfig, isEInvoiceConfigured } from '@/lib/invoice/config'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    bundle: {
      findUnique: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/invoice/provider', () => ({
  createInvoiceProvider: jest.fn(),
}))

jest.mock('@/lib/invoice/config', () => ({
  getEInvoiceConfig: jest.fn(),
  isEInvoiceConfigured: jest.fn(),
}))

const mockedPrisma = prisma as unknown as {
  order: { findUnique: jest.Mock }
  invoice: {
    create: jest.Mock
    update: jest.Mock
    updateMany: jest.Mock
    findUnique: jest.Mock
  }
  bundle: { findUnique: jest.Mock }
  course: { findUnique: jest.Mock }
  user: { findUnique: jest.Mock }
}

const mockedCreateInvoiceProvider = createInvoiceProvider as jest.Mock
const mockedGetEInvoiceConfig = getEInvoiceConfig as jest.Mock
const mockedIsEInvoiceConfigured = isEInvoiceConfigured as jest.Mock

describe('issueInvoiceForOrder：FAILED 重試轉 ISSUED，不重複建立 Invoice', () => {
  beforeEach(() => {
    mockedGetEInvoiceConfig.mockResolvedValue({
      enabled: true,
      provider: 'ezpay',
      merchantId: '318432098',
      hashKey: '12345678901234567890123456789012',
      hashIV: '1234567890123456',
      testMode: true,
      autoIssue: true,
      sellerName: '測試商店',
      sellerTaxId: '12345678',
    })
    mockedIsEInvoiceConfigured.mockReturnValue(true)
    mockedPrisma.user.findUnique.mockResolvedValue({
      name: '測試學員',
      email: 'student@example.com',
    })
    // v1.8.0 合併後新增：重試前用條件式 updateMany 原子搶占「PENDING 重送權」
    // （見 lib/invoice/service.ts 的 `claimed = await prisma.invoice.updateMany(...)`），
    // 回傳值的 `.count` 必須 >0 流程才會繼續；jest.fn() 預設回傳 undefined 會讓
    // `claimed.count` 直接拋例外。這裡預設模擬「搶占成功」（count:1）。
    mockedPrisma.invoice.updateMany.mockResolvedValue({ count: 1 })
  })

  it('訂單已有一筆 FAILED 發票，重試成功後：更新同一筆記錄為 ISSUED，且不呼叫 invoice.create', async () => {
    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'order_abc',
      orderNo: 'ORD20260722ABC',
      status: 'PAID',
      amount: 990,
      courseId: null,
      bundleId: null,
      userId: 'user_1',
      invoiceType: 'PERSONAL',
      invoiceCarrierType: 'member',
      invoiceCarrierId: null,
      invoiceTaxId: null,
      invoiceTitle: null,
      invoiceLoveCode: null,
      invoiceAddress: null,
      invoice: {
        id: 'invoice_failed_1',
        status: 'FAILED',
        invoiceNumber: null,
        // v1.8.0 合併後新增跨供應商防呆：order.invoice.provider 必須等於目前設定的
        // config.provider，否則會在重試前直接擋下（避免跨供應商重複開票）。
        // 這裡的原始發票就是用 ezpay 開的（跟下面 mockedGetEInvoiceConfig 一致）。
        provider: 'ezpay',
      },
    })

    const mockIssue = jest.fn().mockResolvedValue({
      invoiceNumber: 'AB12345678',
      randomCode: '1234',
      invoiceDate: new Date('2026-07-22T00:00:00Z'),
      totalAmount: 990,
      raw: {},
    })
    // v1.8.0 合併後 issueInvoiceForOrder 對非新鮮的 FAILED 發票重試前，
    // 會先呼叫 provider.query() 向加值中心查詢是否已存在（避免遠端已成功卻本地重複開票）。
    // 查無資料時 SDK 對應行為是拋出 NOT_FOUND，findProviderInvoiceByOrderId 會接住並回傳 null，
    // 這裡直接 mock 回傳 null 模擬「查無此發票」，讓流程照舊往下走到 provider.issue()。
    mockedCreateInvoiceProvider.mockReturnValue({
      issue: mockIssue,
      query: jest.fn().mockResolvedValue(null),
    })

    const result = await issueInvoiceForOrder('order_abc')

    expect(result.success).toBe(true)
    expect(result.invoiceNumber).toBe('AB12345678')

    // 核心斷言：不會建立第二筆 Invoice 記錄。
    expect(mockedPrisma.invoice.create).not.toHaveBeenCalled()

    // 核心斷言：更新的是同一筆既有記錄（id 對得上），且狀態轉為 ISSUED。
    expect(mockedPrisma.invoice.update).toHaveBeenCalledTimes(1)
    expect(mockedPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invoice_failed_1' },
        data: expect.objectContaining({ status: 'ISSUED', invoiceNumber: 'AB12345678' }),
      })
    )
  })

  it('重試後查詢該訂單，仍然只存在一筆邏輯上的 Invoice 記錄（同一 id 從 FAILED 轉為 ISSUED）', async () => {
    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'order_xyz',
      orderNo: 'ORD20260722XYZ',
      status: 'PAID',
      amount: 500,
      courseId: null,
      bundleId: null,
      userId: 'user_2',
      invoiceType: 'PERSONAL',
      invoiceCarrierType: 'member',
      invoiceCarrierId: null,
      invoiceTaxId: null,
      invoiceTitle: null,
      invoiceLoveCode: null,
      invoiceAddress: null,
      invoice: {
        id: 'invoice_failed_2',
        status: 'FAILED',
        invoiceNumber: null,
        // 同上：原始發票用 ezpay 開的，需與 config.provider 一致才能通過跨供應商防呆。
        provider: 'ezpay',
      },
    })

    const mockIssue = jest.fn().mockResolvedValue({
      invoiceNumber: 'CD98765432',
      randomCode: '5678',
      invoiceDate: new Date('2026-07-22T00:00:00Z'),
      totalAmount: 500,
      raw: {},
    })
    // 同上：先讓 provider.query() 回傳 null（查無遠端既有發票），流程才會繼續到 provider.issue()。
    mockedCreateInvoiceProvider.mockReturnValue({
      issue: mockIssue,
      query: jest.fn().mockResolvedValue(null),
    })

    await issueInvoiceForOrder('order_xyz')

    const createCalls = mockedPrisma.invoice.create.mock.calls.length
    const updateCalls = mockedPrisma.invoice.update.mock.calls
    const updatedIds = new Set(updateCalls.map((call) => call[0]?.where?.id))

    expect(createCalls).toBe(0)
    expect(updatedIds.size).toBe(1)
    expect(updatedIds.has('invoice_failed_2')).toBe(true)
  })
})
