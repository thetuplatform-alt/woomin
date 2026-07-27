import { createHash, timingSafeEqual } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEInvoiceConfig, isEInvoiceConfigured } from './config'
import { createEcpayInvoiceProvider } from './provider'
import { isInvoiceError } from '@paid-tw/einvoice'

export interface EcpayAllowanceCallback {
  RtnCode: string
  RtnMsg: string
  IA_Allow_No: string
  IA_Invoice_No: string
  IA_Date: string
  IIS_Remain_Allowance_Amt: string
  CheckMacValue: string
}

const CALLBACK_KEYS = [
  'IA_Allow_No',
  'IA_Date',
  'IA_Invoice_No',
  'IIS_Remain_Allowance_Amt',
  'RtnCode',
  'RtnMsg',
] as const

/** ECPay 發票舊式 CheckMacValue 所需的 RFC1866 / .NET 相容 URL encode。 */
function ecpayUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/'/g, '%27')
    .replace(/~/g, '%7E')
}

export function createEcpayAllowanceCheckMac(
  input: Omit<EcpayAllowanceCallback, 'CheckMacValue'>,
  hashKey: string,
  hashIV: string,
  algorithm: 'md5' | 'sha256' = 'md5'
): string {
  const query = CALLBACK_KEYS.map((key) => `${key}=${input[key]}`).join('&')
  const encoded = ecpayUrlEncode(`HashKey=${hashKey}&${query}&HashIV=${hashIV}`).toLowerCase()
  return createHash(algorithm).update(encoded).digest('hex').toUpperCase()
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a.toUpperCase())
  const right = Buffer.from(b.toUpperCase())
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * 官方附錄目前指定 MD5，但線上折讓頁的回傳範例是 64 碼 SHA256。
 * 兩者都以同一組密鑰與完整字段驗證，兼容接收可避免官方文件差異中斷回傳。
 */
export function verifyEcpayAllowanceCheckMac(
  input: EcpayAllowanceCallback,
  hashKey: string,
  hashIV: string
): boolean {
  const fields = {
    RtnCode: input.RtnCode,
    RtnMsg: input.RtnMsg,
    IA_Allow_No: input.IA_Allow_No,
    IA_Invoice_No: input.IA_Invoice_No,
    IA_Date: input.IA_Date,
    IIS_Remain_Allowance_Amt: input.IIS_Remain_Allowance_Amt,
  }
  return (
    safeEqual(input.CheckMacValue, createEcpayAllowanceCheckMac(fields, hashKey, hashIV, 'md5')) ||
    safeEqual(input.CheckMacValue, createEcpayAllowanceCheckMac(fields, hashKey, hashIV, 'sha256'))
  )
}

function callbackJson(input: EcpayAllowanceCallback): Prisma.InputJsonValue {
  return {
    source: 'ecpay-online-allowance-callback',
    RtnCode: input.RtnCode,
    RtnMsg: input.RtnMsg,
    IA_Allow_No: input.IA_Allow_No,
    IA_Invoice_No: input.IA_Invoice_No,
    IA_Date: input.IA_Date,
    IIS_Remain_Allowance_Amt: input.IIS_Remain_Allowance_Amt,
  }
}

const CLEAR_ALLOWANCE_OPERATION = {
  operationType: null,
  operationAmount: null,
  operationBaseAllowanceTotal: null,
  operationStartedAt: null,
} as const

function formatTaiwanDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

/**
 * 線上折讓買受人確認回傳。
 *
 * 一般情況以 pending number CAS；若 ECPay 已收件但本機在寫入 pending 前中斷，
 * 則以呼叫前留下的 operation 金額快照復原，避免成功回呼被錯誤拒絕。
 */
