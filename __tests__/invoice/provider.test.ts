// __tests__/invoice/provider.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 2.2 / specs/invoice-provider-integrity/spec.md
// 「ezPay duplicate-validation false positives do not block retry」。
//
// 背景（design.md Decisions）：本站在 lib/invoice/provider.ts 對 ezPay provider
// 加了 `validatePayload: false`，避開 ezPay SDK 對同一欄位的重複驗證誤判
// （commit acce5b0）。這個 workaround 只關閉 SDK 的「送出前 client-side
// schema 驗證」（@paid-tw/einvoice-ezpay 的 assertValidIssuePayload /
// buildIssuePostData 內的 validate 分支），完全不影響回應端的
// `CheckCode` 簽章驗證（verifyIssueCheckCode，由獨立的 `verifyCheckCode`
// 設定旗標控制，預設仍會執行）。
//
// 這份契約測試驗證兩件事同時成立：
// 1. createInvoiceProvider() 建立 ezPay provider 時，確實把
//    validatePayload:false 傳給 SDK（workaround 還在）。
// 2. 即使繞過了重複驗證，CheckCode 簽章驗證仍然執行 —— 竄改過的回應
//    （CheckCode 對不上）仍然會被擋下，不會被略過。
//
// 這兩個行為都是 1.7.3 已生效的既有邏輯，本測試是為了在 v1.8.0 合併
// lib/invoice/provider.ts（任務 3.3）時當迴歸守門，預期結果見任務回報。

import { createInvoiceProvider } from '@/lib/invoice/provider'
import { buildIssueInput, type OrderInvoicePreference } from '@/lib/invoice/issue'
import type { EInvoiceConfig } from '@/lib/invoice/config'
import * as ezpayModule from '@paid-tw/einvoice-ezpay'

// 不能用 jest.spyOn 直接 spy 這個套件的具名匯出：@paid-tw/einvoice-ezpay 用
// esbuild 編譯，namespace 物件的屬性是不可重新定義的（Object.defineProperty
// 會丟 TypeError: Cannot redefine property）。改用 jest.mock 包一層
// jest.fn(actual) 轉發給真正實作，維持真實行為的同時仍可檢查呼叫參數。
jest.mock('@paid-tw/einvoice-ezpay', () => {
  const actual = jest.requireActual('@paid-tw/einvoice-ezpay')
  return {
    ...actual,
    createEzpayProvider: jest.fn(actual.createEzpayProvider),
  }
})

const preference: OrderInvoicePreference = {
  invoiceType: 'PERSONAL',
  carrierType: 'member',
  carrierId: null,
  taxId: null,
  title: null,
  loveCode: null,
  address: null,
}

const baseConfig: EInvoiceConfig = {
  enabled: true,
  provider: 'ezpay',
  merchantId: '318432098',
  hashKey: '12345678901234567890123456789012',
  hashIV: '1234567890123456',
  testMode: true,
  autoIssue: true,
  sellerName: '測試商店',
  sellerTaxId: '12345678',
}

function buildInput(orderNo: string) {
  return buildIssueInput({
    orderNo,
    amount: 30,
    itemName: '測試商品',
    buyerName: '測試學員',
    buyerEmail: 'student@example.com',
    preference,
    provider: 'ezpay',
  })
}

describe('ezPay provider：重複驗證誤判 workaround 契約測試', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('建立 ezPay provider 時，SDK 收到的設定包含 validatePayload:false（workaround 仍存在）', () => {
    const mockedCreateEzpayProvider = ezpayModule.createEzpayProvider as jest.Mock

    createInvoiceProvider(baseConfig)

    expect(mockedCreateEzpayProvider).toHaveBeenCalledTimes(1)
    expect(mockedCreateEzpayProvider).toHaveBeenCalledWith(
      expect.objectContaining({ validatePayload: false })
    )
  })

  it('繞過重複驗證後，CheckCode 簽章驗證仍然執行：竄改過的回應（CheckCode 對不上）會被擋下', async () => {
    const provider = createInvoiceProvider(baseConfig)
    const input = buildInput('ORDTEST0001CHECKCODE')

    const tamperedResult = {
      MerchantID: baseConfig.merchantId,
      MerchantOrderNo: input.orderId,
      InvoiceTransNo: 'FAKE0000001',
      TotalAmt: '30',
      RandomNum: '1234',
      InvoiceNumber: 'AB12345678',
      CreateTime: '2026-07-22 12:00:00',
      // 刻意帶一個不可能對得上雜湊的 CheckCode，模擬回應被竄改／偽造。
      CheckCode: 'THIS-IS-NOT-A-VALID-CHECKCODE',
    }

    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        Status: 'SUCCESS',
        Message: 'OK',
        Result: JSON.stringify(tamperedResult),
      }),
    } as unknown as Response)

    try {
      await expect(provider.issue(input)).rejects.toMatchObject({
        rawCode: 'CHECKCODE_MISMATCH',
      })
    } finally {
      global.fetch = originalFetch
    }
  })

  it('對照組：驗證失敗不是因為欄位驗證擋下（validatePayload:false 確實生效），而是因為 CheckCode 專屬檢查', async () => {
    // 這筆輸入若 validatePayload 沒被關閉，可能在送出前就被 SDK schema 擋下；
    // 這裡刻意讓它安全跑到「送出後」階段（用 STOP_BEFORE_NETWORK 攔截 fetch），
    // 證明 client-side 驗證確實被繞過，錯誤只會發生在網路層，而不是驗證層。
    const provider = createInvoiceProvider(baseConfig)
    const input = buildInput('ORDTEST0002PASSTHROUGH')

    const originalFetch = global.fetch
    global.fetch = jest.fn().mockRejectedValue(new Error('STOP_BEFORE_NETWORK'))

    try {
      await expect(provider.issue(input)).rejects.toMatchObject({ code: 'NETWORK' })
      expect(global.fetch).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = originalFetch
    }
  })
})
