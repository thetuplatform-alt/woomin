// lib/payment/types.ts
// 金流閘道統一介面定義

import type {
  CourseSubscription,
  CourseSubscriptionPlan,
} from '@prisma/client'
import type { ShoplinePaymentMethodCode } from './shopline-methods'

/**
 * 支援的金流閘道類型
 * 順序即為業務主推順序：Shopline Payments 為首選，其次 Stripe，最後 PAYUNi
 */
export type PaymentGatewayType = 'shopline' | 'stripe' | 'payuni'

/**
 * 建立付款的統一結果
 */
export interface CreatePaymentResult {
  /** Stripe / Shopline: 'redirect'（跳轉到 hosted checkout）
   *  PAYUNi: 'form_post'（透過靜態頁 POST 表單到 PAYUNi） */
  type: 'redirect' | 'form_post'
  /** Stripe / Shopline 用：Checkout Session URL */
  checkoutUrl?: string
  /** PAYUNi 用：加密後的表單資料 */
  formData?: {
    apiUrl: string
    MerID: string
    Version: string
    EncryptInfo: string
    HashInfo: string
  }
  /** Gateway 回傳的 session/trade ID（用於存入 Order） */
  gatewaySessionId?: string
  /** Gateway 回傳的 payment reference ID（用於退款等） */
  gatewayPaymentId?: string
}

/**
 * 建立付款會話的參數
 */
export interface CreatePaymentSessionParams {
  order: { id: string; orderNo: string; amount: number }
  course: { title: string; subtitle: string | null }
  customerEmail: string | null
  customerName?: string | null
  customerPhone?: string | null
  baseUrl: string
  identityType: 'auth' | 'guest_shell'
  userId: string
  courseId?: string | null
  bundleId?: string | null
  // Stripe 專用：預建的 Price ID
  isOnSale: boolean
  stripePriceId?: string | null
  stripeSalePriceId?: string | null
  // Shopline 專用：customer IP
  clientIpAddress?: string | null
}

/**
 * 建立訂閱結帳會話的參數。
 *
 * 由 lib/subscription/service.ts 的 createSubscriptionCheckout 在建單交易後呼叫。
 * 傳入的 subscription 為已建立的 PENDING 訂閱、order 為預建的第 1 期 PENDING Order。
 */
export interface CreateSubscriptionSessionParams {
  /** 已建立的 PENDING 訂閱（含方案快照、gatewayTradeNo） */
  subscription: CourseSubscription
  /** 方案（含 stripePriceId、totalPeriods、interval 等原始設定） */
  plan: CourseSubscriptionPlan
  /** 預建的第 1 期 Order（PENDING，periodNumber=1） */
  order: { id: string; orderNo: string; amount: number }
  /** 訂閱者 */
  user: {
    id: string
    email: string | null
    /** 既有 Stripe 顧客識別（無則 gateway 內部 find-or-create 後回寫） */
    stripeCustomerId?: string | null
  }
  /** 課程標題（結帳頁 / gateway 商品名稱顯示用） */
  courseTitle: string
  /** 站台基底 URL（組 success / notify / return URL） */
  baseUrl: string
}

/**
 * 退款處理結果
 */
export interface RefundResult {
  success: boolean
  error?: string
  gatewayRefundId?: string
  /**
   * 某些金流（如 PAYUNi）無自動退款 API，回報 success 僅代表「可標記為退款」，
   * 實際金流退款需人工至金流後台操作。此旗標為 true 時，呼叫端需提示管理員手動退款。
   */
  requiresManualAction?: boolean
  /** provider 已接受但尚未完成；等 webhook/對帳後才能標記 REFUNDED。 */
  pending?: boolean
}

/**
 * 金流閘道統一介面
 */
export interface PaymentGateway {
  readonly type: PaymentGatewayType

  /** 建立付款會話 */
  createPaymentSession(
    params: CreatePaymentSessionParams
  ): Promise<CreatePaymentResult>

  /** 處理退款 */
  processRefund(params: {
    gatewayPaymentId: string | null
    /** 內部訂單編號，用於組成 gateway 端的冪等鍵（避免重複退款） */
    orderNo?: string
  }): Promise<RefundResult>

  /** 測試連線 */
  testConnection(): Promise<{ success: boolean; message: string }>

  /** 取得設定摘要（遮罩敏感資料） */
  getSettingsSummary(baseUrl: string): {
    keyHint: string
    isTestMode: boolean
    webhookUrl: string
  }

  // ==================== 課程訂閱制（可選能力）====================
  //
  // 以下三個方法為可選：不支援訂閱的 gateway（如 SHOPLINE v1）不需實作，
  // 「當前 gateway 是否支援訂閱」統一由 lib/payment/subscription-support.ts
  // 的靜態 capability 表回答（fail-closed），呼叫端據此 gating，不靠實例化探測。

  /** 此 gateway 是否支援訂閱（靜態能力宣告；未定義視為 false） */
  readonly supportsSubscription?: boolean

  /** 建立訂閱結帳會話（沿用 CreatePaymentResult 的 redirect / form_post 形狀） */
  createSubscriptionSession?(
    params: CreateSubscriptionSessionParams
  ): Promise<CreatePaymentResult>

  /** 取消訂閱（先 gateway 後本地；PAYUNi mdfStatus end / Stripe subscriptions.cancel） */
  cancelSubscription?(params: {
    subscription: CourseSubscription
  }): Promise<{ success: boolean; error?: string }>
}

/**
 * 金流設定（存在 SiteSetting 中的格式）
 */
export interface PaymentGatewaySettings {
  gateway: PaymentGatewayType
  shopline: {
    merchantId: string
    apiKey: string
    clientKey: string
    signKey: string
    testMode: boolean
    enabledPaymentMethods: ShoplinePaymentMethodCode[]
  }
  stripe: {
    secretKey: string
    webhookSecret: string
  }
  payuni: {
    merchantId: string
    hashKey: string
    hashIV: string
    testMode: boolean
  }
}
