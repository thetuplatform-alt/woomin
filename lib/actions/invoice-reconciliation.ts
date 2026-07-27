// lib/actions/invoice-reconciliation.ts
// 舊訂單發票資料修復（分支 4）：讓 admin 批次重新開立「已付款但發票資料
// 不完整」的訂單。不新寫發票開立邏輯，逐筆呼叫既有的 issueInvoiceAction()。
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 7.4。

'use server'

import { revalidatePath } from 'next/cache'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { issueInvoiceAction } from '@/lib/actions/einvoice'

export interface BatchReissueResult {
  orderId: string
  success: boolean
  error?: string
  invoiceNumber?: string
  skipped?: boolean
  message?: string
}

/**
 * 批次重新開立多筆訂單的發票。
 * 單筆呼叫失敗（不論是 issueInvoiceAction 回傳 success:false，或直接拋出
 * 例外）都不會中斷後續處理，每筆各自回傳結果。
 */
export async function batchReissueInvoicesAction(
  orderIds: string[]
): Promise<BatchReissueResult[]> {
  await requireOnlyAdminAuth()

  const results: BatchReissueResult[] = []

  for (const orderId of orderIds) {
    try {
      const result = await issueInvoiceAction(orderId)
      results.push({ orderId, ...result })
    } catch (error) {
      results.push({
        orderId,
        success: false,
        error: error instanceof Error ? error.message : '開立發票失敗',
      })
    }
  }

  if (orderIds.length > 0) {
    revalidatePath('/admin/payments/invoice-reconciliation')
    revalidatePath('/admin/orders')
  }

  return results
}
