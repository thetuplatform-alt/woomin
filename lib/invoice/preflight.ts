import type { EInvoiceConfig } from './config'
import { getEInvoiceConfig, isEInvoiceConfigured } from './config'
import { getEInvoiceCredentialError } from './credentials'
import { validateProviderCode } from './provider'
import type { OrderInvoicePreference } from './issue'
import type { CheckoutInvoiceInput } from '@/lib/validations/einvoice'
import { InvoiceErrorCode, isInvoiceError } from '@paid-tw/einvoice'

export interface InvoicePreflightResult {
  success: boolean
  error?: string
}

/**
 * 手機載具／愛心碼查詢會依賴財政部服務；官方要求把它視為輔助驗證，
 * 不可因暫時維護或網路異常阻斷正常開票。憑證、格式與明確不存在仍須失敗。
 */
export function isTransientInvoiceVerificationError(error: unknown): boolean {
  return (
    isInvoiceError(error) &&
    (error.code === InvoiceErrorCode.NETWORK ||
      error.code === InvoiceErrorCode.PROVIDER ||
      error.code === InvoiceErrorCode.UNKNOWN)
  )
}

function checkoutPreference(invoice?: CheckoutInvoiceInput | null): OrderInvoicePreference {
  return {
    invoiceType: invoice?.invoiceType ?? 'PERSONAL',
    carrierType: invoice?.carrierType ?? null,
    carrierId: invoice?.carrierId || null,
    taxId: invoice?.taxId || null,
    title: invoice?.title || null,
    loveCode: invoice?.loveCode || null,
    address: invoice?.address || null,
  }
}

/**
 * 在付款前與真正開票前執行同一組 provider-aware 驗證。
 * 格式、憑證與「明確不存在」採 fail-closed；財政部／provider 暫時不可用時
 * 依官方建議退回本地格式驗證，實際開票仍由 durable outbox 負責重試。
 */
export async function validateInvoicePreference(params: {
  config: EInvoiceConfig
  preference: OrderInvoicePreference
  buyerEmail: string | null | undefined
}): Promise<InvoicePreflightResult> {
  const { config, preference } = params
  if (!config.enabled) return { success: true }

  if (!isEInvoiceConfigured(config)) {
    return {
      success: false,
      error: getEInvoiceCredentialError(config) || '電子發票尚未設定完整',
    }
  }

  const email = params.buyerEmail?.trim() || ''
  const maxEmailLength = config.provider === 'ezpay' ? 50 : 80
  if (email && email.length > maxEmailLength) {
    return {
      success: false,
      error: `${config.provider === 'ezpay' ? 'ezPay' : 'ECPay'} 買受人 Email 不可超過 ${maxEmailLength} 個字元`,
    }
  }
  if (preference.invoiceType === 'PERSONAL' && preference.carrierType !== 'mobile') {
    if (!email) return { success: false, error: '會員載具必須有買受人 Email' }
  }

  if (preference.invoiceType === 'COMPANY' && (preference.title?.trim().length ?? 0) > 60) {
    return { success: false, error: '公司抬頭不可超過 60 個字元' }
  }

  try {
    if (preference.invoiceType === 'PERSONAL' && preference.carrierType === 'mobile') {
      if (!preference.carrierId) return { success: false, error: '請輸入手機載具' }
      const valid = await validateProviderCode(config, 'mobile', preference.carrierId)
      if (!valid) return { success: false, error: '手機載具未在財政部登錄，請確認後再付款' }
    }

    if (preference.invoiceType === 'DONATION') {
      if (!preference.loveCode) return { success: false, error: '請輸入愛心碼' }
      const valid = await validateProviderCode(config, 'loveCode', preference.loveCode)
      if (!valid) return { success: false, error: '愛心碼未在財政部登錄，請確認後再付款' }
    }
  } catch (error) {
    if (isTransientInvoiceVerificationError(error)) {
      console.warn(
        '[E-Invoice] 官方載具／捐贈碼驗證暫時不可用，已通過本地格式驗證並交由開票流程重試:',
        error instanceof Error ? error.message : error
      )
      return { success: true }
    }
    return {
      success: false,
      error: `電子發票資料即時驗證失敗：${error instanceof Error ? error.message : '未知錯誤'}`,
    }
  }

  return { success: true }
}

export async function validateCheckoutInvoiceBeforePayment(params: {
  invoice?: CheckoutInvoiceInput | null
  buyerEmail: string | null | undefined
}): Promise<InvoicePreflightResult> {
  const config = await getEInvoiceConfig()
  return validateInvoicePreference({
    config,
    preference: checkoutPreference(params.invoice),
    buyerEmail: params.buyerEmail,
  })
}
