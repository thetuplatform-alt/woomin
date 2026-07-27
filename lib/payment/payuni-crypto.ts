// lib/payment/payuni-crypto.ts
// PAYUNi AES-256-GCM 加解密模組
// 參考：PAYUNi PHP SDK (https://github.com/payuni/PHP_SDK)

import crypto from 'crypto'

export interface PayUniConfig {
  merchantId: string
  hashKey: string
  hashIV: string
  apiUrl: string
}

export interface PayUniFormData {
  MerID: string
  Version: string
  EncryptInfo: string
  HashInfo: string
}

export interface PayUniResponse {
  Status: string
  Message: string
  TradeNo?: string
  TradeAmt?: number
  MerTradeNo?: string
  PaymentType?: string
  [key: string]: unknown
}

export type PayUniApiEnvelope =
  | {
      kind: 'encrypted'
      encryptInfo: string
      hashInfo: string
    }
  | {
      kind: 'error'
      status: string
      message: string
    }

/**
 * PAYUNi 幕後 API 的 HTTP body 是 JSON，不是 form-urlencoded。
 * 官方 SDK 也是先 json_decode，再判斷 top-level ERROR，最後才驗簽解密。
 */
export function parsePayUniApiEnvelope(text: string): PayUniApiEnvelope {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('PAYUNi API 回應不是有效 JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PAYUNi API 回應格式錯誤')
  }

  const record = parsed as Record<string, unknown>
  const status = typeof record.Status === 'string' ? record.Status : ''
  const message = typeof record.Message === 'string' ? record.Message : ''
  if (status === 'ERROR' || (!record.EncryptInfo && status && status !== 'SUCCESS')) {
    return {
      kind: 'error',
      status: status || 'ERROR',
      message: message || 'PAYUNi API 拒絕請求',
    }
  }

  if (
    typeof record.EncryptInfo !== 'string' ||
    typeof record.HashInfo !== 'string' ||
    !record.EncryptInfo ||
    !record.HashInfo
  ) {
    throw new Error('PAYUNi API 回應缺少 EncryptInfo / HashInfo')
  }

  return {
    kind: 'encrypted',
    encryptInfo: record.EncryptInfo,
    hashInfo: record.HashInfo,
  }
}

export class PayUniService {
  private config: PayUniConfig
  private readonly version = '1.0'

  constructor(config: PayUniConfig) {
    if (config.hashKey.length !== 32) {
      throw new Error(
        `HashKey must be exactly 32 characters, got ${config.hashKey.length}`
      )
    }
    if (config.hashIV.length !== 16) {
      throw new Error(
        `HashIV must be exactly 16 characters, got ${config.hashIV.length}`
      )
    }

    this.config = config
  }