export async function confirmEcpayOnlineAllowance(
  input: EcpayAllowanceCallback
): Promise<{ success: boolean; error?: string }> {
  if (input.RtnCode !== '1') return { success: false, error: `ECPay 折讓回傳失敗：${input.RtnMsg}` }
  if (!/^\d{16}$/.test(input.IA_Allow_No)) return { success: false, error: '折讓單號格式錯誤' }
  if (!/^[A-Z]{2}\d{8}$/.test(input.IA_Invoice_No)) return { success: false, error: '發票號碼格式錯誤' }

  const remaining = Number(input.IIS_Remain_Allowance_Amt)
  if (!Number.isInteger(remaining) || remaining < 0) {
    return { success: false, error: '折讓剩餘金額格式錯誤' }
  }

  const invoice = await prisma.invoice.findFirst({
    where: { provider: 'ecpay', invoiceNumber: input.IA_Invoice_No },
  })
  if (!invoice) return { success: false, error: '找不到對應發票' }

  // ECPay 可能重送 callback；本地已確認過時直接成功回應。
  if (
    invoice.allowancePendingNumber == null &&
    invoice.allowanceNumber === input.IA_Allow_No
  ) {
    return { success: true }
  }
  const isKnownPending = invoice.allowancePendingNumber === input.IA_Allow_No
  const isRecoverableUnknownOperation =
    invoice.allowancePendingNumber == null &&
    invoice.operationType === 'ALLOWANCE' &&
    invoice.operationAmount != null &&
    invoice.operationAmount > 0 &&
    invoice.operationBaseAllowanceTotal != null

  if (!isKnownPending && !isRecoverableUnknownOperation) {
    return { success: false, error: '折讓單號與待確認記錄不符' }
  }
  if (remaining > invoice.amount) return { success: false, error: '折讓剩餘金額超過發票金額' }

  const confirmedTotal = invoice.amount - remaining
  const baseTotal = isKnownPending
    ? invoice.allowanceTotal
    : invoice.operationBaseAllowanceTotal!
  const expectedAmount = isKnownPending
    ? (invoice.allowancePendingAmount ?? 0)
    : invoice.operationAmount!
  if (
    expectedAmount <= 0 ||
    baseTotal < 0 ||
    baseTotal + expectedAmount > invoice.amount ||
    confirmedTotal !== baseTotal + expectedAmount
  ) {
    return { success: false, error: '折讓累計金額與本地記錄不符' }
  }

  const updated = await prisma.invoice.updateMany({
    where: {
      id: invoice.id,
      allowanceTotal: baseTotal,
      OR: isKnownPending
        ? [{ allowancePendingNumber: input.IA_Allow_No }]
        : [
            {
              allowancePendingNumber: null,
              operationType: 'ALLOWANCE',
              operationAmount: expectedAmount,
              operationBaseAllowanceTotal: baseTotal,
            },
          ],
    },
    data: {
      status: 'ALLOWANCE',
      allowanceNumber: input.IA_Allow_No,
      allowanceAmount: expectedAmount,
      allowanceTotal: confirmedTotal,
      allowancePendingNumber: null,
      allowancePendingAmount: null,
      allowancePendingExpiresAt: null,
      failReason: null,
      rawResponse: callbackJson(input),
      ...CLEAR_ALLOWANCE_OPERATION,
    },
  })

  if (updated.count !== 1) return { success: false, error: '折讓狀態已被其他請求更新' }
  return { success: true }
}

/**
 * callback 遺失的兡底對帳。ECPay 查詢 API 會排除未確認的線上折讓：
 * - 查得到：代表買受人已確認，回填本地。
 * - 到期後查不到：代表未確認，釋放本地 pending 供管理員重送。
 */
