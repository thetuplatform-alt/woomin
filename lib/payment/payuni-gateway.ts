// lib/payment/payuni-gateway.ts
// PAYUNi 統一金流閘道實作

import type {
  PaymentGateway,
  CreatePaymentSessionParams,
  CreatePaymentResult,
  CreateSubscriptionSessionParams,
  RefundResult,
} from './types'
import type { CourseSubscription } from '@prisma/client'
import { PayUniService } from './payuni-crypto'
import { endPayuniPeriod } from '@/lib/subscription/payuni-period'
import { PAYUNI_UNLIMITED_PERIOD_TIMES } from '@/lib/subscription/constants'
import { addBillingInterval, formatTaiwanDate } from '@/lib/subscription/calendar'

export class PayUniGateway implements PaymentGateway {
  readonly type = 'payuni' as const
  /** PAYUNi 以官方「續期收款」API（/api/period/Page）支援訂閱 */
  readonly supportsSubscription = true
  private service: PayUniService
  private merchantId: string
  private testMode: boolean

  constructor(config: {
    merchantId: string
    hashKey: string
    hashIV: string
    testMode: boolean
  }) {
    this.merchantId = config.merchantId
    this.testMode = config.testMode

    const apiUrl = config.testMode
      ? 'https://sandbox-api.payuni.com.tw/api/upp'
      : 'https://api.payuni.com.tw/api/upp'

    this.service = new PayUniService({
      merchantId: config.merchantId,
      hashKey: config.hashKey,
      hashIV: config.hashIV,
      apiUrl,
    })
  }

  async createPaymentSession(
    params: CreatePaymentSessionParams
  ): Promise<CreatePaymentResult> {
    const { order, course, customerEmail, baseUrl } = params

    const prodDesc = course.title.substring(0, 100)

    const formData = this.service.createFormData({
      MerTradeNo: order.orderNo,
      TradeAmt: Math.round(order.amount),
      ProdDesc: prodDesc,
      ReturnURL: `${baseUrl}/api/payment/return`,
      NotifyURL: `${baseUrl}/api/payment/notify`,
      ...(customerEmail ? { UsrMail: customerEmail } : {}),
    })

    return {
      type: 'form_post',
      formData: {
        apiUrl: this.service.getApiUrl(),
        MerID: formData.MerID,
        Version: formData.Version,
        EncryptInfo: formData.EncryptInfo,
        HashInfo: formData.HashInfo,
      },
      gatewaySessionId: order.orderNo,
    }
  }

  /** 續期收款支付頁端點（依 testMode 切換 sandbox / 正式） */
  private periodPageUrl(): string {
    return this.testMode
      ? 'https://sandbox-api.payuni.com.tw/api/period/Page'
      : 'https://api.payuni.com.tw/api/period/Page'
  }

  /** 續期收款狀態異動端點（mdfStatus：終止 / 重扣） */
  private periodMdfStatusUrl(): string {
    return this.testMode
      ? 'https://sandbox-api.payuni.com.tw/api/period/mdfStatus'
      : 'https://api.payuni.com.tw/api/period/mdfStatus'
  }

  private periodQueryUrl(): string {
    return this.testMode
      ? 'https://sandbox-api.payuni.com.tw/api/period/query'
      : 'https://api.payuni.com.tw/api/period/query'
  }

  private tradeQueryUrl(): string {
    return this.testMode
      ? 'https://sandbox-api.payuni.com.tw/api/trade/query'
      : 'https://api.payuni.com.tw/api/trade/query'
  }

  private tradeCloseUrl(): string {
    return this.testMode
      ? 'https://sandbox-api.payuni.com.tw/api/trade/close'
      : 'https://api.payuni.com.tw/api/trade/close'
  }

  private tradeCancelUrl(): string {
    return this.testMode
      ? 'https://sandbox-api.payuni.com.tw/api/trade/cancel'
      : 'https://api.payuni.com.tw/api/trade/cancel'
  }

