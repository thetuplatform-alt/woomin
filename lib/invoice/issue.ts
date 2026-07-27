// lib/invoice/issue.ts
// 把平台訂單資料對映成 @paid-tw/einvoice 的開立 / 折讓輸入。

import { createHash } from 'node:crypto'
import {
  splitTaxInclusive,
  CarrierType,
  TaxType,
  PriceMode,
  type IssueInvoiceInput,
  type AllowanceInput,
} from '@paid-tw/einvoice'

/** 訂單上的買受人發票偏好（結帳時收集，存於 Order）。 */
export interface OrderInvoicePreference {
  invoiceType: 'PERSONAL' | 'COMPANY' | 'DONATION' | null
  carrierType: string | null
  carrierId: string | null
  taxId: string | null
  title: string | null
  loveCode: string | null
  /** 買方地址（公司三聯式紙本開立 / 寄送用；個人若有提供也帶入）。 */
  address: string | null
}

export interface BuildIssueParams {
  /** 對映 provider 的 orderId（用平台 orderNo，供加值中心對帳與冪等）。 */
  orderNo: string
  /** 含稅總額（= Order.amount）。 */
  amount: number
  /** 品名（課程 / 組合包標題）。 */
  itemName: string
  buyerName?: string | null
  buyerEmail?: string | null
  preference: OrderInvoicePreference
  /**
   * 目標加值中心。影響「公司戶（B2B）」的品項金額表示法：
   * 藍新（ezpay）三聯式要求品項為未稅；綠界（ecpay）與所有 B2C 一律含稅。
   */
  provider?: 'ecpay' | 'ezpay'
}

const ITEM_NAME_LIMITS = {
  ecpay: 500,
  ezpay: 30,
} as const
const EZPAY_MAX_ORDER_ID_LENGTH = 20

