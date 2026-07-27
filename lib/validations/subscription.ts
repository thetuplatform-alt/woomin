// lib/validations/subscription.ts
// 課程訂閱制相關的 Zod 驗證 Schema。
// 純 zod，不 import server SDK，以免進 client bundle。

import { z } from 'zod'

/** 對映 Prisma enum */
export const SubscriptionPlanTypeEnum = z.enum(['UNLIMITED', 'FIXED_TERM'])
export const BillingIntervalEnum = z.enum(['MONTH', 'YEAR'])
export const TermEndBehaviorEnum = z.enum(['GRANT_LIFETIME', 'END_ACCESS'])

/** FIXED_TERM 期數上下限（PAYUNi PeriodTimes 上限 900） */
export const SUBSCRIPTION_MIN_TOTAL_PERIODS = 2
export const SUBSCRIPTION_MAX_TOTAL_PERIODS = 900
/** PAYUNi PeriodAmt 官方上限；Stripe 同步沿用可避免兩 gateway 切換後方案失效。 */
export const SUBSCRIPTION_MAX_PERIOD_AMOUNT = 199_999
/** YEAR 方案 renewalReminderDays 最小值（卡組織 pre-billing 通知要求） */
export const SUBSCRIPTION_MIN_YEAR_REMINDER_DAYS = 7

/**
 * 建立 / 編輯訂閱方案 Schema（後台課程定價 tab）。
 *
 * 規則：
 * - price 為 ≥2 的正整數（PAYUNi PeriodAmt 下限 >1 元）
 * - FIXED_TERM：totalPeriods 必填且為 2–900
 * - UNLIMITED：禁止填 totalPeriods
 * - YEAR：renewalReminderDays 必填且 ≥7；MONTH 可留空（null）
 */
export const subscriptionPlanSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, '方案名稱為必填')
      .max(100, '方案名稱不得超過 100 字'),
    type: SubscriptionPlanTypeEnum,
    interval: BillingIntervalEnum,
    price: z.coerce
      .number()
      .int('每期金額必須為整數')
      .min(2, '每期金額至少為 2 元')
      .max(
        SUBSCRIPTION_MAX_PERIOD_AMOUNT,
        `每期金額不得超過 ${SUBSCRIPTION_MAX_PERIOD_AMOUNT.toLocaleString('zh-TW')} 元`
      ),
    totalPeriods: z.coerce
      .number()
      .int('期數必須為整數')
      .min(
        SUBSCRIPTION_MIN_TOTAL_PERIODS,
        `期數至少為 ${SUBSCRIPTION_MIN_TOTAL_PERIODS} 期`
      )
      .max(
        SUBSCRIPTION_MAX_TOTAL_PERIODS,
        `期數不得超過 ${SUBSCRIPTION_MAX_TOTAL_PERIODS} 期`
      )
      .optional()
      .nullable(),
    termEndBehavior: TermEndBehaviorEnum.default('GRANT_LIFETIME'),
    renewalReminderDays: z.coerce
      .number()
      .int('提醒天數必須為整數')
      .min(1, '提醒天數至少為 1 天')
      .max(60, '提醒天數不得超過 60 天')
      .optional()
      .nullable(),
    enabled: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (data) =>
      data.type !== 'FIXED_TERM' ||
      (data.totalPeriods != null &&
        data.totalPeriods >= SUBSCRIPTION_MIN_TOTAL_PERIODS &&
        data.totalPeriods <= SUBSCRIPTION_MAX_TOTAL_PERIODS),
    {
      message: `期限訂閱必須填寫期數（${SUBSCRIPTION_MIN_TOTAL_PERIODS}–${SUBSCRIPTION_MAX_TOTAL_PERIODS} 期）`,
      path: ['totalPeriods'],
    }
  )
  .refine((data) => data.type !== 'UNLIMITED' || data.totalPeriods == null, {
    message: '無限訂閱不可填寫期數',
    path: ['totalPeriods'],
  })
  .refine(
    (data) =>
      data.interval !== 'YEAR' ||
      (data.renewalReminderDays != null &&
        data.renewalReminderDays >= SUBSCRIPTION_MIN_YEAR_REMINDER_DAYS),
    {
      message: `年繳方案必須設定即將扣款提醒天數，且至少 ${SUBSCRIPTION_MIN_YEAR_REMINDER_DAYS} 天`,
      path: ['renewalReminderDays'],
    }
  )

export type SubscriptionPlanInput = z.infer<typeof subscriptionPlanSchema>

/**
 * 訂閱結帳輸入 Schema 片段（供 createOrderSchema 擴充 / 結帳組使用）。
 * - planId：選定的訂閱方案
 * - recurringConsent：自動扣款同意，後端必為 true 否則 4xx（法遵存證前提）
 */
export const subscriptionCheckoutFieldsSchema = z.object({
  planId: z.string().min(1, '訂閱方案 ID 為必填'),
  recurringConsent: z.literal(true, {
    message: '必須同意定期自動扣款條款才能訂閱',
  }),
})

export type SubscriptionCheckoutFields = z.infer<
  typeof subscriptionCheckoutFieldsSchema
>
