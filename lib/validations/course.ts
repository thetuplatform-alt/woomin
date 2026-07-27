// lib/validations/course.ts
// 課程驗證規則
// 使用 Zod 進行表單驗證

import { z } from 'zod'
export { courseStatusOptions, courseVisibilityOptions } from '@/lib/course-options'
import { mediaUrlSchema } from '@/lib/validations/media-url'

export const watermarkEmailDisplayModeOptions = [
  { value: 'FULL', label: '完整顯示' },
  { value: 'MASKED', label: '部分遮罩' },
] as const

export const watermarkTextSizeOptions = [
  { value: 'SM', label: '小' },
  { value: 'MD', label: '中' },
  { value: 'LG', label: '大' },
] as const

export const watermarkMovementModeOptions = [
  { value: 'STANDARD', label: '標準' },
  { value: 'AGGRESSIVE', label: '加強' },
] as const

/**
 * 課程授權類型選項
 */
export const courseAccessTypeOptions = [
  { value: 'LIFETIME', label: '永久授權（一次付費，終身觀看）' },
  { value: 'DURATION', label: '期限授權（購買後 N 天內可觀看）' },
  { value: 'FIXED_DATE', label: '固定到期日（所有學員同日到期，適合期數制）' },
] as const

export const courseVisibilityEnum = z.enum(['PUBLIC', 'UNLISTED', 'INVITE_ONLY'])

export const courseInviteSchema = z.object({
  courseId: z.string().min(1, '課程 ID 為必填'),
  email: z
    .string()
    .email('請輸入有效的 Email')
    .optional()
    .nullable()
    .or(z.literal('')),
  maxUses: z
    .number()
    .int({ message: '使用次數必須為整數' })
    .min(1, { message: '使用次數至少為 1' })
    .optional()
    .nullable(),
  expiresAt: z.date().optional().nullable(),
  active: z.boolean().optional().default(true),
})

export type CourseInviteFormData = z.infer<typeof courseInviteSchema>

/**
 * 課程基礎 Schema（不含 refine）
 */
