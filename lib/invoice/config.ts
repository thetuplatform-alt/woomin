// lib/invoice/config.ts
// 臺灣電子發票設定讀取（server-only）
// 從 SiteSetting 讀出原始（未遮蔽）的加值中心憑證，供 lib/invoice 建立 provider 使用。

import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'
import type { EInvoiceProvider } from '@/lib/validations/einvoice'
import { getEInvoiceCredentialError } from './credentials'

export interface EInvoiceConfig {
  enabled: boolean
  provider: EInvoiceProvider
  merchantId: string
  hashKey: string
  hashIV: string
  testMode: boolean
  autoIssue: boolean
  sellerName: string
  sellerTaxId: string
}

const EINVOICE_KEYS = [
  SETTING_KEYS.EINVOICE_ENABLED,
  SETTING_KEYS.EINVOICE_PROVIDER,
  SETTING_KEYS.EINVOICE_MERCHANT_ID,
  SETTING_KEYS.EINVOICE_HASH_KEY,
  SETTING_KEYS.EINVOICE_HASH_IV,
  SETTING_KEYS.EINVOICE_TEST_MODE,
  SETTING_KEYS.EINVOICE_AUTO_ISSUE,
  SETTING_KEYS.EINVOICE_SELLER_NAME,
  SETTING_KEYS.EINVOICE_SELLER_TAX_ID,
] as const

/**
 * 讀取電子發票設定（原始值，未遮蔽）。
 * 僅供 server 端（actions / route handlers）使用。
 */
export async function getEInvoiceConfig(): Promise<EInvoiceConfig> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [...EINVOICE_KEYS] } },
  })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const get = (k: string): string => map.get(k) ?? ''

  return {
    enabled: get(SETTING_KEYS.EINVOICE_ENABLED) === 'true',
    provider: (get(SETTING_KEYS.EINVOICE_PROVIDER) || 'ecpay') as EInvoiceProvider,
    merchantId: get(SETTING_KEYS.EINVOICE_MERCHANT_ID),
    hashKey: get(SETTING_KEYS.EINVOICE_HASH_KEY),
    hashIV: get(SETTING_KEYS.EINVOICE_HASH_IV),
    // 預設 true（保護：未設定前一律視為測試）
    testMode: get(SETTING_KEYS.EINVOICE_TEST_MODE) !== 'false',
    // 預設 true（啟用後預設自動開立）
    autoIssue: get(SETTING_KEYS.EINVOICE_AUTO_ISSUE) !== 'false',
    sellerName: get(SETTING_KEYS.EINVOICE_SELLER_NAME),
    sellerTaxId: get(SETTING_KEYS.EINVOICE_SELLER_TAX_ID),
  }
}

/** 憑證是否齊全（可實際呼叫加值中心）。 */
export function isEInvoiceConfigured(config: EInvoiceConfig): boolean {
  return getEInvoiceCredentialError(config) === null
}
