import { generateOrderNo } from '@/lib/payment/shared'

describe('generateOrderNo', () => {
  it('產生不超過 PAYUNi MerTradeNo 的 25 碼限制', () => {
    expect(generateOrderNo()).toHaveLength(23)
  })
})