const courseBaseSchema = z.object({
  // 標題：必填，2-100 字元
  title: z
    .string()
    .min(2, { message: '標題至少需要 2 個字元' })
    .max(100, { message: '標題不能超過 100 個字元' }),

  // 副標題：選填
  subtitle: z
    .string()
    .max(200, { message: '副標題不能超過 200 個字元' })
    .optional()
    .nullable(),

  // Slug：必填，URL 安全格式
  slug: z
    .string()
    .min(2, { message: 'Slug 至少需要 2 個字元' })
    .max(100, { message: 'Slug 不能超過 100 個字元' })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'Slug 只能包含小寫字母、數字和連字號',
    }),

  // 描述：選填
  description: z
    .string()
    .max(5000, { message: '描述不能超過 5000 個字元' })
    .optional()
    .nullable(),

  // 封面圖片：選填
  coverImage: z
    .string()
    .pipe(mediaUrlSchema('請輸入有效的圖片網址'))
    .optional()
    .nullable()
    .or(z.literal('')),

  // 原價：必填，正整數
  price: z
    .number()
    .int({ message: '價格必須為整數' })
    .min(0, { message: '價格不能為負數' }),

  // 促銷價：選填，需小於原價
  salePrice: z
    .number()
    .int({ message: '促銷價必須為整數' })
    .min(0, { message: '促銷價不能為負數' })
    .optional()
    .nullable(),

  // 促銷截止日期：選填
  saleEndAt: z
    .date()
    .optional()
    .nullable(),

  // 促銷說明文字：選填（如「開工優惠」「限時早鳥」）
  saleLabel: z
    .string()
    .max(20, { message: '促銷說明文字不能超過 20 個字元' })
    .optional()
    .nullable(),

  // 永久促銷循環：選填
  saleCycleEnabled: z
    .boolean()
    .optional(),

  // 循環天數：選填
  saleCycleDays: z
    .number()
    .int({ message: '循環天數必須為整數' })
    .min(1, { message: '循環天數至少為 1 天' })
    .max(30, { message: '循環天數不能超過 30 天' })
    .optional()
    .nullable(),

  // 是否顯示倒數時鐘：選填
  showCountdown: z
    .boolean()
    .optional(),

  // SEO 標題：選填
  seoTitle: z
    .string()
    .max(60, { message: 'SEO 標題不能超過 60 個字元' })
    .optional()
    .nullable(),

  // SEO 描述：選填
  seoDesc: z
    .string()
    .max(160, { message: 'SEO 描述不能超過 160 個字元' })
    .optional()
    .nullable(),

  // SEO 關鍵字：選填
  seoKeywords: z
    .string()
    .max(200, { message: 'SEO 關鍵字不能超過 200 個字元' })
    .optional()
    .nullable(),

  // OG / Social
  ogTitle: z
    .string()
    .max(120, { message: 'OG 標題不能超過 120 個字元' })
    .optional()
    .nullable(),

  ogDescription: z
    .string()
    .max(300, { message: 'OG 描述不能超過 300 個字元' })
    .optional()
    .nullable(),

  ogImage: z
    .string()
    .pipe(mediaUrlSchema('請輸入有效的圖片網址'))
    .optional()
    .nullable()
    .or(z.literal('')),

  // 銷售頁設定
  landingPageMode: z
    .enum(['react', 'html'])
    .optional()
    .nullable(),

  landingPageSlug: z
    .string()
    .max(100, { message: '銷售頁 Slug 不能超過 100 個字元' })
    .optional()
    .nullable(),

  landingPageHtml: z
    .string()
    .optional()
    .nullable(),

  // JSON-LD 結構化資料
  instructorName: z
    .string()
    .max(100, { message: '講師名稱不能超過 100 個字元' })
    .optional()
    .nullable(),

  instructorTitle: z
    .string()
    .max(100, { message: '講師職稱不能超過 100 個字元' })
    .optional()
    .nullable(),

  instructorDesc: z
    .string()
    .max(500, { message: '講師簡介不能超過 500 個字元' })
    .optional()
    .nullable(),

  courseWorkload: z
    .string()
    .max(20, { message: '課程時長格式不能超過 20 個字元' })
    .optional()
    .nullable(),

  ratingValue: z
    .string()
    .max(5, { message: '評分值不能超過 5 個字元' })
    .optional()
    .nullable(),

  ratingCount: z
    .string()
    .max(10, { message: '評分數量不能超過 10 個字元' })
    .optional()
    .nullable(),

  // 購買通知
  notifyAdminOnPurchase: z
    .boolean()
    .optional(),

  // 授權期限
  accessType: z.enum(['LIFETIME', 'DURATION', 'FIXED_DATE']).optional(),
  accessDurationDays: z
    .number()
    .int({ message: '天數必須為整數' })
    .min(1, { message: '天數至少為 1 天' })
    .max(36500, { message: '天數不可超過 36500' })
    .optional()
    .nullable(),
  accessExpiresAt: z.date().optional().nullable(),
  expirationReminderEnabled: z.boolean().optional(),
  expirationReminderDays: z
    .array(z.number().int().min(0).max(365))
    .max(6, { message: '最多只能設定 6 個提醒時間點' })
    .optional(),

  // 狀態：必填
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNLISTED'], {
    message: '請選擇有效的狀態',
  }),

  // 銷售可見性：不取代 status，用於控制公開列表、連結販售與邀請制購買
  salesVisibility: courseVisibilityEnum.optional(),
})

/**
 * 課程完整 Schema（含跨欄位驗證）
 */
