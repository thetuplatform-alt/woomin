// lib/auth-security.ts
// 認證安全模組 - 暴力破解防護
// 實現帳號鎖定、IP 限制、登入嘗試紀錄

import { prisma } from '@/lib/prisma'

// ==================== 配置常數 ====================

/**
 * 安全配置
 */
const SECURITY_CONFIG = {
  // 帳號鎖定：5 次失敗後鎖定 15 分鐘
  ACCOUNT_LOCK_THRESHOLD: 5,
  ACCOUNT_LOCK_DURATION_MINUTES: 15,

  // 失敗計數重置窗：距上次失敗超過此時間（分鐘）即重新計數，
  // 避免「跨數月零星失敗」累積觸發鎖定（L60）。
  FAILED_COUNT_RESET_MINUTES: 60,

  // IP 級別限制：每小時最多 50 次嘗試
  IP_RATE_LIMIT: 50,
  IP_RATE_WINDOW_MINUTES: 60,

  // Email 級別限制：每 10 分鐘最多 10 次嘗試
  EMAIL_RATE_LIMIT: 10,
  EMAIL_RATE_WINDOW_MINUTES: 10,
}

// ==================== 類型定義 ====================

export interface SecurityCheckResult {
  allowed: boolean
  reason?: string
  retryAfter?: Date
}

// ==================== 主要功能 ====================

/**
 * 檢查是否允許登入嘗試
 * 檢查 IP 限制和 Email 限制
 */
export async function checkLoginSecurity(
  email: string,
  ipAddress: string
): Promise<SecurityCheckResult> {
  const now = new Date()

  // 1. 檢查帳號是否被鎖定
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      lockedUntil: true,
      failedLoginCount: true,
    },
  })

  if (user?.lockedUntil && user.lockedUntil > now) {
    return {
      allowed: false,
      reason: '帳號已被暫時鎖定，請稍後再試',
      retryAfter: user.lockedUntil,
    }
  }

  // 2. 檢查 IP 級別限制
  const ipWindowStart = new Date(
    now.getTime() - SECURITY_CONFIG.IP_RATE_WINDOW_MINUTES * 60 * 1000
  )
  const ipAttempts = await prisma.loginAttempt.count({
    where: {
      ipAddress,
      createdAt: { gte: ipWindowStart },
    },
  })

  if (ipAttempts >= SECURITY_CONFIG.IP_RATE_LIMIT) {
    return {
      allowed: false,
      reason: '此 IP 嘗試次數過多，請稍後再試',
      retryAfter: new Date(
        ipWindowStart.getTime() + SECURITY_CONFIG.IP_RATE_WINDOW_MINUTES * 60 * 1000
      ),
    }
  }

  // 3. 檢查 Email 級別限制
  const emailWindowStart = new Date(
    now.getTime() - SECURITY_CONFIG.EMAIL_RATE_WINDOW_MINUTES * 60 * 1000
  )
  const emailAttempts = await prisma.loginAttempt.count({
    where: {
      email,
      createdAt: { gte: emailWindowStart },
    },
  })

  if (emailAttempts >= SECURITY_CONFIG.EMAIL_RATE_LIMIT) {
    return {
      allowed: false,
      reason: '此電子郵件嘗試次數過多，請稍後再試',
      retryAfter: new Date(
        emailWindowStart.getTime() + SECURITY_CONFIG.EMAIL_RATE_WINDOW_MINUTES * 60 * 1000
      ),
    }
  }

  return { allowed: true }
}

/**
 * 記錄失敗的登入嘗試
 * 更新用戶的失敗計數，必要時鎖定帳號
 */
export async function recordFailedLogin(
  email: string,
  ipAddress: string,
  userAgent?: string
): Promise<void> {
  const now = new Date()

  // 記錄登入嘗試
  await prisma.loginAttempt.create({
    data: {
      email,
      ipAddress,
      success: false,
      userAgent,
    },
  })

  // 更新用戶的失敗計數
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      failedLoginCount: true,
      lastFailedLoginAt: true,
    },
  })

  if (user) {
    // L60：若距上次失敗已超過重置窗，視為新一輪，從 1 重新計數
    const resetWindowMs = SECURITY_CONFIG.FAILED_COUNT_RESET_MINUTES * 60 * 1000
    const isStale =
      user.lastFailedLoginAt != null &&
      now.getTime() - user.lastFailedLoginAt.getTime() > resetWindowMs
    const newFailedCount = isStale ? 1 : user.failedLoginCount + 1

    // 判斷是否需要鎖定帳號
    const shouldLock = newFailedCount >= SECURITY_CONFIG.ACCOUNT_LOCK_THRESHOLD

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: newFailedCount,
        lastFailedLoginAt: now,
        // 如果達到閾值，設定鎖定時間
        lockedUntil: shouldLock
          ? new Date(
              now.getTime() + SECURITY_CONFIG.ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000
            )
          : undefined,
      },
    })
  }
}

/**
 * 記錄成功的登入
 * 重置失敗計數並更新最後登入時間
 */
export async function recordSuccessfulLogin(
  userId: string,
  ipAddress: string,
  userAgent?: string
): Promise<void> {
  const now = new Date()

  // 獲取用戶的 email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!user) return

  // 記錄成功的登入嘗試
  await prisma.loginAttempt.create({
    data: {
      email: user.email,
      ipAddress,
      success: true,
      userAgent,
    },
  })

  // 重置失敗計數並更新最後登入時間
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
    },
  })
}

/**
 * 檢查帳號是否被鎖定
 * 用於 authorize 函數中的快速檢查
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { lockedUntil: true },
  })

  if (!user?.lockedUntil) return false

  return user.lockedUntil > new Date()
}

/**
 * 解鎖帳號
 * 手動解鎖被鎖定的帳號
 */
export async function unlockAccount(email: string): Promise<void> {
  await prisma.user.update({
    where: { email },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
    },
  })
}

/**
 * 清理過期的登入嘗試紀錄
 * 建議每天執行一次
 */
export async function cleanupOldLoginAttempts(daysToKeep: number = 7): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const result = await prisma.loginAttempt.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  })

  return result.count
}
