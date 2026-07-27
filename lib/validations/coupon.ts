// lib/validations/coupon.ts
// 優惠券相關的 Zod 驗證 Schema

import { z } from 'zod'

/**
 * 折扣類型 Enum
 */
export const DiscountTypeEnum = z.enum(['AMOUNT', 'PERCENT'])

/**
 * 建立/編輯優惠券 Schema
 */
export const couponSchema = z.object({
  name: z.string().min(1, '優惠券名稱為必填').max(100, '名稱不得超過 100 字'),
  code: z.string()
    .min(1, '優惠碼為必填')
    .max(50, '優惠碼不得超過 50 字')
    .regex(/^[A-Za-z0-9_-]+$/, '優惠碼只能包含英文字母、數字、底線和連字號')
    .transform((v) => v.toUpperCase()),
  description: z.string().max(500, '說明不得超過 500 字').optional().nullable(),
  discountType: DiscountTypeEnum,
  amountOff: z.coerce.number().int().positive('折抵金額必須大於 0').optional().nullable(),
  percentOff: z.coerce.number().int().min(1, '百分比最小為 1').max(100, '百分比最大為 100').optional().nullable(),
  maxDiscountAmount: z.coerce.number().int().positive('折扣上限必須大於 0').optional().nullable(),
  maxRedemptions: z.coerce.number().int().min(0, '兌換上限不可為負數').optional().nullable().default(0),
  maxPerUser: z.coerce.number().int().min(0, '個人上限不可為負數').optional().nullable().default(0),
  minimumAmount: z.coerce.number().int().positive('最低消費必須大於 0').optional().nullable(),
  firstTimeOnly: z.boolean().default(false),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  courseIds: z.array(z.string()).default([]),
  bundleIds: z.array(z.string()).default([]),
}).refine(
  (data) => {
    if (data.discountType === 'AMOUNT') {
      return data.amountOff != null && data.amountOff > 0
    }
    return true
  },
  { message: '固定金額折扣時，折抵金額為必填', path: ['amountOff'] }
).refine(
  (data) => {
    if (data.discountType === 'PERCENT') {
      return data.percentOff != null && data.percentOff >= 1 && data.percentOff <= 100
    }
    return true
  },
  { message: '百分比折扣時，百分比為必填（1-100）', path: ['percentOff'] }
).refine(
  (data) => {
    if (data.startsAt && data.expiresAt) {
      return new Date(data.startsAt) < new Date(data.expiresAt)
    }
    return true
  },
  { message: '生效時間必須早於到期時間', path: ['startsAt'] }
)

export type CouponFormData = z.infer<typeof couponSchema>

/**
 * 驗證優惠碼 Schema
 */
export const validateCouponSchema = z.object({
  code: z.string().min(1, '優惠碼為必填').transform((v) => v.toUpperCase().trim()),
  courseId: z.string().min(1, '課程 ID 為必填').optional(),
  bundleId: z.string().min(1, '組合包 ID 為必填').optional(),
}).refine((data) => !!data.courseId !== !!data.bundleId, {
  message: '請指定課程或組合包其中一種商品',
  path: ['courseId'],
})

export type ValidateCouponData = z.infer<typeof validateCouponSchema>
