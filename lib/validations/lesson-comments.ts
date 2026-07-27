// lib/validations/lesson-comments.ts
// 課程單元留言/評論 - 輸入驗證

import { z } from 'zod'

export const listLessonCommentsSchema = z.object({
  lessonId: z.string().min(1, '缺少 lessonId'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const createLessonCommentSchema = z.object({
  lessonId: z.string().min(1, '缺少 lessonId'),
  content: z
    .string()
    .trim()
    .min(1, '留言內容不能為空')
    .max(2000, '留言內容過長（最多 2000 字）'),
  isAnonymous: z.boolean().default(false),
})

export type CreateLessonCommentInput = z.infer<typeof createLessonCommentSchema>

