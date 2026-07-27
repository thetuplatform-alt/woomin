// lib/payment/shared.ts
// 金流共用工具函數

import crypto from 'crypto'

/**
 * 產生訂單編號
 * 格式: ORD + 日期(YYYYMMDD) + 12位隨機十六進制字串
 * 總長度: 3 + 8 + 12 = 23 字元（PAYUNi MerTradeNo 保守上限）
 * 隨機性: 6 bytes = 48 bits
 */
export function generateOrderNo(): string {
  const now = new Date()
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0')
  const random = crypto.randomBytes(6).toString('hex')
  return `ORD${dateStr}${random}`
}
