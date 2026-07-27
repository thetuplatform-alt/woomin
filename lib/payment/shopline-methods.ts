// SHOPLINE Payments payment method helpers.
// Keep API method codes centralized because SHOPLINE may adjust naming per contract.

export const SHOPLINE_PAYMENT_METHOD_CODES = [
  'CreditCard',
  'ApplePay',
  'LinePay',
  'VirtualAccount',
] as const

export type ShoplinePaymentMethodCode =
  (typeof SHOPLINE_PAYMENT_METHOD_CODES)[number]

export const SHOPLINE_DEFAULT_PAYMENT_METHODS: ShoplinePaymentMethodCode[] = [
  'CreditCard',
  'ApplePay',
  'LinePay',
]

export const SHOPLINE_PAYMENT_METHOD_LABELS: Record<
  ShoplinePaymentMethodCode,
  string
> = {
  CreditCard: '信用卡',
  ApplePay: 'Apple Pay',
  LinePay: 'LINE Pay',
  // SHOPLINE Payments 文件將 ATM 銀行轉帳的 method code 標示為 VirtualAccount。
  // 若特店合約回傳不同代碼，只需調整此 centralized mapping。
  VirtualAccount: 'ATM 銀行轉帳',
}

const SUPPORTED_METHODS = new Set<string>(SHOPLINE_PAYMENT_METHOD_CODES)

function dedupeSupported(
  methods: readonly string[]
): ShoplinePaymentMethodCode[] {
  const seen = new Set<string>()
  const result: ShoplinePaymentMethodCode[] = []

  for (const method of methods) {
    if (!SUPPORTED_METHODS.has(method) || seen.has(method)) continue
    seen.add(method)
    result.push(method as ShoplinePaymentMethodCode)
  }

  return result
}

export function normalizeShoplinePaymentMethods(
  methods: readonly string[] | null | undefined
): ShoplinePaymentMethodCode[] {
  const normalized = dedupeSupported(methods || [])
  return normalized.length > 0
    ? normalized
    : [...SHOPLINE_DEFAULT_PAYMENT_METHODS]
}

export function parseShoplinePaymentMethods(
  raw: string | null | undefined
): ShoplinePaymentMethodCode[] {
  if (!raw) return [...SHOPLINE_DEFAULT_PAYMENT_METHODS]

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return normalizeShoplinePaymentMethods(parsed)
    }
  } catch {
    // Backward-compatible fallback for comma-separated env / DB values.
  }

  return normalizeShoplinePaymentMethods(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )
}

export function serializeShoplinePaymentMethods(
  methods: readonly string[] | null | undefined
): string {
  return JSON.stringify(normalizeShoplinePaymentMethods(methods))
}
