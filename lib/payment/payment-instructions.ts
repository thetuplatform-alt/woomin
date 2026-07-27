import type { Prisma } from '@prisma/client'

export interface PendingPaymentInstructions {
  provider: 'shopline' | 'payuni'
  method: 'ATM' | 'CVS'
  bankCode: string | null
  bankName: string | null
  virtualAccount: string | null
  amount: number | null
  currency: string | null
  expiresAt: string | null
  message: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findRecord(
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key]
    if (isRecord(value)) return value
  }
  return null
}

function findString(
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function findNumber(
  source: Record<string, unknown>,
  keys: readonly string[]
): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function amountFromMinorUnits(value: number | null): number | null {
  if (value == null) return null
  return Number.isInteger(value) ? Math.round(value) / 100 : value
}

export function extractShoplineAtmInstructions(payload: unknown): {
  instructions: PendingPaymentInstructions | null
  expiresAt: Date | null
} {
  if (!isRecord(payload)) {
    return { instructions: null, expiresAt: null }
  }

  const data = isRecord(payload.data) ? payload.data : payload
  const payment = findRecord(data, ['payment', 'paymentDetail', 'paymentDetails'])
  const order = findRecord(data, ['order'])
  const atm =
    findRecord(data, [
      'virtualAccount',
      'atm',
      'atmInfo',
      'paymentInfo',
      'paymentInstructions',
      'bankTransfer',
    ]) ||
    (payment
      ? findRecord(payment, [
          'virtualAccount',
          'atm',
          'atmInfo',
          'paymentInfo',
          'paymentInstructions',
          'bankTransfer',
        ])
      : null) ||
    data

  const amountValue =
    (order && findRecord(order, ['amount'])
      ? findNumber(findRecord(order, ['amount'])!, ['value', 'amount'])
      : null) ??
    (payment && findRecord(payment, ['paidAmount', 'amount'])
      ? findNumber(findRecord(payment, ['paidAmount', 'amount'])!, ['value', 'amount'])
      : null) ??
    (findRecord(data, ['amount'])
      ? findNumber(findRecord(data, ['amount'])!, ['value', 'amount'])
      : null)

  const currency =
    (order && findRecord(order, ['amount'])
      ? findString(findRecord(order, ['amount'])!, ['currency'])
      : null) ??
    (payment && findRecord(payment, ['paidAmount', 'amount'])
      ? findString(findRecord(payment, ['paidAmount', 'amount'])!, ['currency'])
      : null) ??
    (findRecord(data, ['amount'])
      ? findString(findRecord(data, ['amount'])!, ['currency'])
      : null)

  const expiresAtText = findString(atm, [
    'expiresAt',
    'expireAt',
    'expiredAt',
    'paymentExpiresAt',
    'paymentExpireTime',
    'expireTime',
    'deadline',
    'dueDate',
  ])
  const expiresAt = parseDate(expiresAtText)

  const instructions: PendingPaymentInstructions = {
    provider: 'shopline',
    method: 'ATM',
    bankCode: findString(atm, [
      'bankCode',
      'BankCode',
      'bankNo',
      'bankId',
      'financialInstitutionCode',
    ]),
    bankName: findString(atm, ['bankName', 'BankName', 'bank']),
    virtualAccount: findString(atm, [
      'virtualAccount',
      'VirtualAccount',
      'account',
      'accountNo',
      'accountNumber',
      'bankAccount',
      'bankAccountNo',
      'paymentNo',
      'payCode',
    ]),
    amount: amountFromMinorUnits(amountValue),
    currency,
    expiresAt: expiresAt?.toISOString() ?? expiresAtText,
    message: findString(atm, ['message', 'instruction', 'paymentMessage']),
  }

  const hasVisibleInstruction = Boolean(
    instructions.bankCode ||
      instructions.bankName ||
      instructions.virtualAccount ||
      instructions.expiresAt
  )

  return {
    instructions: hasVisibleInstruction ? instructions : null,
    expiresAt,
  }
}

export function coercePendingPaymentInstructions(
  value: Prisma.JsonValue | null | undefined
): PendingPaymentInstructions | null {
  if (!isRecord(value)) return null
  const provider = value.provider === 'payuni' ? 'payuni' : value.provider === 'shopline' ? 'shopline' : null
  if (!provider) return null
  const method = value.method === 'CVS' ? 'CVS' : value.method === 'ATM' ? 'ATM' : null
  if (!method) return null

  return {
    provider,
    method,
    bankCode: findString(value, ['bankCode']),
    bankName: findString(value, ['bankName']),
    virtualAccount: findString(value, ['virtualAccount']),
    amount: findNumber(value, ['amount']),
    currency: findString(value, ['currency']),
    expiresAt: findString(value, ['expiresAt']),
    message: findString(value, ['message']),
  }
}

/**
 * 從 PAYUNi 背景通知的解密欄位擷取 ATM / CVS 取號待付款資訊（M24）。
 *
 * 註：PAYUNi UPP 對 ATM/CVS 取號的欄位命名以官方文件為準，此處以常見欄位名做容錯解析；
 * 啟用 ATM/CVS 前請對照實際回傳欄位驗證。回傳 null 表示此通知非取號（例如信用卡）。
 */
export function extractPayUniPaymentInstructions(
  decrypted: Record<string, unknown>
): { instructions: PendingPaymentInstructions | null; expiresAt: Date | null } {
  if (!isRecord(decrypted)) return { instructions: null, expiresAt: null }

  // 繳費帳號 / 代碼（ATM 為虛擬帳號，CVS 為繳費代碼）
  const payNo = findString(decrypted, [
    'PayNo',
    'CodeNo',
    'BarCode',
    'VirtualAccount',
    'Account',
  ])
  const bankCode = findString(decrypted, ['BankType', 'BankCode', 'Bank'])
  const storeType = findString(decrypted, ['StoreType', 'CVSType', 'CVSCOM'])
  const expiresText = findString(decrypted, [
    'ExpireDate',
    'ExpireTime',
    'PayEndDate',
    'ExpireDateTime',
  ])
  const expiresAt = parseDate(expiresText)
  const amount = findNumber(decrypted, ['TradeAmt', 'Amount'])

  // 無任何取號資訊 → 非 ATM/CVS 取號通知
  if (!payNo && !bankCode && !storeType) {
    return { instructions: null, expiresAt: null }
  }

  const method: 'ATM' | 'CVS' = bankCode ? 'ATM' : 'CVS'

  const instructions: PendingPaymentInstructions = {
    provider: 'payuni',
    method,
    bankCode,
    bankName: null,
    virtualAccount: payNo,
    amount,
    currency: 'TWD',
    expiresAt: expiresAt?.toISOString() ?? expiresText,
    message: storeType ? `超商代碼繳費（${storeType}）` : null,
  }

  return { instructions, expiresAt }
}
