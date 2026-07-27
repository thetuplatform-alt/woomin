// lib/validations/course-welcome-email.ts
// 課程歡迎信驗證規則

import { z } from 'zod'

export const courseWelcomeEmailSchema = z.object({
  enabled: z.boolean(),
  subjectTemplate: z
    .string()
    .trim()
    .min(1, { message: '信件標題不能為空' })
    .max(200, { message: '信件標題不能超過 200 個字元' }),
  markdownTemplate: z
    .string()
    .trim()
    .min(1, { message: '信件內容不能為空' })
    .max(100000, { message: '信件內容過長，請縮短內容' }),
})

export const courseWelcomeEmailTestSchema = z.object({
  toEmail: z.string().email({ message: '請輸入有效的 Email 地址' }),
  subjectTemplate: z
    .string()
    .trim()
    .min(1, { message: '信件標題不能為空' })
    .max(200, { message: '信件標題不能超過 200 個字元' }),
  markdownTemplate: z
    .string()
    .trim()
    .min(1, { message: '信件內容不能為空' })
    .max(100000, { message: '信件內容過長，請縮短內容' }),
})

export type CourseWelcomeEmailFormData = z.infer<typeof courseWelcomeEmailSchema>
export type CourseWelcomeEmailTestData = z.infer<typeof courseWelcomeEmailTestSchema>
