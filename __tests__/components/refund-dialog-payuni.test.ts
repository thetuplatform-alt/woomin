jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))

jest.mock('@/lib/actions/orders', () => ({
  markAsRefunded: jest.fn(),
}))

import { shouldShowPayuniManualRefundConfirmation } from '@/components/admin/orders/refund-dialog'

describe('RefundDialog PAYUNi 人工退款確認框', () => {
  it('一般 PAYUNi 退款路徑不顯示人工確認框', () => {
    expect(
      shouldShowPayuniManualRefundConfirmation({
        paymentGateway: 'payuni',
        refundStatus: null,
      })
    ).toBe(false)
  })

  it('PAYUNi 降級為 PENDING_MANUAL 後才顯示人工確認框', () => {
    expect(
      shouldShowPayuniManualRefundConfirmation({
        paymentGateway: 'payuni',
        refundStatus: 'PENDING_MANUAL',
      })
    ).toBe(true)
  })

  it('非 PAYUNi 訂單不顯示人工確認框', () => {
    expect(
      shouldShowPayuniManualRefundConfirmation({
        paymentGateway: 'stripe',
        refundStatus: 'PENDING_MANUAL',
      })
    ).toBe(false)
  })
})
