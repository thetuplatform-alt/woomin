import {
  buildIssueInput,
  normalizeProviderOrderId,
  type OrderInvoicePreference,
} from '@/lib/invoice/issue'
import { createEzpayProvider } from '@paid-tw/einvoice-ezpay'
import { createInvoiceProvider } from '@/lib/invoice/provider'

const preference: OrderInvoicePreference = {
  invoiceType: 'PERSONAL',
  carrierType: 'member',
  carrierId: null,
  taxId: null,
  title: null,
  loveCode: null,
  address: null,
}

function build(orderNo: string, provider: 'ecpay' | 'ezpay') {
  return buildIssueInput({
    orderNo,
    amount: 30,
    itemName: '測試商品',
    buyerName: '測試學員',
    buyerEmail: 'student@example.com',
    preference,
    provider,
  })
}

describe('ezPay 發票單號', () => {
  const longOrderNo = 'ORD20260711b818a95412345678'

  it('將超過限制的平台訂單編號轉為固定的 20 字 ezPay 單號', () => {
    const first = build(longOrderNo, 'ezpay').orderId
    const retry = build(longOrderNo, 'ezpay').orderId

    expect(first).toHaveLength(20)
    expect(first).toMatch(/^[A-Za-z0-9_]+$/)
    expect(retry).toBe(first)
  })

  it('不同平台訂單不會產生相同的 ezPay 單號', () => {
    expect(build(longOrderNo, 'ezpay').orderId).not.toBe(
      build('ORD20260711b818a95412345679', 'ezpay').orderId
    )
  })

  it('不改動綠界 ECPay 的平台訂單編號', () => {
    expect(build(longOrderNo, 'ecpay').orderId).toBe(longOrderNo)
  })

  it('保留原本已符合限制的 ezPay 單號', () => {
    expect(build('TEST20260711ABC123', 'ezpay').orderId).toBe('TEST20260711ABC123')
  })

  it('藍新元件最後送出的 MerchantOrderNo 仍為 20 字', () => {
    const provider = createEzpayProvider({
      merchantId: '318432098',
      hashKey: '12345678901234567890123456789012',
      hashIV: '1234567890123456',
      mode: 'TEST',
    })
    const postData = (
      provider as unknown as {
        buildIssuePostData: (
          input: ReturnType<typeof build>,
          status: string
        ) => { MerchantOrderNo: string }
      }
    ).buildIssuePostData(build(longOrderNo, 'ezpay'), '1')

    expect(postData.MerchantOrderNo).toHaveLength(20)
  })

  it('藍新最後一道保護可再次縮短舊格式單號', () => {
    expect(normalizeProviderOrderId(longOrderNo, 'ezpay')).toHaveLength(20)
    expect(normalizeProviderOrderId(longOrderNo, 'ecpay')).toBe(longOrderNo)
  })

  it('明確鎖定藍新最終 MerchantOrderNo 覆蓋欄位', () => {
    const input = build(longOrderNo, 'ezpay')

    expect(input.providerOptions?.MerchantOrderNo).toBe(input.orderId)
    expect(String(input.providerOptions?.MerchantOrderNo)).toHaveLength(20)
    expect(build(longOrderNo, 'ecpay').providerOptions).toBeUndefined()
  })

  it('通過藍新完整 issue 流程的送出前驗證', async () => {
    const provider = createEzpayProvider({
      merchantId: '318432098',
      hashKey: '12345678901234567890123456789012',
      hashIV: '1234567890123456',
      mode: 'TEST',
    })
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockRejectedValue(new Error('STOP_BEFORE_NETWORK'))

    try {
      await expect(provider.issue(build(longOrderNo, 'ezpay'))).rejects.toThrow('ezPay request failed')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('正式使用的藍新邊界會覆蓋舊長單號並進入送出階段', async () => {
    const provider = createInvoiceProvider({
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
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockRejectedValue(new Error('STOP_BEFORE_NETWORK'))

    try {
      const input = build(longOrderNo, 'ezpay')
      input.orderId = longOrderNo
      input.providerOptions = { MerchantOrderNo: longOrderNo }

      await expect(provider.issue(input)).rejects.toThrow('ezPay request failed')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = originalFetch
    }
  })
})
