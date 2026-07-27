import type { EInvoiceProvider } from '@/lib/validations/einvoice'

export interface EInvoiceCredentials {
  provider: EInvoiceProvider
  merchantId: string
  hashKey: string
  hashIV: string
}

/** 回傳可直接顯示給管理員的憑證錯誤；null 代表格式完整。 */
export function getEInvoiceCredentialError(config: EInvoiceCredentials): string | null {
  if (!config.merchantId.trim()) return '請填寫商店代號（MerchantID）'
  if (!config.hashKey) return '請填寫 HashKey'
  if (!config.hashIV) return '請填寫 HashIV'

  const merchantIdLength = config.merchantId.trim().length
  const merchantIdMax = config.provider === 'ezpay' ? 15 : 10
  if (merchantIdLength > merchantIdMax) {
    return `${config.provider === 'ezpay' ? 'ezPay' : 'ECPay'} MerchantID 不可超過 ${merchantIdMax} 個字元`
  }
  if (!/^[\x20-\x7E]+$/.test(config.merchantId.trim())) {
    return 'MerchantID 僅能使用 ASCII 字元'
  }

  const expectedKeyBytes = config.provider === 'ezpay' ? 32 : 16
  const keyBytes = Buffer.byteLength(config.hashKey, 'utf8')
  const ivBytes = Buffer.byteLength(config.hashIV, 'utf8')

  if (keyBytes !== expectedKeyBytes) {
    return `${config.provider === 'ezpay' ? 'ezPay' : 'ECPay'} HashKey 必須為 ${expectedKeyBytes} 個 ASCII 字元（目前為 ${keyBytes} bytes）`
  }
  if (ivBytes !== 16) return `HashIV 必須為 16 個 ASCII 字元（目前為 ${ivBytes} bytes）`
  if (!/^[\x20-\x7E]+$/.test(config.hashKey) || !/^[\x20-\x7E]+$/.test(config.hashIV)) {
    return 'HashKey / HashIV 僅能使用 ASCII 字元，請勿包含全形字或中文'
  }

  return null
}
