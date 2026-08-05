// lib/validations/curriculum.ts
// 課程大綱驗證規則
// 使用 Zod 進行表單驗證

import { z } from 'zod'
import { mediaUrlSchema } from '@/lib/validations/media-url'

/**
 * 單元狀態 Enum
 */
export const lessonStatusEnum = z.enum(['PUBLISHED', 'COMING_SOON'])
export type LessonStatusType = z.infer<typeof lessonStatusEnum>
export const videoProviderEnum = z.enum(['youtube', 'cloudflare', 'vimeo', 'bunny'])
export type VideoProviderType = z.infer<typeof videoProviderEnum>

/**
 * 章節 Schema
 */
export const chapterSchema = z.object({
  // 標題：必填，1-100 字元
  title: z
    .string()
    .min(1, { message: '章節標題為必填' })
    .max(100, { message: '章節標題不能超過 100 個字元' }),
})

export type ChapterFormData = z.infer<typeof chapterSchema>

/**
 * 單元 Schema
 */
export const lessonSchema = z.object({
  // 標題：必填，1-200 字元
  title: z
    .string()
    .min(1, { message: '單元標題為必填' })
    .max(200, { message: '單元標題不能超過 200 個字元' }),

  // 內容：選填，Markdown 格式
  content: z
    .string()
    .max(100000, { message: '內容不能超過 100000 個字元' })
    .optional()
    .nullable(),

  videoProvider: videoProviderEnum.optional().nullable(),

  videoSourceId: z
    .string()
    .max(255, { message: '影片來源 ID 不能超過 255 個字元' })
    .optional()
    .nullable(),

  videoUrl: z
    .string()
    .max(1000, { message: '影片網址不能超過 1000 個字元' })
    .optional()
    .nullable(),

  videoThumbnail: z
    .string()
    .url({ message: '縮圖必須是有效網址' })
    .optional()
    .nullable()
    .or(z.literal('')),

  // Cloudflare Stream Video ID：選填（保留舊資料 fallback）
  videoId: z
    .string()
    .max(100, { message: 'Video ID 不能超過 100 個字元' })
    .optional()
    .nullable(),

  // 影片長度（秒）：選填（null 代表影片處理中或無影片）
  videoDuration: z
    .number()
    .int({ message: '影片長度必須為整數' })
    .min(0, { message: '影片長度不能為負數' })
    .optional()
    .nullable(),

  subtitleUrl: z.string().max(2000).optional().nullable(),
  subtitleLang: z.string().max(20).optional().nullable(),
  subtitleLabel: z.string().max(100).optional().nullable(),

  // 課程內嵌工具：網址必須是有效的 https 網址，實際存取時只放行這一個來源
  toolUrl: z
    .string()
    .url({ message: '工具網址必須是有效的網址' })
    .max(2000)
    .refine((url) => url.startsWith('https://'), { message: '工具網址必須是 https' })
    .optional()
    .nullable()
    .or(z.literal('')),
  toolTitle: z.string().max(100).optional().nullable(),

  // 是否免費試閱：選填，預設 false
  isFree: z.boolean().default(false),

  // 單元狀態：必填
  status: lessonStatusEnum,

  // 製作中 (COMING_SOON) 設定
  comingSoonTitle: z
    .string()
    .max(200, { message: 'Modal 標題不能超過 200 個字元' })
    .optional()
    .nullable(),

  comingSoonDescription: z
    .string()
    .max(5000, { message: 'Modal 說明不能超過 5000 個字元' })
    .optional()
    .nullable(),

  comingSoonImage: z
    .string()
    .pipe(mediaUrlSchema('請輸入有效的圖片 URL'))
    .optional()
    .nullable()
    .or(z.literal('')),

  comingSoonDate: z
    .date()
    .optional()
    .nullable(),
})

export type LessonFormData = z.infer<typeof lessonSchema>

/**
 * 章節順序 Schema
 */
export const chapterOrderSchema = z.object({
  id: z.string().min(1, { message: 'ID 為必填' }),
  order: z.number().int({ message: '順序必須為整數' }).min(0),
})

export type ChapterOrder = z.infer<typeof chapterOrderSchema>

/**
 * 單元順序 Schema
 */
export const lessonOrderSchema = z.object({
  id: z.string().min(1, { message: 'ID 為必填' }),
  order: z.number().int({ message: '順序必須為整數' }).min(0),
})

export type LessonOrder = z.infer<typeof lessonOrderSchema>

/**
 * 建立章節請求 Schema
 */
export const createChapterSchema = chapterSchema.extend({
  courseId: z.string().min(1, { message: '課程 ID 為必填' }),
})

export type CreateChapterData = z.infer<typeof createChapterSchema>

/**
 * 建立單元請求 Schema
 */
export const createLessonSchema = lessonSchema.extend({
  chapterId: z.string().min(1, { message: '章節 ID 為必填' }),
})

export type CreateLessonData = z.infer<typeof createLessonSchema>
