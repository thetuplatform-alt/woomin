// lib/validations/checkout.ts
// 結帳流程相關的 Zod 驗證 Schema

import { z } from 'zod'
import { checkoutInvoiceSchema } from '@/lib/validations/einvoice'

/**
 * 建立訂單請求 Schema
 *
 * 訂閱制擴充（AC-22 / AC-29）：
 * - planId：選定的訂閱方案（帶此欄位即走訂閱結帳路徑）
 * - recurringConsent：自動扣款同意；帶 planId 時後端強制必為 true（法遵存證前提）
 * - 訂閱路徑不支援優惠券：planId + couponCode 併存直接拒絕（前後端一致，AC-29）
 * - 訂閱僅適用單一課程：planId 不得與 bundleId 併存
 */
export const createOrderSchema = z
  .object({
    courseId: z.string().min(1, '課程 ID 為必填').optional(),
    bundleId: z.string().min(1, '組合包 ID 為必填').optional(),
    email: z.string().email('請輸入有效的電子郵件').optional(),
    name: z.string().trim().max(50, '姓名不能超過 50 個字元').optional(),
    couponCode: z.string().max(50).optional(),
    invite: z.string().trim().min(1).max(256).optional(),
    generalEmailConsent: z.boolean().optional().default(false),
    marketingConsent: z.boolean().optional().default(false),
    // 臺灣電子發票買受人資訊（發票功能啟用時由結帳頁送出）
    invoice: checkoutInvoiceSchema.optional(),
    // 訂閱方案（帶此欄位即走訂閱結帳分支）
    planId: z.string().min(1, '訂閱方案 ID 為必填').optional(),
    // 自動扣款同意（訂閱必勾；帶 planId 時後端強制驗證為 true）
    recurringConsent: z.boolean().optional(),
  })
  .refine((data) => !!data.courseId !== !!data.bundleId, {
    message: '請指定課程或組合包其中一種商品',
    path: ['courseId'],
  })
  // 訂閱僅適用單一課程，不得與組合包併存
  .refine((data) => !data.planId || !data.bundleId, {
    message: '訂閱方案不適用於組合包',
    path: ['planId'],
  })
  // 訂閱路徑不支援優惠券（v1 訂閱不支援券，AC-29）
  .refine((data) => !data.planId || !data.couponCode, {
    message: '訂閱方案不支援優惠券',
    path: ['couponCode'],
  })
  // 帶 planId 時必須同意定期自動扣款（AC-22）
  .refine((data) => !data.planId || data.recurringConsent === true, {
    message: '必須同意定期自動扣款條款才能訂閱',
    path: ['recurringConsent'],
  })

export type CreateOrderData = z.infer<typeof createOrderSchema>
