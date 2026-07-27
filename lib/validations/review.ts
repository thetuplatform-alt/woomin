// lib/validations/review.ts
// 課程評價 - 輸入驗證

import { z } from 'zod'

export const createReviewSchema = z.object({
  courseId: z.string().min(1, '缺少 courseId'),
  rating: z.number().int().min(1, '評分最低 1 星').max(5, '評分最高 5 星'),
  content: z
    .string()
    .trim()
    .max(2000, '評價內容過長（最多 2000 字）')
    .optional()
    .transform((val) => val || null),
})

export const updateReviewSchema = z.object({
  reviewId: z.string().min(1, '缺少 reviewId'),
  rating: z.number().int().min(1, '評分最低 1 星').max(5, '評分最高 5 星'),
  content: z
    .string()
    .trim()
    .max(2000, '評價內容過長（最多 2000 字）')
    .optional()
    .transform((val) => val || null),
})

export const reportReviewSchema = z.object({
  reviewId: z.string().min(1, '缺少 reviewId'),
  reason: z
    .string()
    .trim()
    .min(1, '請選擇舉報原因')
    .max(500, '舉報原因過長（最多 500 字）'),
})

export const replyToReviewSchema = z.object({
  reviewId: z.string().min(1, '缺少 reviewId'),
  content: z
    .string()
    .trim()
    .min(1, '回覆內容不能為空')
    .max(2000, '回覆內容過長（最多 2000 字）'),
})

export type CreateReviewInput = z.infer<typeof createReviewSchema>
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>
export type ReportReviewInput = z.infer<typeof reportReviewSchema>
export type ReplyToReviewInput = z.infer<typeof replyToReviewSchema>

/** 評價排序方式 */
export type ReviewSortBy = 'helpful' | 'newest' | 'highest' | 'lowest'

/**
 * 評價統計
 */
export interface ReviewStats {
  averageRating: number
  reviewCount: number
  distribution: { [key: number]: number } // { 1: 2, 2: 0, 3: 1, 4: 5, 5: 10 }
}

/**
 * 評價資料（前台顯示用）
 */
export interface ReviewData {
  id: string
  rating: number
  content: string | null
  helpfulCount: number
  isHelpful: boolean // 當前用戶是否按過有用
  hasReported: boolean // 當前用戶是否已舉報
  replyContent: string | null
  replyAt: string | null
  createdAt: string // ISO string
  updatedAt: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

/**
 * 用戶自己的評價
 */
export interface UserReview {
  id: string
  rating: number
  content: string | null
  createdAt: string
  updatedAt: string
}

/**
 * 後台評價資料
 */
export interface AdminReviewData extends ReviewData {
  isVisible: boolean
  reportCount: number
  reports: { reason: string; createdAt: string }[]
}

/** 舉報原因選項 */
export const REPORT_REASONS = [
  { value: '不當內容', label: '不當內容' },
  { value: '垃圾訊息', label: '垃圾訊息' },
  { value: '與課程無關', label: '與課程無關' },
  { value: '其他', label: '其他' },
] as const