function normalizeItemName(name: string, provider: 'ecpay' | 'ezpay'): string {
  const trimmed = (name || '商品').trim()
  const maxLength = ITEM_NAME_LIMITS[provider]
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function normalizeBuyerName(
  name: string | null | undefined,
  provider: 'ecpay' | 'ezpay',
  isCompany: boolean
): string | undefined {
  const value = name?.trim()
  if (!value) return undefined
  // ezPay B2C 買受人名稱上限 30，B2B 及 ECPay CustomerName 上限 60。
  const maxLength = provider === 'ezpay' && !isCompany ? 30 : 60
  return value.slice(0, maxLength)
}

/**
 * ezPay 的 MerchantOrderNo 最多 20 字；平台內部訂單編號維持原樣，
 * 只在送往 ezPay 時轉為固定值，確保同一張訂單重試仍使用相同單號。
 */
export function normalizeProviderOrderId(orderNo: string, provider?: 'ecpay' | 'ezpay'): string {
  const normalized = orderNo.trim()
  if (provider !== 'ezpay' || normalized.length <= EZPAY_MAX_ORDER_ID_LENGTH) {
    return normalized
  }

  return `EZ${createHash('sha256').update(normalized).digest('hex').slice(0, 18)}`
}

/**
 * 由訂單資料組出開立發票輸入。
 * - 金額一律以「含稅總額」為基準，用 splitTaxInclusive 拆出銷售額與稅額（5%）作為 amount summary。
 * - 公司（COMPANY）→ 帶買方統編 + 抬頭 + 地址（SDK 自動判定為 B2B 三聯式）。
 *   · 藍新（ezpay）B2B：品項金額須為「未稅」（PriceMode=TAX_EXCLUSIVE），Σ品項 = 未稅銷售額。
 *   · 綠界（ecpay）B2B / 所有 B2C：品項金額為「含稅」（PriceMode=TAX_INCLUSIVE）。
 * - 個人（PERSONAL）一律帶載具，避免落入「無載具 → 加值中心開立紙本（需地址）」而開立失敗：
 *   · 手機條碼 → MOBILE_BARCODE 載具。
 *   · 會員載具 / 未指定 → MEMBER 載具（雲端發票，綠界 CarrierType=1、藍新 CarrierType=2，以 email 歸戶）。
 * - 捐贈（DONATION）→ 帶 npoban 愛心碼。
 */
export function buildIssueInput(params: BuildIssueParams): IssueInvoiceInput {
  const provider = params.provider ?? 'ecpay'
  const summary = splitTaxInclusive(params.amount)
  const pref = params.preference
  const isCompany = pref.invoiceType === 'COMPANY' && !!pref.taxId
  const itemName = normalizeItemName(params.itemName, provider)
  const providerOrderId = normalizeProviderOrderId(params.orderNo, params.provider)
  const buyerEmail = params.buyerEmail?.trim() || undefined

  if (provider === 'ezpay' && buyerEmail && buyerEmail.length > 50) {
    throw new Error('ezPay 買受人 Email 不可超過 50 個字元')
  }

  // 僅「藍新 + 公司戶（B2B）」採未稅品項；其餘（綠界全部、以及任何 B2C）維持含稅品項。
  const useTaxExclusiveItems = provider === 'ezpay' && isCompany
  const lineAmount = useTaxExclusiveItems ? summary.salesAmount : params.amount
  const priceMode = useTaxExclusiveItems
    ? PriceMode.TAX_EXCLUSIVE
    : PriceMode.TAX_INCLUSIVE

  const input: IssueInvoiceInput = {
    orderId: providerOrderId,
    buyer: {
      name: isCompany
        ? normalizeBuyerName(pref.title, provider, true)
        : normalizeBuyerName(params.buyerName, provider, false),
      ubn: isCompany ? pref.taxId ?? undefined : undefined,
      email: buyerEmail,
      // 公司三聯式（綠界紙本）需要買受人地址才能開立；個人若有提供也一併帶入。
      address: pref.address || undefined,
    },
    items: [
      {
        description: itemName,
        quantity: 1,
        unitPrice: lineAmount,
        amount: lineAmount,
      },
    ],
    amount: summary,
    taxType: TaxType.TAXABLE,
    priceMode,
    // ezPay SDK 會在組出 payload 的最後套用 providerOptions；明確鎖住最終 MerchantOrderNo，
    // 避免任何上游或相容層把 20 字短單號覆蓋回平台原始單號。ECPay 不帶此欄位。
    providerOptions:
      params.provider === 'ezpay' ? { MerchantOrderNo: providerOrderId } : undefined,
  }

  if (pref.invoiceType === 'DONATION' && pref.loveCode) {
    input.donation = { npoban: pref.loveCode }
  } else if (pref.invoiceType === 'PERSONAL') {
    if (pref.carrierType === 'mobile' && pref.carrierId) {
      input.carrier = { type: CarrierType.MOBILE_BARCODE, code: pref.carrierId }
    } else {
      if (!buyerEmail) {
        throw new Error('個人會員載具必須有買受人 Email')
      }
      // ezPay CarrierType=2 明確要求 CarrierNum；ECPay CarrierType=1 要求留空，由 Email 歸戶。
      input.carrier = {
        type: CarrierType.MEMBER,
        code: provider === 'ezpay' ? buyerEmail : undefined,
      }
    }
  }

  return input
}

/**
 * 由發票號碼與金額組出「全額折讓」輸入（退款 / 退課沖銷用）。
 */
export function buildAllowanceInput(params: {
  provider: 'ecpay' | 'ezpay'
  invoiceNumber: string
  allowanceId: string
  originalOrderId: string
  amount: number
  itemName: string
  invoiceDate?: Date | null
  buyerEmail?: string | null
  /** ezPay B2B 原發票以未稅品項開立，折讓也必須拆出營業稅。 */
  taxExclusive?: boolean
}): AllowanceInput {
  const amount = splitTaxInclusive(params.amount)
  const itemName = normalizeItemName(params.itemName, params.provider)
  const useTaxExclusiveItems = params.provider === 'ezpay' && params.taxExclusive === true
  const lineAmount = useTaxExclusiveItems ? amount.salesAmount : params.amount
  return {
    invoiceNumber: params.invoiceNumber,
    allowanceId: params.allowanceId,
    items: [
      {
        description: itemName,
        quantity: 1,
        unitPrice: lineAmount,
        amount: lineAmount,
      },
    ],
    amount,
    date: params.invoiceDate ?? undefined,
    providerOptions:
      params.provider === 'ezpay'
        ? {
            // ezPay 規格：折讓 MerchantOrderNo 必須是原發票開立時的自訂編號。
            merchantOrderNo: params.originalOrderId,
            // B2B 原發票使用未稅品項，折讓需拆出稅額；B2C 含稅品項則依規格填 0。
            taxRate: useTaxExclusiveItems ? 0.05 : 0,
            buyerEmail: params.buyerEmail?.trim() || undefined,
          }
        : undefined,
  }
}
