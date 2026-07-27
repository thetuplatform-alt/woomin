// __tests__/invoice/reconciliation.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 7.1 / 分支 4「舊訂單發票資料修復」
// 「Classify paid orders with incomplete invoice data」。
//
// 目標函式：lib/invoice/reconciliation.ts 的 getInvoiceReconciliationList()。
// 三個分類：
// - missing：PAID 訂單但完全沒有 Invoice 記錄
// - stuck：PAID 訂單且 Invoice 狀態為 FAILED 或 PENDING
// - incompleteFields：Invoice 狀態為 ISSUED，但 invoiceNumber 或 invoiceDate 為 null
//
// 已完整 ISSUED 的訂單不該出現在任何分類；非 PAID 訂單一律排除。
//
// 此時 lib/invoice/reconciliation.ts 尚未實作，本測試應為紅燈
// （import 會找不到模組 / getInvoiceReconciliationList 為 undefined）。

import { getInvoiceReconciliationList } from '@/lib/invoice/reconciliation'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/require-admin', () => ({
  requireOnlyAdminAuth: jest.fn().mockResolvedValue({ id: 'admin_1', role: 'ADMIN' }),
}))

const mockedPrisma = prisma as unknown as {
  order: { findMany: jest.Mock }
}

describe('getInvoiceReconciliationList：分類已付款但發票資料不完整的訂單', () => {
  it('PAID 訂單完全沒有 Invoice 記錄 → 歸類為 missing', async () => {
    mockedPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order_missing_1',
        orderNo: 'ORD001',
        amount: 990,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        invoice: null,
      },
    ])

    const result = await getInvoiceReconciliationList()

    expect(result.missing).toHaveLength(1)
    expect(result.missing[0]).toMatchObject({
      orderId: 'order_missing_1',
      orderNo: 'ORD001',
      amount: 990,
    })
    expect(result.stuck).toHaveLength(0)
    expect(result.incompleteFields).toHaveLength(0)
  })

  it('PAID 訂單的 Invoice 狀態為 FAILED → 歸類為 stuck，並帶出 failReason', async () => {
    mockedPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order_stuck_1',
        orderNo: 'ORD002',
        amount: 500,
        createdAt: new Date('2026-07-02T00:00:00Z'),
        invoice: {
          status: 'FAILED',
          invoiceNumber: null,
          invoiceDate: null,
          failReason: '會員載具驗證失敗',
        },
      },
    ])

    const result = await getInvoiceReconciliationList()

    expect(result.stuck).toHaveLength(1)
    expect(result.stuck[0]).toMatchObject({
      orderId: 'order_stuck_1',
      invoiceStatus: 'FAILED',
      failReason: '會員載具驗證失敗',
    })
    expect(result.missing).toHaveLength(0)
    expect(result.incompleteFields).toHaveLength(0)
  })

  it('PAID 訂單的 Invoice 狀態為 PENDING → 同樣歸類為 stuck', async () => {
    mockedPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order_stuck_2',
        orderNo: 'ORD003',
        amount: 300,
        createdAt: new Date('2026-07-03T00:00:00Z'),
        invoice: {
          status: 'PENDING',
          invoiceNumber: null,
          invoiceDate: null,
          failReason: null,
        },
      },
    ])

    const result = await getInvoiceReconciliationList()

    expect(result.stuck).toHaveLength(1)
    expect(result.stuck[0].invoiceStatus).toBe('PENDING')
  })

  it('Invoice 狀態為 ISSUED 但 invoiceNumber 為 null → 歸類為 incompleteFields', async () => {
    mockedPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order_incomplete_1',
        orderNo: 'ORD004',
        amount: 1200,
        createdAt: new Date('2026-07-04T00:00:00Z'),
        invoice: {
          status: 'ISSUED',
          invoiceNumber: null,
          invoiceDate: new Date('2026-07-04T01:00:00Z'),
          failReason: null,
        },
      },
    ])

    const result = await getInvoiceReconciliationList()

    expect(result.incompleteFields).toHaveLength(1)
    expect(result.incompleteFields[0].orderId).toBe('order_incomplete_1')
  })

  it('Invoice 狀態為 ISSUED 但 invoiceDate 為 null → 歸類為 incompleteFields', async () => {
    mockedPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order_incomplete_2',
        orderNo: 'ORD005',
        amount: 800,
        createdAt: new Date('2026-07-05T00:00:00Z'),
        invoice: {
          status: 'ISSUED',
          invoiceNumber: 'AB12345678',
          invoiceDate: null,
          failReason: null,
        },
      },
    ])

    const result = await getInvoiceReconciliationList()

    expect(result.incompleteFields).toHaveLength(1)
    expect(result.incompleteFields[0].orderId).toBe('order_incomplete_2')
  })

  it('已完整 ISSUED 的訂單（invoiceNumber 與 invoiceDate 皆有值）不出現在任何分類', async () => {
    mockedPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order_complete_1',
        orderNo: 'ORD006',
        amount: 990,
        createdAt: new Date('2026-07-06T00:00:00Z'),
        invoice: {
          status: 'ISSUED',
          invoiceNumber: 'CD98765432',
          invoiceDate: new Date('2026-07-06T01:00:00Z'),
          failReason: null,
        },
      },
    ])

    const result = await getInvoiceReconciliationList()

    expect(result.missing).toHaveLength(0)
    expect(result.stuck).toHaveLength(0)
    expect(result.incompleteFields).toHaveLength(0)
  })

  it('非 PAID 訂單（即便發票不完整）一律排除，不會出現在任何分類', async () => {
    // 這裡直接驗證呼叫端：實作應該在查詢條件把 status 限定為 PAID，
    // 所以 mock 回傳空陣列（模擬 prisma 已用 where: { status: 'PAID' } 過濾掉非 PAID 訂單）。
    mockedPrisma.order.findMany.mockResolvedValue([])

    const result = await getInvoiceReconciliationList()

    expect(result.missing).toHaveLength(0)
    expect(result.stuck).toHaveLength(0)
    expect(result.incompleteFields).toHaveLength(0)
    expect(mockedPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PAID' }),
      })
    )
  })

  it('混合多筆訂單時，各自正確落入對應分類', async () => {
    mockedPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order_a',
        orderNo: 'ORDA',
        amount: 100,
        createdAt: new Date('2026-07-10T00:00:00Z'),
        invoice: null,
      },
      {
        id: 'order_b',
        orderNo: 'ORDB',
        amount: 200,
        createdAt: new Date('2026-07-11T00:00:00Z'),
        invoice: { status: 'FAILED', invoiceNumber: null, invoiceDate: null, failReason: '逾時' },
      },
      {
        id: 'order_c',
        orderNo: 'ORDC',
        amount: 300,
        createdAt: new Date('2026-07-12T00:00:00Z'),
        invoice: {
          status: 'ISSUED',
          invoiceNumber: null,
          invoiceDate: null,
          failReason: null,
        },
      },
      {
        id: 'order_d',
        orderNo: 'ORDD',
        amount: 400,
        createdAt: new Date('2026-07-13T00:00:00Z'),
        invoice: {
          status: 'ISSUED',
          invoiceNumber: 'ZZ11112222',
          invoiceDate: new Date('2026-07-13T01:00:00Z'),
          failReason: null,
        },
      },
    ])

    const result = await getInvoiceReconciliationList()

    expect(result.missing.map((o) => o.orderId)).toEqual(['order_a'])
    expect(result.stuck.map((o) => o.orderId)).toEqual(['order_b'])
    expect(result.incompleteFields.map((o) => o.orderId)).toEqual(['order_c'])
  })
})
