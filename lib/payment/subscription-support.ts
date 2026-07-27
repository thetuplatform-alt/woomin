// lib/payment/subscription-support.ts
// 「當前金流是否支援訂閱」的單一 helper（fail-closed）。
//
// 硬性規定（PRD §2）：
// - 以 getActiveGatewayType() + 靜態 capability 對照表回答
// - 不實例化 gateway、不驗憑證、絕不 throw
// - 未設定金流 / 任何錯誤一律回 false
// 銷售頁、結帳、/api/payment/create、後台方案區塊皆以它 gating，
// 未設金流的客戶站銷售頁不得因此 500。

import { getActiveGatewayType } from './gateway-factory'
import type { PaymentGatewayType } from './types'

/**
 * 各金流對訂閱制的靜態能力宣告。
 * SHOPLINE v1 降級（需嵌入式綁卡 SDK + 3DS，與現有導轉式整合不同）。
 */
export const SUBSCRIPTION_CAPABILITY: Record<PaymentGatewayType, boolean> = {
  stripe: true,
  payuni: true,
  shopline: false,
}

/**
 * 指定 gateway 類型是否（靜態上）支援訂閱。
 */
export function gatewayTypeSupportsSubscription(
  type: PaymentGatewayType
): boolean {
  return SUBSCRIPTION_CAPABILITY[type] === true
}

/**
 * 當前啟用的金流是否支援訂閱。
 * 任何查詢/設定錯誤（含未設定金流）一律 fail-closed 回 false，絕不 throw。
 */
export async function isSubscriptionSupported(): Promise<boolean> {
  try {
    const type = await getActiveGatewayType()
    return gatewayTypeSupportsSubscription(type)
  } catch {
    return false
  }
}
