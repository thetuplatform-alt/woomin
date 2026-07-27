// lib/purchase/compute-expires-at.ts
// 依課程授權類型計算 Purchase.expiresAt
// 回傳 null 代表永久有效

import type { CourseAccessType } from '@prisma/client'

export interface CourseAccessConfig {
  accessType: CourseAccessType
  accessDurationDays: number | null
  accessExpiresAt: Date | null
}

/**
 * 根據課程授權設定，計算單次購買的到期時間
 *
 * - LIFETIME：永久，回傳 null
 * - DURATION：購買時間 + accessDurationDays 天
 * - FIXED_DATE：統一採用課程設定的 accessExpiresAt；若未設定或已過期，視為永久（避免誤擋學員）
 */
export function computeExpiresAt(
  course: CourseAccessConfig,
  purchasedAt: Date = new Date()
): Date | null {
  switch (course.accessType) {
    case 'LIFETIME':
      return null

    case 'DURATION': {
      if (!course.accessDurationDays || course.accessDurationDays <= 0) {
        return null
      }
      const ms = course.accessDurationDays * 24 * 60 * 60 * 1000
      return new Date(purchasedAt.getTime() + ms)
    }

    case 'FIXED_DATE': {
      if (!course.accessExpiresAt) return null
      if (course.accessExpiresAt.getTime() <= purchasedAt.getTime()) {
        // 保護性 fallback：統一到期日已過期 → 視為永久
        return null
      }
      return course.accessExpiresAt
    }

    default:
      return null
  }
}

/**
 * 將課程授權類型轉為人類可讀說明（給前台銷售頁、結帳頁、後台預覽使用）
 */
export function describeAccessPolicy(
  course: CourseAccessConfig
): string {
  switch (course.accessType) {
    case 'LIFETIME':
      return '永久觀看，不限時間'
    case 'DURATION': {
      const days = course.accessDurationDays
      if (!days || days <= 0) return '永久觀看，不限時間'
      if (days % 365 === 0) return `購買後可觀看 ${days / 365} 年`
      if (days % 30 === 0) return `購買後可觀看 ${days / 30} 個月`
      return `購買後可觀看 ${days} 天`
    }
    case 'FIXED_DATE': {
      if (!course.accessExpiresAt) return '永久觀看，不限時間'
      const dateStr = course.accessExpiresAt.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      return `觀看期限至 ${dateStr}`
    }
    default:
      return '永久觀看，不限時間'
  }
}