export const courseSchema = courseBaseSchema.refine(
  (data) => {
    // 如果有促銷價，必須小於原價
    if (data.salePrice !== null && data.salePrice !== undefined) {
      return data.salePrice < data.price
    }
    return true
  },
  {
    message: '促銷價必須小於原價',
    path: ['salePrice'],
  }
).refine(
  (data) => {
    // 如果有促銷價，應該要有促銷截止日期
    if (data.salePrice !== null && data.salePrice !== undefined && data.salePrice > 0) {
      // 這是建議性的，不強制要求
      return true
    }
    return true
  },
  {
    message: '建議設定促銷截止日期',
    path: ['saleEndAt'],
  }
).refine(
  (data) => {
    // 循環模式下不檢查促銷截止日期
    if (data.saleCycleEnabled) return true
    // 如果有促銷截止日期，必須晚於現在
    if (data.saleEndAt !== null && data.saleEndAt !== undefined) {
      return data.saleEndAt > new Date()
    }
    return true
  },
  {
    message: '促銷截止日期必須晚於現在',
    path: ['saleEndAt'],
  }
).refine(
  (data) => {
    // 啟用永久優惠 + 顯示倒數時鐘時，必須設定循環天數
    if (data.saleCycleEnabled && data.showCountdown) {
      return data.saleCycleDays !== null && data.saleCycleDays !== undefined && data.saleCycleDays >= 1
    }
    return true
  },
  {
    message: '開啟倒數時鐘時，必須設定循環天數',
    path: ['saleCycleDays'],
  }
).refine(
  (data) => {
    // 啟用永久優惠時，必須設定促銷價
    if (data.saleCycleEnabled) {
      return data.salePrice !== null && data.salePrice !== undefined
    }
    return true
  },
  {
    message: '啟用永久優惠時，必須設定促銷價',
    path: ['salePrice'],
  }
)

/**
 * 課程表單輸入類型
 */
export type CourseFormData = z.infer<typeof courseSchema>

/**
 * 課程資訊 Schema（基本資訊 tab）
 */
const courseInfoSchema = courseBaseSchema.pick({
  title: true,
  subtitle: true,
  slug: true,
  description: true,
  coverImage: true,
  instructorName: true,
  instructorTitle: true,
  instructorDesc: true,
  status: true,
  salesVisibility: true,
})

type CourseInfoFormData = z.infer<typeof courseInfoSchema>

/**
 * 定價與促銷 Schema
 */
export const coursePricingSchema = courseBaseSchema.pick({
  price: true,
  salePrice: true,
  saleEndAt: true,
  saleLabel: true,
  saleCycleEnabled: true,
  saleCycleDays: true,
  showCountdown: true,
  accessType: true,
  accessDurationDays: true,
  accessExpiresAt: true,
  expirationReminderEnabled: true,
  expirationReminderDays: true,
}).refine(
  (data) => {
    if (data.salePrice !== null && data.salePrice !== undefined) {
      return data.salePrice < data.price
    }
    return true
  },
  { message: '促銷價必須小於原價', path: ['salePrice'] }
).refine(
  (data) => {
    if (data.saleCycleEnabled) return true
    if (data.saleEndAt !== null && data.saleEndAt !== undefined) {
      return data.saleEndAt > new Date()
    }
    return true
  },
  { message: '促銷截止日期必須晚於現在', path: ['saleEndAt'] }
).refine(
  (data) => {
    if (data.saleCycleEnabled && data.showCountdown) {
      return data.saleCycleDays !== null && data.saleCycleDays !== undefined && data.saleCycleDays >= 1
    }
    return true
  },
  { message: '開啟倒數時鐘時，必須設定循環天數', path: ['saleCycleDays'] }
).refine(
  (data) => {
    if (data.saleCycleEnabled) {
      return data.salePrice !== null && data.salePrice !== undefined
    }
    return true
  },
  { message: '啟用永久優惠時，必須設定促銷價', path: ['salePrice'] }
).refine(
  (data) => {
    // DURATION 模式必須填天數
    if (data.accessType === 'DURATION') {
      return !!data.accessDurationDays && data.accessDurationDays >= 1
    }
    return true
  },
  { message: '期限授權必須設定有效天數', path: ['accessDurationDays'] }
).refine(
  (data) => {
    // FIXED_DATE 模式必須填到期日，且晚於現在
    if (data.accessType === 'FIXED_DATE') {
      return !!data.accessExpiresAt && data.accessExpiresAt > new Date()
    }
    return true
  },
  { message: '固定到期日必須晚於現在', path: ['accessExpiresAt'] }
)

