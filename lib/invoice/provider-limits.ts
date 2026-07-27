import type { EInvoiceProvider } from '@/lib/validations/einvoice'

function truncateUtf8(value: string, maxBytes: number): string {
  let result = ''
  let bytes = 0
  for (const char of value) {
    const charBytes = Buffer.byteLength(char, 'utf8')
    if (bytes + charBytes > maxBytes) break
    result += char
    bytes += charBytes
  }
  return result
}

/** 作廢原因：ezPay 上限 20 UTF-8 bytes；ECPay 保守限制為 20 字。 */
export function normalizeProviderVoidReason(
  provider: EInvoiceProvider,
  reason: string
): string {
  const normalized = reason.trim() || '訂單作廢'
  return provider === 'ezpay'
    ? truncateUtf8(normalized, 20)
    : Array.from(normalized).slice(0, 20).join('')
}
