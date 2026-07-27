import type { PayUniResponse } from '@/lib/payment/payuni-crypto'
import { parseTaiwanBillingDate } from './calendar'

export interface PayUniPeriodQueryItem {
  index: number
  period: number
  expectedAuthorizationAt: string
  tradeNo: string
  subPeriodNo: string
  amount: number
  authCode: string
  statusDescription: string
  updatedAt: string
}

export interface PayUniPeriodQueryResult {
  status: string
  message: string
  merchantId: string
  merchantTradeNo: string
  periodTradeNo: string
  periodType: string
  totalTimes: number
  alreadyTimes: number
  items: PayUniPeriodQueryItem[]
  raw: PayUniResponse
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function integerValue(value: unknown, field: string): number {
  const raw = stringValue(value)
  if (!/^\d+$/.test(raw)) {
    throw new Error(`PAYUNi 查詢回應 ${field} 格式錯誤`)
  }
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`PAYUNi 查詢回應 ${field} 超出範圍`)
  }
  return parsed
}

/**
 * 將 PAYUNi /api/period/query 解密後的 PHP-style Result[0][Period] 欄位
 * 正規化為可驗證的結構。此函式不以 StatusDesc 文案判斷付款成功，成功證據由
 * AlreadyTimes、期別識別碼、交易序號與授權碼共同確認。
 */
export function parsePayUniPeriodQuery(
  response: PayUniResponse
): PayUniPeriodQueryResult {
  const status = stringValue(response.Status)
  if (status !== 'SUCCESS') {
    throw new Error(
      stringValue(response.Message) || `PAYUNi 續期訂單查詢失敗（${status || 'UNKNOWN'}）`
    )
  }

  const totalTimes = integerValue(response.TotalTimes, 'TotalTimes')
  const alreadyTimes = integerValue(response.AlreadyTimes, 'AlreadyTimes')
  if (totalTimes < 1 || totalTimes > 900 || alreadyTimes > totalTimes) {
    throw new Error('PAYUNi 查詢回應扣款期數不合理')
  }

  const grouped = new Map<number, Record<string, string>>()
  for (const [key, value] of Object.entries(response)) {
    const match = /^Result\[(\d+)]\[([A-Za-z0-9_]+)]$/.exec(key)
    if (!match) continue
    const index = Number(match[1])
    const field = match[2]
    if (!Number.isSafeInteger(index) || index < 0 || !field) continue
    const item = grouped.get(index) ?? {}
    item[field] = stringValue(value)
    grouped.set(index, item)
  }

  const items = [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, item]) => ({
      index,
      period: integerValue(item.Period, `Result[${index}].Period`),
      expectedAuthorizationAt: stringValue(item.ExpAuthDT),
      tradeNo: stringValue(item.TradeNo),
      subPeriodNo: stringValue(item.SubPeriodNo),
      amount: integerValue(item.Amt, `Result[${index}].Amt`),
      authCode: stringValue(item.AuthCode),
      statusDescription: stringValue(item.StatusDesc),
      updatedAt: stringValue(item.UpdateTime),
    }))

  if (items.length !== totalTimes) {
    throw new Error(
      `PAYUNi 查詢回應期款明細不完整（expected=${totalTimes}, received=${items.length}）`
    )
  }
  const periods = new Set(items.map((item) => item.period))
  if (
    periods.size !== items.length ||
    items.some((item) => item.period < 1 || item.period > totalTimes)
  ) {
    throw new Error('PAYUNi 查詢回應期別重複或超出範圍')
  }

  return {
    status,
    message: stringValue(response.Message),
    merchantId: stringValue(response.MerID),
    merchantTradeNo: stringValue(response.MerTradeNo),
    periodTradeNo: stringValue(response.PeriodTradeNo),
    periodType: stringValue(response.PeriodType),
    totalTimes,
    alreadyTimes,
    items,
    raw: response,
  }
}

/** 解析 PAYUNi 查詢回傳的台灣時間，只取帳務邊界所需的日曆日期。 */
export function parsePayUniQueryBillingDate(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ +T].*)?$/.exec(value.trim())
  return match ? parseTaiwanBillingDate(match[1]) : null
}

/**
 * 查詢明細中首期已成功的保守證據。AlreadyTimes 僅代表成功期數，因此仍要求
 * 首期的 provider 訂單編號、交易序號與授權碼完整，避免把失敗明細誤入帳。
 */
export function getPaidFirstPayUniPeriod(
  query: PayUniPeriodQueryResult,
  expectedMerchantTradeNo: string
): PayUniPeriodQueryItem | null {
  const first = query.items.find((item) => item.period === 1)
  if (
    query.alreadyTimes < 1 ||
    !first ||
    first.subPeriodNo !== `${expectedMerchantTradeNo}_1` ||
    !first.tradeNo ||
    first.tradeNo === '-' ||
    !first.authCode ||
    first.amount < 2 ||
    first.amount > 199_999
  ) {
    return null
  }
  return first
}

/** 查詢資料是否含任何可能代表首期已授權的 provider 證據；用於 fail-closed 清理。 */
export function hasPayUniFirstPeriodPaymentEvidence(
  query: PayUniPeriodQueryResult
): boolean {
  const first = query.items.find((item) => item.period === 1)
  return Boolean(
    first &&
      ((first.tradeNo && first.tradeNo !== '-') ||
        first.subPeriodNo ||
        first.authCode)
  )
}
