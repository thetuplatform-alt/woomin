import { shouldShowStandaloneInvoiceOperations } from '@/components/admin/orders/invoice-visibility'

describe('shouldShowStandaloneInvoiceOperations', () => {
  it('發票自動沖銷失敗時顯示分開處理入口', () => {
    expect(shouldShowStandaloneInvoiceOperations({ failReason: '作廢失敗' })).toBe(true)
  })

  it('發票正常或沒有失敗原因時不顯示分開處理入口', () => {
    expect(shouldShowStandaloneInvoiceOperations({ failReason: null })).toBe(false)
    expect(shouldShowStandaloneInvoiceOperations(null)).toBe(false)
  })
})
