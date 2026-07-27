// lib/invoice/reconciliation.ts
// 舊訂單發票資料修復（分支 4）：讓 admin 一次看到所有「已付款但發票資料
// 不完整」的訂單。這裡只做「分類、讀取」，不修改發票開立/驗證邏輯本身
// （那是 lib/invoice/service.ts / lib/invoice/provider.ts 的職責）。
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 7.3。

import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import type { InvoiceStatus } from '@prisma/client'

export interface ReconciliationOrderItem {
  orderId: string
  orderNo: string
  amount: number
  createdAt: Date
  invoiceStatus: InvoiceStatus | null
  failReason: string | null
}

export interface InvoiceReconciliationList {
  /** PAID 訂單但完全沒有 Invoice 記錄 */
  missing: ReconciliationOrderItem[]
  /** PAID 訂單且 Invoice 狀態為 FAILED 或 PENDING（開立卡住） */
  stuck: ReconciliationOrderItem[]
  /** Invoice 狀態為 ISSUED，但 invoiceNumber 或 invoiceDate 為 null（資料不完整） */
  incompleteFields: ReconciliationOrderItem[]
}

/**
 * 取得所有「已付款但發票資料不完整」的訂單，依三種情境分類。
 * 財稅性質資料，僅限 ADMIN（不含講師/EDITOR）。
 */
export async function getInvoiceReconciliationList(): Promise<InvoiceReconciliationList> {
  await requireOnlyAdminAuth()

  const orders = await prisma.order.findMany({
    where: { status: 'PAID' },
    select: {
      id: true,
      orderNo: true,
      amount: true,
      createdAt: true,
      invoice: {
        select: {
          status: true,
          invoiceNumber: true,
          invoiceDate: true,
          failReason: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const missing: ReconciliationOrderItem[] = []
  const stuck: ReconciliationOrderItem[] = []
  const incompleteFields: ReconciliationOrderItem[] = []

  for (const order of orders) {
    const invoice = order.invoice

    const item: ReconciliationOrderItem = {
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      createdAt: order.createdAt,
      invoiceStatus: invoice?.status ?? null,
      failReason: invoice?.failReason ?? null,
    }

    if (!invoice) {
      missing.push(item)
    } else if (invoice.status === 'FAILED' || invoice.status === 'PENDING') {
      stuck.push(item)
    } else if (invoice.status === 'ISSUED' && (!invoice.invoiceNumber || !invoice.invoiceDate)) {
      incompleteFields.push(item)
    }
    // 其餘情況（ISSUED 且欄位完整 / VOIDED / ALLOWANCE）不需要修復，不列入任何分類。
  }

  return { missing, stuck, incompleteFields }
}
