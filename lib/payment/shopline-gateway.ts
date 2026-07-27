// lib/payment/shopline-gateway.ts
// SHOPLINE Payments 金流閘道實作（導轉式）
//
// API 文件：https://docs.shoplinepayments.com/
// - 建立 Session: POST /api/v1/trade/sessions/create
// - 建立退款:     POST /api/v1/trade/refund/create
// - Webhook:      HMAC-SHA256 驗簽，payload = `${timestamp}.${body}`

import crypto from 'crypto'
import type {
  PaymentGateway,
  CreatePaymentSessionParams,
  CreatePaymentResult,
} from './types'
import {
  normalizeShoplinePaymentMethods,
  type ShoplinePaymentMethodCode,
} from './shopline-methods'

const SANDBOX_BASE_URL = 'https://api-sandbox.shoplinepayments.com'
const LIVE_BASE_URL = 'https://api.shoplinepayments.com'

/**
 * 把用戶填寫的姓名拆成 firstName / lastName
 * Shopline 要求 lastName 必填；沒填時退回站名作為代替
 */
function splitName(raw: string | null | undefined): {
  firstName: string
  lastName: string
} {
  const trimmed = (raw || '').trim()
  if (!trimmed) return { firstName: '', lastName: '學員' }

  // 中文名：第一個字為姓（常見情況），其餘為名
  if (/^[\u4e00-\u9fa5]/.test(trimmed)) {
    if (trimmed.length === 1) return { firstName: '', lastName: trimmed }
    return {
      lastName: trimmed.slice(0, 1),
      firstName: trimmed.slice(1),
    }
  }

  // 英文名：用空白拆，最後一段為 lastName
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] }
  }
  return {
    lastName: parts[parts.length - 1],
    firstName: parts.slice(0, -1).join(' '),
  }
}

export interface ShoplineConfig {
  merchantId: string
  apiKey: string
  clientKey?: string
  signKey?: string
  testMode: boolean
  enabledPaymentMethods?: ShoplinePaymentMethodCode[]
}

interface ShoplineSessionResponse {
  sessionId: string
  referenceId: string
  status: string
  amount: { value: number; currency: string }
  sessionUrl: string
  createTime: string
  paymentDetails?: unknown[]
}

interface ShoplineErrorResponse {
  code: string
  msg: string
}

export class ShoplineGateway implements PaymentGateway {
  readonly type = 'shopline' as const
  private config: ShoplineConfig

  constructor(config: ShoplineConfig) {
    this.config = config
  }

  getBaseUrl(): string {
    return this.config.testMode ? SANDBOX_BASE_URL : LIVE_BASE_URL
  }

  getSignKey(): string {
    return this.config.signKey || ''
  }

  async createPaymentSession(
    params: CreatePaymentSessionParams
  ): Promise<CreatePaymentResult> {
    const {
      order,
      course,
      customerEmail,
      customerName,
      customerPhone,
      baseUrl,
      userId,
      clientIpAddress,
    } = params

    // SHOPLINE 要求 customer / billing 必填且 email 或 phone 至少一項
    if (!customerEmail) {
      throw new Error('SHOPLINE Payments 需要顧客 Email 才能建立付款，請於結帳頁填寫')
    }

    const { firstName, lastName } = splitName(customerName)
    const amountValue = Math.round(order.amount * 100)
    const productName = (course.title || '線上課程').substring(0, 128)

    // 數位商品用 TW 預設地址通過智慧風控
    // 若 Shopline 窗口已豁免 shipping，仍可保留此結構（不會被拒）
    const defaultAddress = {
      countryCode: 'TW',
      state: 'Taiwan',
      city: 'Taipei',
      postalCode: '100',
      street: 'Digital Delivery (Online Course)',
    }

    const personalInfo = {
      firstName: firstName || '學員',
      lastName: lastName || '學員',
      email: customerEmail,
      ...(customerPhone ? { phone: customerPhone } : {}),
    }

    const body = {
      referenceId: order.orderNo,
      amount: {
        value: amountValue,
        currency: 'TWD',
      },
      mode: 'regular',
      returnUrl: `${baseUrl}/api/payment/shopline/return?orderNo=${encodeURIComponent(order.orderNo)}`,
      // SHOPLINE Payments method codes are centralized in shopline-methods.ts.
      // ATM bank transfer is currently documented as `VirtualAccount`.
      allowPaymentMethodList: normalizeShoplinePaymentMethods(
        this.config.enabledPaymentMethods
      ),
      order: {
        products: [
          {
            id: order.id,
            name: productName,
            quantity: 1,
            amount: {
              value: amountValue,
              currency: 'TWD',
            },
          },
        ],
        // 數位商品仍需提供 shipping 以通過 SLP 智慧風控
        shipping: {
          shippingMethod: 'digital',
          carrier: 'N/A',
          personalInfo,
          address: defaultAddress,
        },
      },
      customer: {
        referenceCustomerId: userId,
        personalInfo,
      },
      billing: {
        personalInfo,
        address: defaultAddress,
      },
      client: {
        ip: clientIpAddress || '0.0.0.0',
      },
      metadata: {
        orderNo: order.orderNo,
        orderId: order.id,
        ...(params.courseId ? { courseId: params.courseId } : {}),
        ...(params.bundleId ? { bundleId: params.bundleId } : {}),
      },
    }

    const response = await this.request<ShoplineSessionResponse>(
      '/api/v1/trade/sessions/create',
      body
    )

    return {
      type: 'redirect',
      checkoutUrl: response.sessionUrl,
      gatewaySessionId: response.sessionId,
    }
  }

