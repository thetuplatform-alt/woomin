import { PayUniGateway } from '@/lib/payment/payuni-gateway'

jest.mock('@/lib/subscription/payuni-period', () => ({
  endPayuniPeriod: jest.fn(),
}))

function createGateway(testMode = true) {
  const gateway = new PayUniGateway({
    merchantId: '12345678',
    hashKey: '12345678901234567890123456789012',
    hashIV: '1234567890123456',
    testMode,
  })
  const requestApi = jest.fn()
  ;(gateway as unknown as { service: { requestApi: jest.Mock } }).service.requestApi =
    requestApi
  return { gateway, requestApi }
}

describe('PayUniGateway.processRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['2', 'close'],
    ['7', 'close'],
  ])('CloseStatus=%s 時呼叫 trade/close 並帶 CloseType=2 與 TradeAmt', async (closeStatus) => {
    const { gateway, requestApi } = createGateway()
    requestApi
      .mockResolvedValueOnce({
        Status: 'SUCCESS',
        Message: 'OK',
        CloseStatus: closeStatus,
        TradeAmt: '1234',
      })
      .mockResolvedValueOnce({ Status: 'SUCCESS', Message: 'OK' })

    const result = await gateway.processRefund({
      gatewayPaymentId: '1234567890',
      orderNo: 'ORD-001',
    })

    expect(result).toEqual({ success: true })
    expect(requestApi).toHaveBeenNthCalledWith(
      1,
      'https://sandbox-api.payuni.com.tw/api/trade/query',
      { TradeNo: '1234567890' },
      { version: '2.0' }
    )
    expect(requestApi).toHaveBeenNthCalledWith(
      2,
      'https://sandbox-api.payuni.com.tw/api/trade/close',
      {
        TradeNo: '1234567890',
        CloseType: 2,
        TradeAmt: 1234,
      }
    )
  })

  it('支援 PAYUNi trade/query 官方 Result[0] 欄位格式', async () => {
    const { gateway, requestApi } = createGateway()
    requestApi
      .mockResolvedValueOnce({
        Status: 'SUCCESS',
        Message: '查詢成功',
        'Result[0][CloseStatus]': '2',
        'Result[0][TradeAmt]': '30',
      })
      .mockResolvedValueOnce({ Status: 'SUCCESS', Message: '退款成功' })

    const result = await gateway.processRefund({
      gatewayPaymentId: '1784892476843982805',
      orderNo: 'ORD-REAL-SANDBOX',
    })

    expect(result).toEqual({ success: true })
    expect(requestApi).toHaveBeenNthCalledWith(
      2,
      'https://sandbox-api.payuni.com.tw/api/trade/close',
      {
        TradeNo: '1784892476843982805',
        CloseType: 2,
        TradeAmt: 30,
      }
    )
  })

  it('CloseStatus=1 時呼叫 trade/cancel', async () => {
    const { gateway, requestApi } = createGateway(false)
    requestApi
      .mockResolvedValueOnce({
        Status: 'SUCCESS',
        Message: 'OK',
        CloseStatus: '1',
        TradeAmt: '1234',
      })
      .mockResolvedValueOnce({ Status: 'SUCCESS', Message: 'OK' })

    const result = await gateway.processRefund({
      gatewayPaymentId: '1234567890',
      orderNo: 'ORD-001',
    })

    expect(result).toEqual({ success: true })
    expect(requestApi).toHaveBeenNthCalledWith(
      1,
      'https://api.payuni.com.tw/api/trade/query',
      { TradeNo: '1234567890' },
      { version: '2.0' }
    )
    expect(requestApi).toHaveBeenNthCalledWith(
      2,
      'https://api.payuni.com.tw/api/trade/cancel',
      { TradeNo: '1234567890' }
    )
  })

  it.each(['3', '9'])('CloseStatus=%s 時不呼叫退款端點並直接成功', async (closeStatus) => {
    const { gateway, requestApi } = createGateway()
    requestApi.mockResolvedValueOnce({
      Status: 'SUCCESS',
      Message: 'OK',
      CloseStatus: closeStatus,
      TradeAmt: '1234',
    })

    const result = await gateway.processRefund({
      gatewayPaymentId: '1234567890',
      orderNo: 'ORD-001',
    })

    expect(result).toEqual({ success: true })
    expect(requestApi).toHaveBeenCalledTimes(1)
  })

  it('trade/query 回傳非成功時回傳失敗', async () => {
    const { gateway, requestApi } = createGateway()
    requestApi.mockResolvedValueOnce({
      Status: 'QUERY02001',
      Message: '查無交易',
    })

    const result = await gateway.processRefund({
      gatewayPaymentId: '1234567890',
      orderNo: 'ORD-001',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('查無交易')
  })

  it('trade/close 回傳非成功時回傳失敗', async () => {
    const { gateway, requestApi } = createGateway()
    requestApi
      .mockResolvedValueOnce({
        Status: 'SUCCESS',
        Message: 'OK',
        CloseStatus: '2',
        TradeAmt: '1234',
      })
      .mockResolvedValueOnce({
        Status: 'CLOSE02001',
        Message: '退款失敗',
      })

    const result = await gateway.processRefund({
      gatewayPaymentId: '1234567890',
      orderNo: 'ORD-001',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('退款失敗')
  })

  it('trade/cancel 拋出例外時回傳失敗', async () => {
    const { gateway, requestApi } = createGateway()
    requestApi
      .mockResolvedValueOnce({
        Status: 'SUCCESS',
        Message: 'OK',
        CloseStatus: '1',
        TradeAmt: '1234',
      })
      .mockRejectedValueOnce(new Error('PAYUNi API 連線逾時'))

    const result = await gateway.processRefund({
      gatewayPaymentId: '1234567890',
      orderNo: 'ORD-001',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('PAYUNi API 連線逾時')
  })

  it('缺少 TradeNo 時回傳失敗', async () => {
    const { gateway, requestApi } = createGateway()

    const result = await gateway.processRefund({
      gatewayPaymentId: null,
      orderNo: 'ORD-001',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少 PAYUNi TradeNo')
    expect(requestApi).not.toHaveBeenCalled()
  })
})
