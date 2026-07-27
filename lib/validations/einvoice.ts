import { z } from 'zod'

/**
 * 臺灣電子發票驗證 Schema
 *
 * 兩組：
 * 1. einvoiceSettingsSchema — 後台「臺灣統一發票」設定表單
 * 2. checkoutInvoiceSchema — 結帳頁買受人發票資訊
 *
 * 本檔僅用純 zod（不 import @paid-tw/einvoice），以免把 SDK 打包進 client bundle。
 * UBN 檢查碼等權威驗證由 SDK 在開立時於 server 端執行。
 */

export const EINVOICE_PROVIDERS = ['ecpay', 'ezpay'] as const
export type EInvoiceProvider = (typeof EINVOICE_PROVIDERS)[number]

/** 手機條碼格式：`/` + 7 碼（0-9 A-Z . + -） */
export const MOBILE_BARCODE_REGEX = /^\/[0-9A-Z.+-]{7}$/
/** 捐贈碼 / 愛心碼：3-7 碼數字 */
export const LOVE_CODE_REGEX = /^\d{3,7}$/
/** 統一編號：8 碼數字 */
export const UBN_REGEX = /^\d{8}$/

/**
 * 台灣統一編號檢查碼驗證（L54）。
 * 在「結帳前」即驗證，避免使用者付款後才在開立發票時失敗。
 * 採財政部 2023 起的規則：邏輯乘積位數和能被 5 整除；第 7 碼為 7 時，和或和+1 可被 5 整除皆可。
 */
export function isValidTaiwanUBN(ubn: string): boolean {
  if (!UBN_REGEX.test(ubn)) return false
  const weights = [1, 2, 1, 2, 1, 2, 4, 1]
  const digits = ubn.split('').map((d) => Number(d))
  let sum = 0
  for (let i = 0; i < 8; i++) {
    const product = digits[i] * weights[i]
    sum += Math.floor(product / 10) + (product % 10)
  }
  if (digits[6] === 7) {
    return sum % 5 === 0 || (sum + 1) % 5 === 0
  }
  return sum % 5 === 0
}

// ---------------------------------------------------------------------------
// 1. 後台發票設定
// ---------------------------------------------------------------------------

export const einvoiceSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: z.enum(EINVOICE_PROVIDERS).default('ecpay'),
    merchantId: z.string().max(15, '商店代號不可超過 15 個字').optional().or(z.literal('')),
    // 敏感欄位：留空代表沿用原本已儲存的值（不覆蓋）
    hashKey: z.string().max(100, 'HashKey 不可超過 100 個字').optional().or(z.literal('')),
    hashIV: z.string().max(100, 'HashIV 不可超過 100 個字').optional().or(z.literal('')),
    testMode: z.boolean().default(true),
    autoIssue: z.boolean().default(true),
    sellerName: z.string().max(60, '賣方名稱不可超過 60 個字').optional().or(z.literal('')),
    sellerTaxId: z.string().optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    const merchantIdMax = data.provider === 'ezpay' ? 15 : 10
    if (data.merchantId && data.merchantId.length > merchantIdMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['merchantId'],
        message: `${data.provider === 'ezpay' ? 'ezPay' : 'ECPay'} MerchantID 不可超過 ${merchantIdMax} 個字元`,
      })
    }
    // 賣方統編若有填，需為 8 碼數字
    if (data.sellerTaxId && !UBN_REGEX.test(data.sellerTaxId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sellerTaxId'],
        message: '賣方統一編號需為 8 碼數字',
      })
    }
    // HashIV 若有填，需為 16 碼（綠界與藍新皆為 16）
    if (data.hashIV && data.hashIV.length !== 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hashIV'],
        message: 'HashIV 必須為 16 個字',
      })
    }
    // HashKey 若有填：綠界 16 碼、藍新 32 碼
    if (data.hashKey) {
      const expected = data.provider === 'ezpay' ? 32 : 16
      if (data.hashKey.length !== expected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hashKey'],
          message: `HashKey 必須為 ${expected} 個字`,
        })
      }
    }
  })

export type EInvoiceSettingsFormData = z.infer<typeof einvoiceSettingsSchema>

// ---------------------------------------------------------------------------
// 2. 結帳頁買受人發票資訊
// ---------------------------------------------------------------------------

export const INVOICE_TYPES = ['PERSONAL', 'COMPANY', 'DONATION'] as const
export type CheckoutInvoiceType = (typeof INVOICE_TYPES)[number]

/** 個人載具類別：手機條碼 / 會員載具（雲端發票存加值中心） */
export const PERSONAL_CARRIER_TYPES = ['mobile', 'member'] as const

export const checkoutInvoiceSchema = z
  .object({
    invoiceType: z.enum(INVOICE_TYPES).default('PERSONAL'),
    carrierType: z.enum(PERSONAL_CARRIER_TYPES).optional(),
    carrierId: z.string().max(64).optional().or(z.literal('')),
    taxId: z.string().max(8).optional().or(z.literal('')),
    title: z.string().max(60, '公司抬頭不可超過 60 個字').optional().or(z.literal('')),
    address: z.string().max(100, '公司地址不可超過 100 個字').optional().or(z.literal('')),
    loveCode: z.string().max(7).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.invoiceType === 'COMPANY') {
      // L54：結帳前即驗證統編檢查碼，避免付款後開立發票才失敗
      if (!data.taxId || !isValidTaiwanUBN(data.taxId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['taxId'],
          message: '統一編號有誤，請確認 8 碼數字與檢查碼',
        })
      }
      if (!data.title) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['title'],
          message: '請輸入公司抬頭',
        })
      }
      // 綠界三聯式為紙本開立，需要買受人地址；統一要求公司戶填寫以確保各加值中心皆能開立
      if (!data.address) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['address'],
          message: '請輸入公司地址（開立三聯式發票需要）',
        })
      }
    }

    if (data.invoiceType === 'PERSONAL' && data.carrierType === 'mobile') {
      if (!data.carrierId || !MOBILE_BARCODE_REGEX.test(data.carrierId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['carrierId'],
          message: '手機條碼格式為 / 開頭加 7 碼（如 /AB12345）',
        })
      }
    }

    if (data.invoiceType === 'DONATION') {
      if (!data.loveCode || !LOVE_CODE_REGEX.test(data.loveCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['loveCode'],
          message: '捐贈碼為 3-7 碼數字',
        })
      }
    }
  })

export type CheckoutInvoiceInput = z.infer<typeof checkoutInvoiceSchema>