  async processRefund(params: {
    gatewayPaymentId: string | null
    orderNo?: string
  }): Promise<{ success: boolean; error?: string }> {
    if (!params.gatewayPaymentId) {
      return {
        success: false,
        error: '缺少 SHOPLINE Payments 交易 ID，無法退款',
      }
    }

    try {
      await this.request('/api/v1/trade/refund/create', {
        // 確定性 referenceOrderId（以訂單為基礎而非時間戳），讓 Shopline 端可對
        // 重複退款請求去重，避免競態 / 重送造成重複退款。
        referenceOrderId: `refund_${params.orderNo || params.gatewayPaymentId}`,
        tradeOrderId: params.gatewayPaymentId,
        // 不指定 amount 代表全額退款（依 Shopline 慣例）
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `SHOPLINE Payments 退款失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.config.merchantId || !this.config.apiKey) {
      return { success: false, message: '商店代號或 API Key 未填寫' }
    }

    const signKey = this.config.signKey?.trim()

    if (signKey) {
      try {
        const probe = `${Date.now()}.{"probe":true}`
        const sig = crypto
          .createHmac('sha256', signKey)
          .update(probe, 'utf8')
          .digest('hex')
        if (!sig || sig.length !== 64) {
          return { success: false, message: 'Sign Key 無法產生有效簽章' }
        }
      } catch (error) {
        return {
          success: false,
          message: `Sign Key 驗證失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
        }
      }
    }

    // 實際呼叫 Shopline API 驗證 merchantId / apiKey：
    // 用「建立退款」API 帶一個不存在的 tradeOrderId，期待回傳 400（業務錯誤 = 認證通過）
    // 若是 401/403 = 認證錯誤；若是網路錯誤 = 連線問題
    const url = `${this.getBaseUrl()}/api/v1/trade/refund/create`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          merchantId: this.config.merchantId,
          apiKey: this.config.apiKey,
          requestId: this.generateRequestId(),
        },
        body: JSON.stringify({
          referenceOrderId: `probe_${Date.now()}`,
          tradeOrderId: 'probe_nonexistent_trade_id',
          amount: { value: 100, currency: 'TWD' },
        }),
      })

      // 401 / 403 = 認證失敗
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          message: `API Key 或 merchantId 認證失敗（HTTP ${res.status}）。請確認後台開發者管理中的金鑰正確。`,
        }
      }

      // 200 / 400 / 404 / 409 都代表認證通過（只是業務邏輯錯誤，例如交易不存在）
      if (res.ok || res.status === 400 || res.status === 404 || res.status === 409) {
        return {
          success: true,
          message: signKey
            ? `連線成功（${this.config.testMode ? '沙盒' : '正式'}環境）。商店代號：${this.config.merchantId}，端點：${this.getBaseUrl()}`
            : `API 連線成功（${this.config.testMode ? '沙盒' : '正式'}環境），但尚未設定 Sign Key。請先把 webhook URL 提供給 SHOPLINE，待回信取得 Sign Key 後再補上。`,
        }
      }

      // 5xx / 其他狀態碼
      const text = await res.text().catch(() => '')
      return {
        success: false,
        message: `Shopline API 回應異常（HTTP ${res.status}）：${text.slice(0, 150)}`,
      }
    } catch (error) {
      return {
        success: false,
        message: `無法連線至 Shopline API：${error instanceof Error ? error.message : '未知錯誤'}`,
      }
    }
  }

  getSettingsSummary(baseUrl: string) {
    return {
      keyHint: this.config.apiKey
        ? `${this.config.apiKey.slice(0, 4)}...${this.config.apiKey.slice(-4)}`
        : '',
      isTestMode: this.config.testMode,
      webhookUrl: `${baseUrl}/api/webhooks/shopline`,
    }
  }

  /**
   * 產生符合 RFC 4122 的 UUID，並移除 dashes 作為 requestId（最多 32 碼）
   */
  private generateRequestId(): string {
    return crypto.randomUUID().replace(/-/g, '')
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        merchantId: this.config.merchantId,
        apiKey: this.config.apiKey,
        requestId: this.generateRequestId(),
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      throw new Error(`SHOPLINE API 回傳非 JSON 內容（HTTP ${res.status}）：${text.slice(0, 200)}`)
    }

    if (!res.ok) {
      const err = parsed as ShoplineErrorResponse
      throw new Error(
        `SHOPLINE API 錯誤（HTTP ${res.status}）：${err?.code || 'UNKNOWN'} ${err?.msg || ''}`.trim()
      )
    }

    return parsed as T
  }

  /**
   * 驗證 webhook 簽章
   * Shopline 使用 HMAC-SHA256，payload = `${timestamp}.${body}`
   */
  verifyWebhookSignature(params: {
    timestamp: string
    signature: string
    rawBody: string
    /** 允許的時間偏移（預設 5 分鐘） */
    toleranceMs?: number
  }): boolean {
    const { timestamp, signature, rawBody, toleranceMs = 5 * 60 * 1000 } = params
    if (!this.config.signKey) return false

    // 時間戳防重放
    const ts = Number(timestamp)
    if (!Number.isFinite(ts)) return false
    const now = Date.now()
    if (Math.abs(now - ts) > toleranceMs) return false

    const expected = crypto
      .createHmac('sha256', this.config.signKey)
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex')

    // timing-safe compare
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(signature, 'utf8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  }
}
