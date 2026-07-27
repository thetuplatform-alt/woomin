// __tests__/invoice/provider-order-id.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 2.1 / specs/invoice-provider-integrity/spec.md
// 「ezPay provider order identifiers stay within the 20-character limit」。
//
// 目標函式：lib/invoice/issue.ts 的 normalizeProviderOrderId()。
// 這是 lib/invoice/provider.ts 的 createInvoiceProvider() 在送出前的
// 「最後一道邊界保護」實際呼叫的同一個函式（見 provider.ts:11,39）。
//
// 這份測試驗證「任意長度」的內部訂單編號都能產生確定性、且不超過 20 字的
// ezPay MerchantOrderNo，補足既有 __tests__/invoice/ezpay-order-id.test.ts
// 只用單一 27 字範例的涵蓋範圍。
//
// 注意：這個修法已在 1.7.3 上線並生效（非本次 v1.8.0 才新增的功能），
// 這裡是把「合併 v1.8.0 時不能弄丟」的行為鎖進迴歸測試，
// 因此執行結果預期為綠燈（詳見任務回報）。

import { normalizeProviderOrderId } from '@/lib/invoice/issue'

const MERCHANT_ORDER_NO_MAX_LENGTH = 20

describe('normalizeProviderOrderId：ezPay MerchantOrderNo 20 字上限', () => {
  it.each([1, 5, 19, 20, 21, 22, 27, 35, 50, 100])(
    '任意長度 %i 的內部訂單編號，轉出的 ezPay 單號都不超過 20 字',
    (length) => {
      const orderNo = 'O'.repeat(length)
      const result = normalizeProviderOrderId(orderNo, 'ezpay')
      expect(result.length).toBeLessThanOrEqual(MERCHANT_ORDER_NO_MAX_LENGTH)
    }
  )

  it('同一筆訂單重試（呼叫兩次）產生完全相同的 ezPay 單號（確定性）', () => {
    const orderNo = 'ORD20260722abcdef1234567890'
    const first = normalizeProviderOrderId(orderNo, 'ezpay')
    const second = normalizeProviderOrderId(orderNo, 'ezpay')
    const third = normalizeProviderOrderId(orderNo, 'ezpay')

    expect(first).toBe(second)
    expect(second).toBe(third)
    expect(first.length).toBeLessThanOrEqual(MERCHANT_ORDER_NO_MAX_LENGTH)
  })

  it('不同的內部訂單編號，只要長度超過限制，一律轉出不同的單號（不會誤撞相同單號）', () => {
    const a = normalizeProviderOrderId('ORD20260722abcdef1234567890', 'ezpay')
    const b = normalizeProviderOrderId('ORD20260722abcdef1234567891', 'ezpay')
    expect(a).not.toBe(b)
  })

  it('剛好等於 20 字上限的訂單編號維持原樣（不做多餘轉換）', () => {
    const orderNo = 'A'.repeat(20)
    expect(normalizeProviderOrderId(orderNo, 'ezpay')).toBe(orderNo)
  })

  it('19 字（低於上限）的訂單編號維持原樣', () => {
    const orderNo = 'B'.repeat(19)
    expect(normalizeProviderOrderId(orderNo, 'ezpay')).toBe(orderNo)
  })

  it('綠界（ecpay）不受 20 字限制，任意長度一律原樣傳遞', () => {
    const longOrderNo = 'C'.repeat(35)
    expect(normalizeProviderOrderId(longOrderNo, 'ecpay')).toBe(longOrderNo)
  })

  it('轉出的 ezPay 單號只包含 SDK 允許的字元（英數與底線）', () => {
    const orderNo = 'ORD20260722_超長訂單編號_測試用_1234567890'
    const result = normalizeProviderOrderId(orderNo, 'ezpay')
    expect(result.length).toBeLessThanOrEqual(MERCHANT_ORDER_NO_MAX_LENGTH)
    expect(result).toMatch(/^[A-Za-z0-9_]+$/)
  })
})
