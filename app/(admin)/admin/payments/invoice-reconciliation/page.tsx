// app/(admin)/admin/payments/invoice-reconciliation/page.tsx
// 舊訂單發票資料修復（分支 4）：讓 admin 一次看到所有已付款但發票資料
// 不完整的訂單，可單筆或批次重新開立。

import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { getInvoiceReconciliationList } from '@/lib/invoice/reconciliation'
import { ReconciliationList } from '@/components/admin/invoices/reconciliation-list'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '發票資料修復 | 後台',
}

export default async function InvoiceReconciliationPage() {
  await requireOnlyAdminAuth()

  const list = await getInvoiceReconciliationList()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-heading">舊訂單發票資料修復</h1>
        <p className="mt-1 text-body">
          列出所有已付款、但發票記錄缺失、開立卡住或資料不完整的訂單，可單筆或批次重新開立。
        </p>
      </div>

      <ReconciliationList list={list} />
    </div>
  )
}