export type CoursePricingFormData = z.infer<typeof coursePricingSchema>

/**
 * 行銷設定 Schema
 */
const courseMarketingSchema = courseBaseSchema.pick({
  seoTitle: true,
  seoDesc: true,
  seoKeywords: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
  landingPageMode: true,
  landingPageSlug: true,
  landingPageHtml: true,
  notifyAdminOnPurchase: true,
})

type CourseMarketingFormData = z.infer<typeof courseMarketingSchema>

const courseWatermarkSchema = z.object({
  watermarkEnabled: z.boolean().optional(),
  watermarkShowEmail: z.boolean().optional(),
  watermarkShowCourseTitle: z.boolean().optional(),
  watermarkShowTimestamp: z.boolean().optional(),
  watermarkEmailDisplayMode: z
    .enum(['FULL', 'MASKED'])
    .optional(),
  watermarkOpacityPercent: z
    .number()
    .int({ message: '透明度必須為整數' })
    .min(12, { message: '透明度不可低於 12%' })
    .max(28, { message: '透明度不可高於 28%' })
    .optional(),
  watermarkTextSize: z
    .enum(['SM', 'MD', 'LG'])
    .optional(),
  watermarkMovementMode: z
    .enum(['STANDARD', 'AGGRESSIVE'])
    .optional(),
  watermarkMoveIntervalSec: z
    .number()
    .int({ message: '移動間隔必須為整數' })
    .min(8, { message: '移動間隔至少 8 秒' })
    .max(20, { message: '移動間隔不可超過 20 秒' })
    .optional(),
  watermarkTamperPauseEnabled: z.boolean().optional(),
}).refine(
  (data) => {
    if (!data.watermarkEnabled) return true
    return (
      data.watermarkShowEmail ||
      data.watermarkShowCourseTitle ||
      data.watermarkShowTimestamp
    )
  },
  {
    message: '至少要顯示一項浮水印資訊',
    path: ['watermarkShowEmail'],
  }
)

export type CourseWatermarkFormData = z.infer<typeof courseWatermarkSchema>

/**
 * 課程詳細設定 Schema（課程資訊 tab，包含所有非定價欄位）
 */
export const courseDetailsSchema = courseInfoSchema
  .merge(courseMarketingSchema)
  .merge(courseWatermarkSchema)

export type CourseDetailsFormData = z.infer<typeof courseDetailsSchema>

/**
 * 從標題產生 Slug
 *
 * 純函式：相同輸入永遠回傳相同結果（不可加入 Date.now()、亂數等副作用，
 * 否則在「title 變動 → 自動生成 slug」的 effect 中會造成無限 setState 迴圈）。
 *
 * @param title 課程標題
 * @returns URL 安全的 Slug；若標題不含任何英數字（如純中文 / 注音）則回傳空字串，
 *          交由呼叫端決定如何處理（通常是留白讓使用者手動輸入）。
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // 僅保留英數字、空白與連字號（中文 / 注音等會被移除）
    .replace(/[^\w\s-]/g, '')
    // 將空格轉換為連字號
    .replace(/\s+/g, '-')
    // 移除連續的連字號
    .replace(/-+/g, '-')
    // 移除開頭和結尾的連字號
    .replace(/^-+|-+$/g, '')
}

/**
 * 課程搜尋參數 Schema
 */
export const courseSearchSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNLISTED', 'ALL']).optional(),
  salesVisibility: z.enum(['PUBLIC', 'UNLISTED', 'INVITE_ONLY', 'ALL']).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
})

export type CourseSearchParams = z.infer<typeof courseSearchSchema>