export async function reconcileExpiredEcpayOnlineAllowances(
  limit = 25,
  deadline = Number.POSITIVE_INFINITY
): Promise<{ checked: number; confirmed: number; expired: number; failed: number }> {
  const result = { checked: 0, confirmed: 0, expired: 0, failed: 0 }
  const config = await getEInvoiceConfig()
  if (!config.enabled || config.provider !== 'ecpay' || !isEInvoiceConfigured(config)) return result

  const now = new Date()
  const unknownOperationExpiry = new Date(now.getTime() - 73 * 60 * 60 * 1000)
  const pending = await prisma.invoice.findMany({
    where: {
      provider: 'ecpay',
      OR: [
        {
          allowancePendingNumber: { not: null },
          allowancePendingExpiresAt: { lte: now },
        },
        {
          allowancePendingNumber: null,
          operationType: 'ALLOWANCE',
          operationStartedAt: { lte: unknownOperationExpiry },
        },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })
  for (const invoice of pending) {
    const requestBudget = deadline - Date.now() - 250
    if (requestBudget <= 250) break
    // 每筆查詢重新計算剩餘時間，避免前一筆耗時後仍沿用過大的 timeout。
    const provider = createEcpayInvoiceProvider(
      config,
      Number.isFinite(requestBudget) ? Math.min(8_000, requestBudget) : undefined
    )
    result.checked++
    const allowanceNumber = invoice.allowancePendingNumber
    const expectedAmount = allowanceNumber
      ? (invoice.allowancePendingAmount ?? 0)
      : (invoice.operationAmount ?? 0)
    const baseTotal = allowanceNumber
      ? invoice.allowanceTotal
      : (invoice.operationBaseAllowanceTotal ?? invoice.allowanceTotal)
    const reference = allowanceNumber ?? `invoice:${invoice.invoiceNumber ?? invoice.id}`
    try {
      let details: Awaited<ReturnType<typeof provider.getAllowanceList>> = []
      try {
        if (allowanceNumber) {
          details = await provider.getAllowanceList({ allowanceNumber })
        } else {
          if (!invoice.invoiceNumber || !invoice.invoiceDate) {
            throw new Error('缺少發票號碼或開立日期，無法對帳未知結果的線上折讓')
          }
          details = await provider.getAllowanceList({
            invoiceNumber: invoice.invoiceNumber,
            date: formatTaiwanDate(invoice.invoiceDate),
            dateType: 'ISSUE',
          })
        }
      } catch (error) {
        if (!isInvoiceError(error) || error.code !== 'NOT_FOUND') throw error
      }
      const activeDetails = details.filter((row) => !row.voided)
      const detail = allowanceNumber
        ? activeDetails.find((row) => row.allowanceNumber === allowanceNumber)
        : [...activeDetails].sort(
            (a, b) => b.allowanceDate.getTime() - a.allowanceDate.getTime()
          )[0]
      const remoteTotal = activeDetails.reduce((sum, row) => sum + row.totalAmount, 0)

      if (detail && (allowanceNumber || remoteTotal === baseTotal + expectedAmount)) {
        if (
          expectedAmount <= 0 ||
          detail.totalAmount !== expectedAmount ||
          baseTotal + expectedAmount > invoice.amount
        ) {
          throw new Error(
            `ECPay 折讓 ${reference} 金額與本地操作快照不符`
          )
        }
        const updated = await prisma.invoice.updateMany({
          where: {
            id: invoice.id,
            allowanceTotal: baseTotal,
            ...(allowanceNumber
              ? { allowancePendingNumber: allowanceNumber }
              : {
                  allowancePendingNumber: null,
                  operationType: 'ALLOWANCE',
                  operationAmount: expectedAmount,
                  operationBaseAllowanceTotal: baseTotal,
                }),
          },
          data: {
            status: 'ALLOWANCE',
            allowanceNumber: detail.allowanceNumber,
            allowanceAmount: expectedAmount,
            allowanceTotal: baseTotal + expectedAmount,
            allowancePendingNumber: null,
            allowancePendingAmount: null,
            allowancePendingExpiresAt: null,
            failReason: null,
            rawResponse: detail.raw as Prisma.InputJsonValue,
            ...CLEAR_ALLOWANCE_OPERATION,
          },
        })
        if (updated.count === 1) result.confirmed++
        continue
      }

      const updated = await prisma.invoice.updateMany({
        where: {
          id: invoice.id,
          ...(allowanceNumber
            ? { allowancePendingNumber: allowanceNumber }
            : { allowancePendingNumber: null, operationType: 'ALLOWANCE' }),
        },
        data: {
          allowancePendingNumber: null,
          allowancePendingAmount: null,
          allowancePendingExpiresAt: null,
          failReason: `線上折讓 ${reference} 已逾 72 小時未確認，請重新發送`,
          ...CLEAR_ALLOWANCE_OPERATION,
        },
      })
      if (updated.count === 1) result.expired++
    } catch (error) {
      result.failed++
      console.error('[ECPay Allowance] 逾期對帳失敗:', reference, error)
    }
  }

  return result
}
