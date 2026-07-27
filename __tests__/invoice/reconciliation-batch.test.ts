// __tests__/invoice/reconciliation-batch.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 7.2 / 分支 4「舊訂單發票資料修復」
// 「Admin can batch re-trigger invoice issuance for listed orders」。
//
// 目標函式：lib/actions/invoice-reconciliation.ts 的 batchReissueInvoicesAction()。
//
// 驗證重點：多筆 orderId 中若其中一筆呼叫 issueInvoiceAction 失敗（不論是
// 回傳 success:false，或直接拋出例外），其餘筆數仍會被處理並各自回傳結果，
// 不會整批中斷（不 throw、不提早 return）。
//
// 此時 lib/actions/invoice-reconciliation.ts 尚未實作，本測試應為紅燈
// （import 會找不到模組 / batchReissueInvoicesAction 為 undefined）。

import { batchReissueInvoicesAction } from '@/lib/actions/invoice-reconciliation'
import { issueInvoiceAction } from '@/lib/actions/einvoice'

jest.mock('@/lib/actions/einvoice', () => ({
  issueInvoiceAction: jest.fn(),
}))

jest.mock('@/lib/require-admin', () => ({
  requireOnlyAdminAuth: jest.fn().mockResolvedValue({ id: 'admin_1', role: 'ADMIN' }),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

const mockedIssueInvoiceAction = issueInvoiceAction as jest.Mock

describe('batchReissueInvoicesAction：批次重試不因單筆失敗而中斷', () => {
  it('其中一筆回傳 success:false，其餘筆數仍各自被呼叫並回傳結果', async () => {
    mockedIssueInvoiceAction
      .mockResolvedValueOnce({ success: true, invoiceNumber: 'AB11111111' })
      .mockResolvedValueOnce({ success: false, error: '會員載具驗證失敗' })
      .mockResolvedValueOnce({ success: true, invoiceNumber: 'AB33333333' })

    const results = await batchReissueInvoicesAction(['order_1', 'order_2', 'order_3'])

    expect(mockedIssueInvoiceAction).toHaveBeenCalledTimes(3)
    expect(mockedIssueInvoiceAction).toHaveBeenNthCalledWith(1, 'order_1')
    expect(mockedIssueInvoiceAction).toHaveBeenNthCalledWith(2, 'order_2')
    expect(mockedIssueInvoiceAction).toHaveBeenNthCalledWith(3, 'order_3')

    expect(results).toHaveLength(3)
    expect(results[0]).toMatchObject({
      orderId: 'order_1',
      success: true,
      invoiceNumber: 'AB11111111',
    })
    expect(results[1]).toMatchObject({
      orderId: 'order_2',
      success: false,
      error: '會員載具驗證失敗',
    })
    expect(results[2]).toMatchObject({
      orderId: 'order_3',
      success: true,
      invoiceNumber: 'AB33333333',
    })
  })

  it('其中一筆直接拋出例外（非預期錯誤），其餘筆數仍繼續處理、不整批中斷', async () => {
    mockedIssueInvoiceAction
      .mockResolvedValueOnce({ success: true, invoiceNumber: 'CD11111111' })
      .mockRejectedValueOnce(new Error('資料庫連線逾時'))
      .mockResolvedValueOnce({ success: true, invoiceNumber: 'CD33333333' })

    const results = await batchReissueInvoicesAction(['order_a', 'order_b', 'order_c'])

    expect(mockedIssueInvoiceAction).toHaveBeenCalledTimes(3)
    expect(results).toHaveLength(3)
    expect(results[0]).toMatchObject({ orderId: 'order_a', success: true })
    expect(results[1]).toMatchObject({
      orderId: 'order_b',
      success: false,
      error: '資料庫連線逾時',
    })
    // 關鍵斷言：第三筆即便前一筆拋例外，仍然被呼叫、仍然拿到成功結果。
    expect(results[2]).toMatchObject({ orderId: 'order_c', success: true })
  })

  it('空陣列輸入時回傳空陣列，且不呼叫 issueInvoiceAction', async () => {
    const results = await batchReissueInvoicesAction([])

    expect(results).toEqual([])
    expect(mockedIssueInvoiceAction).not.toHaveBeenCalled()
  })
})
