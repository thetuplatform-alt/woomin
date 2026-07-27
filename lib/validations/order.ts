// lib/validations/order.ts
// 訂單相關的 Zod 驗證 Schema
// 用於驗證搜尋、退款資料

import { z } from 'zod'

/**
 * 訂單狀態 Enum
 */
export const OrderStatusEnum = z.enum([
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
])

/**
 * 付款方式 Enum
 */
export const PaymentMethodEnum = z.enum([
  'CREDIT_CARD',
  'APPLE_PAY',
  'GOOGLE_PAY',
  'ATM',
  'CVS',
])

/**
 * 驗證日期格式是否有效 (YYYY-MM-DD)
 */
function isValidDateString(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

/**
 * 訂單搜尋 Schema
 */
export const orderSearchSchema = z.object({
  search: z.string().optional(),
  status: OrderStatusEnum.optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  startDate: z.string()
    .optional()
    .refine(
      (val) => !val || isValidDateString(val),
      { message: '開始日期格式無效，請使用 YYYY-MM-DD' }
    ),
  endDate: z.string()
    .optional()
    .refine(
      (val) => !val || isValidDateString(val),
      { message: '結束日期格式無效，請使用 YYYY-MM-DD' }
    ),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
}).refine(
  (data) => {
    // 如果兩個日期都存在，驗證開始日期不能晚於結束日期
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate)
    }
    return true
  },
  {
    message: '開始日期不能晚於結束日期',
    path: ['startDate'],
  }
)

// 輸入類型（允許省略有 default 的欄位）
export type OrderSearchInput = z.input<typeof orderSearchSchema>
// 輸出類型（解析後保證有值）
export type OrderSearchData = z.output<typeof orderSearchSchema>

/**
 * 退款 Schema
 */
export const refundSchema = z.object({
  orderId: z.string().min(1, '訂單 ID 為必填'),
  reason: z
    .string()
    .min(1, '退款原因為必填')
    .max(500, '退款原因不得超過 500 字'),
  manualRefundConfirmed: z.boolean(),
})

export type RefundData = z.infer<typeof refundSchema>

/**
 * 匯出 CSV 參數 Schema
 */
export const exportCsvSchema = z.object({
  search: z.string().optional(),
  status: OrderStatusEnum.optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export type ExportCsvData = z.infer<typeof exportCsvSchema>
