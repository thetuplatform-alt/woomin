// lib/rate-limit.ts
// Rate Limiting 工具
// 防止 API 濫用，使用記憶體儲存（適用於單一伺服器）
// 參考文件：docs/tech/統一金流串接指南.md

import { NextRequest } from 'next/server'

// ============ 型別定義 ============

interface RateLimitConfig {
  /** 時間窗口（毫秒） */
  windowMs: number
  /** 時間窗口內允許的最大請求次數 */
  maxRequests: number
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

// ============ 預設配置 ============

export const RATE_LIMIT_CONFIGS = {
  /** 付款請求：每分鐘最多 5 次 */
  payment: {
    windowMs: 60 * 1000,
    maxRequests: 5,
  },
  /** 一般 API：每分鐘最多 60 次 */
  api: {
    windowMs: 60 * 1000,
    maxRequests: 60,
  },
  /** 認證 API：每分鐘最多 10 次 */
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
} as const

// ============ 記憶體儲存 ============

const rateLimitStore = new Map<string, RateLimitEntry>()

// 定期清理過期的記錄（每 5 分鐘）
const CLEANUP_INTERVAL = 5 * 60 * 1000

let cleanupTimer: NodeJS.Timeout | null = null

function startCleanupTimer() {
  if (cleanupTimer) return

  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }
  }, CLEANUP_INTERVAL)

  // 防止 timer 阻止程序退出
  if (cleanupTimer.unref) {
    cleanupTimer.unref()
  }
}

// ============ 公開函式 ============

/**
 * 取得請求的識別符
 * 優先使用用戶 ID，否則使用 IP 位址
 */
export function getIdentifier(
  request: NextRequest,
  userId?: string
): string {
  if (userId) {
    return `user:${userId}`
  }

  // 嘗試從各種 header 取得真實 IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return `ip:${forwardedFor.split(',')[0]?.trim()}`
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return `ip:${realIp}`
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return `ip:${cfConnectingIp}`
  }

  // 無法取得 IP，使用預設值
  return 'ip:unknown'
}

/**
 * 檢查 Rate Limit
 *
 * @param key - 識別符（通常是 `${type}:${identifier}` 格式）
 * @param config - Rate Limit 配置
 * @returns Rate Limit 結果
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  startCleanupTimer()

  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // 如果沒有記錄或記錄已過期，建立新記錄
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, newEntry)

    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    }
  }

  // 增加計數
  entry.count++

  // 檢查是否超過限制
  if (entry.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * 重設特定 key 的 Rate Limit
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

/**
 * 取得 Rate Limit 的 HTTP Headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)

  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
    ...(result.success ? {} : { 'Retry-After': String(Math.max(1, retryAfter)) }),
  }
}
