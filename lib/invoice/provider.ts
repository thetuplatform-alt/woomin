// lib/invoice/provider.ts
// 依設定建立對應的電子發票 provider（綠界 ECPay / 藍新 ezPay）。
// 包裝 @paid-tw/einvoice 套件家族，對外只暴露統一的 InvoiceProvider 介面，
// 對應 lib/payment 的 gateway-factory 模式。僅供 server 端使用（內部使用 node:crypto）。

import { createEcpayProvider } from '@paid-tw/einvoice-ecpay'
import { createEzpayProvider } from '@paid-tw/einvoice-ezpay'
import type { InvoiceProvider } from '@paid-tw/einvoice'
import type { EInvoiceConfig } from './config'
import { isEInvoiceConfigured } from './config'
import { normalizeProviderOrderId } from './issue'
import { getEInvoiceCredentialError } from './credentials'

const INVOICE_REQUEST_TIMEOUT_MS = 15_000

function providerConfig(
  config: EInvoiceConfig,
  timeoutMs = INVOICE_REQUEST_TIMEOUT_MS
) {
  return {
    merchantId: config.merchantId,
    hashKey: config.hashKey,
    hashIV: config.hashIV,
    mode: config.testMode ? ('TEST' as const) : ('PRODUCTION' as const),
    timeoutMs,
  }
}

/**
 * 依設定建立 InvoiceProvider。憑證不齊全時丟出錯誤。
 */
export function createInvoiceProvider(config: EInvoiceConfig): InvoiceProvider {
  if (!isEInvoiceConfigured(config)) {
    throw new Error(getEInvoiceCredentialError(config) || '電子發票憑證尚未設定完整')
  }

  const baseConfig = providerConfig(config)

  if (config.provider === 'ezpay') {
    const provider = createEzpayProvider({
      ...baseConfig,
      // 平台已在送出邊界自行鎖定 MerchantOrderNo；避開正式環境中 SDK
      // 對同一欄位誤報的重複驗證，其餘回應與 CheckCode 驗證仍由 SDK 處理。
      validatePayload: false,
    })
    const issue = provider.issue.bind(provider)

    // 最後一道邊界保護：不論上游如何組資料，送進藍新元件前都再次套用 20 字限制。
    provider.issue = (input) => {
      const orderId = normalizeProviderOrderId(input.orderId, 'ezpay')
      return issue({
        ...input,
        orderId,
        providerOptions: {
          ...input.providerOptions,
          MerchantOrderNo: orderId,
        },
      })
    }

    return provider
  }

  return createEcpayProvider(baseConfig)
}

/** ECPay 擴充 API（線上折讓／折讓查詢）需要具體 provider 型別。 */
export function createEcpayInvoiceProvider(
  config: EInvoiceConfig,
  timeoutMs = INVOICE_REQUEST_TIMEOUT_MS
) {
  if (config.provider !== 'ecpay') throw new Error('目前發票 provider 不是 ECPay')
  if (!isEInvoiceConfigured(config)) {
    throw new Error(getEInvoiceCredentialError(config) || '電子發票憑證尚未設定完整')
  }
  return createEcpayProvider(providerConfig(config, timeoutMs))
}

/** 結帳與開票前使用加值中心官方 API 驗證手機載具／愛心碼是否真實存在。 */
export async function validateProviderCode(
  config: EInvoiceConfig,
  kind: 'mobile' | 'loveCode',
  value: string
): Promise<boolean> {
  if (!isEInvoiceConfigured(config)) {
    throw new Error(getEInvoiceCredentialError(config) || '電子發票憑證尚未設定完整')
  }

  const client =
    config.provider === 'ezpay'
      ? createEzpayProvider(providerConfig(config))
      : createEcpayProvider(providerConfig(config))

  return kind === 'mobile'
    ? client.validateMobileBarcode(value)
    : client.validateLoveCode(value)
}
