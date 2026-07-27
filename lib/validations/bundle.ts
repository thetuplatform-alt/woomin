// lib/validations/bundle.ts
// 組合包與邀請制資料模型的基礎驗證 contract。

import { z } from 'zod'
import { mediaUrlSchema } from '@/lib/validations/media-url'

export const bundleStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
export const bundleVisibilityEnum = z.enum(['PUBLIC', 'UNLISTED'])

export const bundleStatusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已發佈' },
  { value: 'ARCHIVED', label: '已封存' },
] as const

export const bundleVisibilityOptions = [
  { value: 'PUBLIC', label: '公開販售' },
  { value: 'UNLISTED', label: '連結販售' },
] as const

export const bundleSchema = z.object({
  title: z
    .string()
    .min(2, { message: '組合包名稱至少需要 2 個字元' })
    .max(120, { message: '組合包名稱不能超過 120 個字元' }),
  slug: z
    .string()
    .min(2, { message: 'Slug 至少需要 2 個字元' })
    .max(100, { message: 'Slug 不能超過 100 個字元' })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'Slug 只能包含小寫字母、數字和連字號',
    }),
  description: z
    .string()
    .max(5000, { message: '描述不能超過 5000 個字元' })
    .optional()
    .nullable(),
  coverImage: z
    .string()
    .pipe(mediaUrlSchema('請輸入有效的圖片網址'))
    .optional()
    .nullable()
    .or(z.literal('')),
  price: z
    .number()
    .int({ message: '價格必須為整數' })
    .min(0, { message: '價格不能為負數' }),
  salePrice: z
    .number()
    .int({ message: '促銷價必須為整數' })
    .min(0, { message: '促銷價不能為負數' })
    .optional()
    .nullable(),
  status: bundleStatusEnum.default('DRAFT'),
  visibility: bundleVisibilityEnum.default('PUBLIC'),
  courseIds: z
    .array(z.string().min(1))
    .min(1, { message: '組合包至少需要包含一門課程' }),
}).refine(
  (data) => data.salePrice === null || data.salePrice === undefined || data.salePrice < data.price,
  { message: '促銷價必須小於原價', path: ['salePrice'] }
)

export type BundleFormData = z.infer<typeof bundleSchema>

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
