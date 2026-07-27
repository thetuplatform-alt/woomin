// lib/invoice/index.ts
// 臺灣電子發票抽象層公開 API（server-only）。

export type { EInvoiceConfig } from './config'
export { getEInvoiceConfig, isEInvoiceConfigured } from './config'
export { createInvoiceProvider } from './provider'
export {
  buildIssueInput,
  buildAllowanceInput,
  type OrderInvoicePreference,
  type BuildIssueParams,
} from './issue'
export { InvoiceError, isInvoiceError } from '@paid-tw/einvoice'
