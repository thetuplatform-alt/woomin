// lib/utils/price.ts
// 價格計算共用工具
// 統一處理促銷價格邏輯

/**
 * 價格資訊
 */
export interface PriceInfo {
  /** 原價 */
  originalPrice: number
  /** 促銷價（若有效） */
  salePrice: number | null
  /** 促銷截止日期 */
  saleEndAt: Date | null
  /** 促銷說明文字 */
  saleLabel?: string | null
  /** 是否啟用永久促銷循環 */
  saleCycleEnabled?: boolean
  /** 循環天數 */
  saleCycleDays?: number | null
}

/**
 * 價格計算結果
 */
export interface PriceResult {
  /** 最終顯示價格 */
  finalPrice: number
  /** 是否為促銷價 */
  isOnSale: boolean
  /** 折扣百分比（0-100），若無促銷則為 0 */
  discountPercent: number
  /** 促銷說明文字（如「開工優惠」「限時早鳥」），fallback 為「限時優惠」 */
  saleLabel: string
  /** 倒數計時目標時間（循環模式下會動態計算） */
  countdownTarget: Date | null
}

/**
 * 根據循環天數計算下一個倒數截止時間
 * 邏輯：以伺服器當前時間為基準，找出最近的下一個週期結束時間
 *
 * 例如 saleCycleDays = 3，baseDate（可由 server 提供）：
 * - 以 epoch (2000-01-01 00:00 UTC+8) 為固定錨點
 * - 計算從錨點到現在經過了多少個完整週期
 * - 下一個截止時間 = 錨點 + (已完成週期數 + 1) * 循環天數
 */
export function calculateCycleEndDate(saleCycleDays: number, now?: Date): Date {
  const currentTime = now || new Date()
  // 固定錨點：2000-01-01 00:00:00 UTC+8
  const anchor = new Date('2000-01-01T00:00:00+08:00')
  const msPerDay = 24 * 60 * 60 * 1000
  const cycleDurationMs = saleCycleDays * msPerDay

  const elapsed = currentTime.getTime() - anchor.getTime()
  const completedCycles = Math.floor(elapsed / cycleDurationMs)
  const nextCycleEnd = new Date(anchor.getTime() + (completedCycles + 1) * cycleDurationMs)

  return nextCycleEnd
}

/**
 * 檢查促銷價是否有效
 * 規則：
 * 1. salePrice 必須存在且大於等於 0（允許免費促銷）
 * 2. 如果啟用循環模式，永遠有效
 * 3. 如果 saleEndAt 存在，必須在未來
 * 4. 如果 saleEndAt 為 null，視為永久促銷
 */
export function isSalePriceValid(
  salePrice: number | null,
  saleEndAt: Date | null,
  saleCycleEnabled?: boolean
): boolean {
  // 促銷價必須存在且大於等於 0（允許免費）
  if (salePrice === null || salePrice < 0) return false

  // 循環模式下永遠有效
  if (saleCycleEnabled) return true

  // 如果沒有截止日期，視為永久促銷
  if (!saleEndAt) return true

  // 檢查截止日期是否在未來
  return new Date(saleEndAt) > new Date()
}

/**
 * 計算價格（統一邏輯）
 * @param priceInfo - 價格資訊
 * @returns 價格計算結果
 */
export function calculatePrice(priceInfo: PriceInfo): PriceResult {
  const {
    originalPrice,
    salePrice,
    saleEndAt,
    saleLabel: saleLabelInput,
    saleCycleEnabled,
    saleCycleDays,
  } = priceInfo

  const isOnSale = isSalePriceValid(salePrice, saleEndAt, saleCycleEnabled)
  const finalPrice = isOnSale ? salePrice! : originalPrice

  // 計算折扣百分比
  let discountPercent = 0
  if (isOnSale && originalPrice > 0) {
    discountPercent = Math.round((1 - finalPrice / originalPrice) * 100)
  }

  // 促銷說明文字 fallback
  const saleLabel = saleLabelInput || '限時優惠'

  // 計算倒數目標時間
  let countdownTarget: Date | null = null
  if (isOnSale) {
    if (saleCycleEnabled && saleCycleDays) {
      countdownTarget = calculateCycleEndDate(saleCycleDays)
    } else if (saleEndAt) {
      countdownTarget = new Date(saleEndAt)
    }
  }

  return {
    finalPrice,
    isOnSale,
    discountPercent,
    saleLabel,
    countdownTarget,
  }
}

/**
 * 格式化價格為千分位格式
 * @param price - 價格數值
 * @returns 格式化後的價格字串 (如 NT$ 1,990)
 */
export function formatPrice(price: number): string {
  if (price === 0) return '免費'
  return `NT$ ${price.toLocaleString('zh-TW')}`
}
