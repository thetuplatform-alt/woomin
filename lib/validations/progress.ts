// lib/validations/progress.ts
// 進度更新驗證規則
// 使用 Zod 進行請求驗證

import { z } from 'zod'

/**
 * 更新進度請求 Schema
 */
export const updateProgressSchema = z.object({
  // 單元 ID：必填，CUID 格式
  lessonId: z
    .string()
    .min(1, { message: '單元 ID 為必填' })
    .max(50, { message: '單元 ID 格式錯誤' }),

  // 觀看秒數：必填，非負整數
  watchedSec: z
    .number({ message: '觀看秒數必須為數字' })
    .int({ message: '觀看秒數必須為整數' })
    .min(0, { message: '觀看秒數不能為負數' })
    .max(86400, { message: '觀看秒數超過上限' }), // 最多 24 小時

  // 是否已完成：必填
  completed: z.boolean({ message: '完成狀態必須為布林值' }),

  // 強制設定完成狀態（用於手動切換，可覆蓋已完成狀態）
  forceComplete: z.boolean().optional(),
})

/**
 * 更新進度請求類型
 */
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>

/**
 * 進度資料回應類型
 */
export interface ProgressResponse {
  success: boolean
  progress?: {
    lessonId: string
    watchedSec: number
    completed: boolean
  }
  error?: string
}

/**
 * 課程進度統計類型
 */
export interface CourseProgressStats {
  totalLessons: number
  completedLessons: number
  progressPercentage: number
}
