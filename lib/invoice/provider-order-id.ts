import { createHash } from 'node:crypto'
import type { EInvoiceProvider } from '@/lib/validations/einvoice'

export const EZPAY_MERCHANT_ORDER_NO_MAX_LENGTH = 20

/**
 * 將平台訂單號轉成加值中心接受的對帳編號。
 *
 * ezPay 的 MerchantOrderNo 僅接受 20 個英數字／底線；平台訂單號固定為 27 字，
 * 因此使用 EZ + SHA-256 前 18 個十六進位字元。結果具 72-bit 雜湊空間、固定可重算，
 * 可同時供開立、查詢與失敗重試使用。ECPay 的 RelateNumber 上限 50 字，保留原訂單號。
 */
export function toProviderInvoiceOrderId(
  provider: EInvoiceProvider,
  orderNo: string
): string {
  if (provider !== 'ezpay') return orderNo

  const digest = createHash('sha256').update(orderNo, 'utf8').digest('hex').slice(0, 18)
  return `EZ${digest}`
}

/**
 * 折讓識別碼同樣限制為 20 字，並納入「折讓前累計 + 本次金額」。
 * 遠端成功但本地寫入失敗時，重試會得到同一識別碼，避免改用新時間戳重複折讓。
 */
export function toProviderAllowanceOrderId(params: {
  provider: EInvoiceProvider
  orderNo: string
  alreadyAllowed: number
  amount: number
}): string {
  const source = `${params.provider}:${params.orderNo}:${params.alreadyAllowed}:${params.amount}`
  const digest = createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 18)
  return `AL${digest}`
}