  /**
   * 建立訂閱結帳會話（PAYUNi 續期收款支付頁 form_post）。
   *
   * 參數推導嚴格照 PRD §4.1：
   *   - MerTradeNo = subscription.gatewayTradeNo（≤25 碼自產）
   *   - PeriodAmt  = 每期金額（plan.price，快照於 subscription.pricePerPeriod）
   *   - PeriodType = month | year
   *   - PeriodDate = 月繳→建單日 day-of-month（1–31，PAYUNi 規則當月無該日則月底）
   *                  年繳→建單日 + 1 年的 YYYY-MM-DD
   *   - PeriodTimes= FIXED_TERM→totalPeriods；UNLIMITED→900（技術上限近似無限）
   *   - FType=build（建單當日首扣）、API3D=1（僅首次 3D）
   *   - NotifyURL / ReturnURL 指向訂閱專用 route（不混用一次性收款 route）
   */
  async createSubscriptionSession(
    params: CreateSubscriptionSessionParams
  ): Promise<CreatePaymentResult> {
    const { subscription, baseUrl, user, courseTitle } = params

    const merTradeNo = subscription.gatewayTradeNo
    if (!merTradeNo) {
      throw new Error('訂閱缺少 gatewayTradeNo，無法建立 PAYUNi 續期收款')
    }

    const periodType = subscription.interval === 'YEAR' ? 'year' : 'month'

    // PeriodDate 推導（以建單當下為基準）
    const now = new Date()
    let periodDate: string
    if (periodType === 'month') {
      // 月繳：day-of-month（1–31）；當月無該日 PAYUNi 自動取月底
      periodDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Taipei',
        day: 'numeric',
      }).format(now)
    } else {
      // 年繳：建單日 + 1 年，格式 YYYY-MM-DD
      periodDate = formatTaiwanDate(addBillingInterval(now, 'YEAR'))
    }

    // 期數：FIXED_TERM 用方案期數；UNLIMITED 用 900（技術上限）
    const periodTimes =
      subscription.planType === 'FIXED_TERM' && subscription.totalPeriods != null
        ? subscription.totalPeriods
        : PAYUNI_UNLIMITED_PERIOD_TIMES

    const formData = this.service.createFormData({
      MerTradeNo: merTradeNo,
      PeriodAmt: Math.round(subscription.pricePerPeriod),
      ProdDesc: courseTitle.slice(0, 500),
      PeriodType: periodType,
      PeriodDate: periodDate,
      PeriodTimes: periodTimes,
      FType: 'build', // 建單當日首扣
      API3D: 1, // 僅首次強制 3D，後續續期無 3D
      NotifyURL: `${baseUrl}/api/payment/period-notify`,
      ReturnURL: `${baseUrl}/api/payment/period-return`,
      ...(user.email ? { PayerEmail: user.email } : {}),
    })

    return {
      type: 'form_post',
      formData: {
        apiUrl: this.periodPageUrl(),
        MerID: formData.MerID,
        Version: formData.Version,
        EncryptInfo: formData.EncryptInfo,
        HashInfo: formData.HashInfo,
      },
      gatewaySessionId: merTradeNo,
    }
  }

  /**
   * 取消訂閱（PAYUNi mdfStatus ReviseTradeStatus=end；不可逆）。
   * 以 subscription.gatewaySubscriptionId（= 首期 Notify 回寫的 PeriodTradeNo）定位訂單。
   */
  async cancelSubscription(params: {
    subscription: CourseSubscription
  }): Promise<{ success: boolean; error?: string }> {
    const periodTradeNo = params.subscription.gatewaySubscriptionId
    if (!periodTradeNo) {
      // 尚未取得 PeriodTradeNo（首期 Notify 未到）→ gateway 端無可取消對象
      return {
        success: false,
        error: '訂閱尚未於 PAYUNi 建立（缺少 PeriodTradeNo），無法終止',
      }
    }
    return endPayuniPeriod({ periodTradeNo })
  }

  /** 供 payuni-period.ts 呼叫 mdfStatus 端點（帶正確 sandbox / 正式網域） */
  async requestPeriodMdfStatus(
    tradeData: Record<string, unknown>
  ): Promise<import('./payuni-crypto').PayUniResponse> {
    return this.service.requestApi(this.periodMdfStatusUrl(), tradeData)
  }

  async queryPeriod(periodTradeNo: string) {
    return this.service.requestApi(this.periodQueryUrl(), {
      PeriodTradeNo: periodTradeNo,
    })
  }

  async processRefund(params: {
    gatewayPaymentId: string | null
    orderNo?: string
  }): Promise<RefundResult> {
    const tradeNo = params.gatewayPaymentId?.trim()
    if (!tradeNo) {
      return {
        success: false,
        error: '缺少 PAYUNi TradeNo，不能執行退款',
      }
    }

    try {
      const query = await this.service.requestApi(
        this.tradeQueryUrl(),
        { TradeNo: tradeNo },
        { version: '2.0' }
      )
      if (!this.service.isTradeSuccess(query.Status)) {
        return {
          success: false,
          error: formatPayuniRefundError('交易查詢失敗', query),
        }
      }

      const closeStatus = String(
        query.CloseStatus ?? query['Result[0][CloseStatus]'] ?? ''
      ).trim()
      if (closeStatus === '3' || closeStatus === '9') {
        return { success: true }
      }

      if (closeStatus === '1') {
        const canceled = await this.service.requestApi(this.tradeCancelUrl(), {
          TradeNo: tradeNo,
        })
        if (!this.service.isTradeSuccess(canceled.Status)) {
          return {
            success: false,
            error: formatPayuniRefundError('取消授權失敗', canceled),
          }
        }
        return { success: true }
      }

      if (closeStatus === '2' || closeStatus === '7') {
        const tradeAmt = parsePayuniTradeAmount(
          query.TradeAmt ?? query['Result[0][TradeAmt]']
        )
        if (tradeAmt == null) {
          return {
            success: false,
            error: 'PAYUNi 交易查詢缺少有效 TradeAmt，不能執行退款',
          }
        }

        const closed = await this.service.requestApi(this.tradeCloseUrl(), {
          TradeNo: tradeNo,
          CloseType: 2,
          TradeAmt: tradeAmt,
        })
        if (!this.service.isTradeSuccess(closed.Status)) {
          return {
            success: false,
            error: formatPayuniRefundError('退款失敗', closed),
          }
        }
        return { success: true }
      }

      return {
        success: false,
        error: `PAYUNi 回傳未支援的 CloseStatus：${closeStatus || '空值'}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PAYUNi 退款請求失敗',
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // 測試加解密是否正常（驗證 Key/IV 正確性）
      const testData = 'MerID=TEST&TradeAmt=100'
      const { encryptInfo } = this.service.encrypt(testData)
      const decrypted = this.service.decrypt(encryptInfo)

      if (decrypted === testData) {
        return {
          success: false,
          message: `Hash Key/IV 格式驗證通過，但 PAYUNi 不提供可安全試打的連線測試 API，不能據此判定商店或續期權限可用。請以 ${this.testMode ? 'Sandbox' : '正式環境小額'} 完整建單、Notify、取消與退款驗收；商店代號：${this.merchantId}`,
        }
      }

      return {
        success: false,
        message: '加解密驗證失敗：解密結果不一致',
      }
    } catch (error) {
      return {
        success: false,
        message: `連線測試失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
      }
    }
  }

  getSettingsSummary(baseUrl: string) {
    return {
      keyHint: this.merchantId
        ? `${this.merchantId.slice(0, 3)}...${this.merchantId.slice(-3)}`
        : '',
      isTestMode: this.testMode,
      webhookUrl: `${baseUrl}/api/payment/notify`,
    }
  }

  /** 取得 PayUniService 實例（供 notify/return 路由直接使用） */
  getService(): PayUniService {
    return this.service
  }

  getMerchantId(): string {
    return this.merchantId
  }

  isTestMode(): boolean {
    return this.testMode
  }
}

function parsePayuniTradeAmount(value: unknown): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount)
}

function formatPayuniRefundError(
  prefix: string,
  response: { Status?: string; Message?: string }
): string {
  const message = response.Message || '未知錯誤'
  const status = response.Status ? `Status=${response.Status}` : 'Status=UNKNOWN'
  return `PAYUNi ${prefix}：${message}（${status}）`
}