  /**
   * 將物件轉為 query string 格式（模擬 PHP http_build_query）
   */
  private buildQueryString(data: Record<string, unknown>): string {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    }
    return params.toString()
  }

  /**
   * AES-256-GCM 加密
   * 格式: bin2hex(base64加密資料 + ':::' + base64(tag))
   */
  encrypt(data: string): { encryptInfo: string; hashInfo: string } {
    const { hashKey, hashIV } = this.config

    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(hashKey, 'utf8'),
      Buffer.from(hashIV, 'utf8')
    )

    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const tag = cipher.getAuthTag()
    const tagBase64 = tag.toString('base64')

    const combined = encrypted + ':::' + tagBase64
    const encryptInfo = Buffer.from(combined, 'utf8').toString('hex')

    const hashInfo = crypto
      .createHash('sha256')
      .update(hashKey + encryptInfo + hashIV)
      .digest('hex')
      .toUpperCase()

    return { encryptInfo, hashInfo }
  }

  /**
   * AES-256-GCM 解密
   */
  decrypt(encryptInfo: string): string {
    const { hashKey, hashIV } = this.config

    const combined = Buffer.from(encryptInfo, 'hex').toString('utf8')

    const parts = combined.split(':::')
    const encrypted = parts[0] ?? ''
    const tagBase64 = parts[1] ?? ''

    if (!encrypted || !tagBase64) {
      throw new Error('Invalid encrypted data format')
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(hashKey, 'utf8'),
      Buffer.from(hashIV, 'utf8')
    )

    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'))

    let decrypted = decipher.update(encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * 建立表單提交資料（用於前端 POST 到 PAYUNi）
   */
  createFormData(tradeData: Record<string, unknown>): PayUniFormData {
    const fullTradeData: Record<string, unknown> = {
      MerID: this.config.merchantId,
      Timestamp: Math.floor(Date.now() / 1000),
      ...tradeData,
    }

    const queryString = this.buildQueryString(fullTradeData)
    const { encryptInfo, hashInfo } = this.encrypt(queryString)

    return {
      MerID: this.config.merchantId,
      Version: this.version,
      EncryptInfo: encryptInfo,
      HashInfo: hashInfo,
    }
  }

  /**
   * 驗證並解密回傳資料
   */
  verifyAndDecrypt(encryptInfo: string, hashInfo: string): PayUniResponse {
    const { hashKey, hashIV } = this.config

    const expectedHash = crypto
      .createHash('sha256')
      .update(hashKey + encryptInfo + hashIV)
      .digest('hex')
      .toUpperCase()

    // 常數時間比對，避免以時間差旁路推測 hash（L42）。
    // 註：SHA256(hashKey+data+hashIV) 為 PAYUNi 協議定義之格式，雙方一致，不可改為 HMAC。
    const expectedBuf = Buffer.from(expectedHash, 'utf8')
    const providedBuf = Buffer.from((hashInfo || '').toUpperCase(), 'utf8')
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new Error('Hash verification failed')
    }

    const decrypted = this.decrypt(encryptInfo)
    const params = new URLSearchParams(decrypted)
    const result: Record<string, string> = {}
    params.forEach((value, key) => {
      result[key] = value
    })

    return result as unknown as PayUniResponse
  }

  getApiUrl(): string {
    return this.config.apiUrl
  }

  isTradeSuccess(status: string): boolean {
    return status === 'SUCCESS'
  }

  /**
   * 對 PAYUNi 後端 API（如續期收款 /api/period/mdfStatus、/api/period/query）
   * 送出加密表單並解密回應。
   *
   * 與支付頁 form_post 不同，這是伺服器對伺服器的直接呼叫：
   *   1. 以 createFormData 產生 { MerID, Version, EncryptInfo, HashInfo }
   *   2. application/x-www-form-urlencoded POST 到指定端點
   *   3. 回應同樣是 { EncryptInfo, HashInfo }，以 verifyAndDecrypt 驗簽解密
   *
   * @param apiUrl  完整 API 端點（如 https://api.payuni.com.tw/api/period/mdfStatus）
   * @param tradeData EncryptInfo 內容（不含 MerID / Timestamp，由 createFormData 自動補）
   */
  async requestApi(
    apiUrl: string,
    tradeData: Record<string, unknown>,
    options: { timeoutMs?: number; version?: string } = {}
  ): Promise<PayUniResponse> {
    const form = this.createFormData(tradeData)
    const body = new URLSearchParams({
      MerID: form.MerID,
      Version: options.version ?? form.Version,
      EncryptInfo: form.EncryptInfo,
      HashInfo: form.HashInfo,
    }).toString()

    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 15_000
    )

    let res: Response
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'payuni',
        },
        body,
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('PAYUNi API 連線逾時，請稍後重試並執行訂單查詢對帳')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      throw new Error(`PAYUNi API 回應非 2xx：${res.status} ${res.statusText}`)
    }

    // PAYUNi 後端 API 以 JSON envelope 回傳；top-level ERROR 可能沒有加密欄位。
    const text = await res.text()
    const envelope = parsePayUniApiEnvelope(text)
    if (envelope.kind === 'error') {
      return {
        Status: envelope.status,
        Message: envelope.message,
      }
    }
    return this.verifyAndDecrypt(envelope.encryptInfo, envelope.hashInfo)
  }
}
