import {
  InvoiceErrorCode,
  isInvoiceError,
  type InvoiceProvider,
  type QueryInvoiceResult,
} from '@paid-tw/einvoice'
import type { EInvoiceProvider } from '@/lib/validations/einvoice'

/**
 * 以 provider 對帳編號查詢既有發票。
 *
 * ezPay 的 SearchType=1 額外要求 TotalAmt，因此查詢與重試必須使用原訂單金額。
 * 查無資料是正常結果（null）；驗證、憑證、網路等錯誤必須往外拋，避免在狀態不明時重複開票。
 */
export async function findProviderInvoiceByOrderId(params: {
  client: InvoiceProvider
  provider: EInvoiceProvider
  orderId: string
  amount: number
}): Promise<QueryInvoiceResult | null> {
  try {
    return await params.client.query({
      orderId: params.orderId,
      providerOptions: params.provider === 'ezpay' ? { totalAmt: params.amount } : undefined,
    })
  } catch (error) {
    if (isInvoiceError(error) && error.code === InvoiceErrorCode.NOT_FOUND) return null
    throw error
  }
}
