// components/admin/invoices/reconciliation-list.tsx
// 舊訂單發票資料修復清單（分支 4）：依 missing / stuck / incompleteFields
// 三分類呈現，支援單筆「重新開立」與批次勾選重試。
// 不修改發票開立/驗證邏輯本身，只是重複呼叫既有的
// lib/actions/invoice-reconciliation.ts::batchReissueInvoicesAction()。

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, ReceiptText } from 'lucide-react'
import { batchReissueInvoicesAction } from '@/lib/actions/invoice-reconciliation'
import type {
  InvoiceReconciliationList,
  ReconciliationOrderItem,
} from '@/lib/invoice/reconciliation'

interface ReconciliationListProps {
  list: InvoiceReconciliationList
}

type SectionKey = keyof InvoiceReconciliationList

const SECTIONS: { key: SectionKey; title: string; description: string }[] = [
  {
    key: 'missing',
    title: '缺少發票記錄',
    description: '已付款，但完全沒有建立發票記錄的訂單。',
  },
  {
    key: 'stuck',
    title: '開立卡住',
    description: '已付款，發票狀態為待處理或開立失敗的訂單。',
  },
  {
    key: 'incompleteFields',
    title: '資料不完整',
    description: '發票狀態已顯示開立成功，但發票號碼或日期缺漏的訂單。',
  },
]

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReconciliationList({ list }: ReconciliationListProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowPending, setRowPending] = useState<Set<string>>(new Set())
  const [isBatchPending, startBatchTransition] = useTransition()

  const totalCount = list.missing.length + list.stuck.length + list.incompleteFields.length
  const isEmpty = totalCount === 0

  function toggle(orderId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(orderId)
      else next.delete(orderId)
      return next
    })
  }

  function toggleSection(items: ReconciliationOrderItem[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const item of items) {
        if (checked) next.add(item.orderId)
        else next.delete(item.orderId)
      }
      return next
    })
  }

  async function reissueOne(orderId: string) {
    setRowPending((prev) => new Set(prev).add(orderId))
    try {
      const results = await batchReissueInvoicesAction([orderId])
      const result = results[0]
      if (result?.success) {
        toast.success(
          result.message ??
            (result.invoiceNumber ? `發票已開立：${result.invoiceNumber}` : '發票處理完成')
        )
      } else {
        toast.error(result?.error || '重新開立失敗')
      }
    } finally {
      setRowPending((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
      router.refresh()
    }
  }

  function reissueSelected() {
    if (selected.size === 0) {
      toast.error('請先勾選要重新開立的訂單')
      return
    }
    const orderIds = Array.from(selected)
    startBatchTransition(async () => {
      const results = await batchReissueInvoicesAction(orderIds)
      const successCount = results.filter((r) => r.success).length
      const failCount = results.length - successCount
      if (failCount === 0) {
        toast.success(`已成功重新開立 ${successCount} 筆發票`)
      } else {
        toast.warning(`成功 ${successCount} 筆，失敗 ${failCount} 筆，請查看各筆狀態`)
      }
      setSelected(new Set())
      router.refresh()
    })
  }

  if (isEmpty) {
    return (
      <Card className="rounded-xl border-divider bg-white">
        <CardContent className="pt-6">
          <p className="py-8 text-center text-body">目前無發票資料不完整的訂單</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-surface/50 p-4">
        <p className="text-sm text-body">已勾選 {selected.size} 筆</p>
        <Button
          onClick={reissueSelected}
          disabled={isBatchPending || selected.size === 0}
          className="rounded-lg bg-cta text-white hover:bg-cta-hover"
        >
          {isBatchPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ReceiptText className="mr-2 h-4 w-4" />
          )}
          批次重新開立已勾選項目
        </Button>
      </div>

      {SECTIONS.map(({ key, title, description }) => {
        const items = list[key]
        if (items.length === 0) return null
        const allChecked = items.every((item) => selected.has(item.orderId))

        return (
          <Card key={key} className="rounded-xl border-divider bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-heading text-lg">
                    {title}（{items.length}）
                  </CardTitle>
                  <CardDescription className="text-body">{description}</CardDescription>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(checked) => toggleSection(items, checked === true)}
                  />
                  全選本區
                </label>
              </div>
              {key === 'stuck' && (
                <p className="mt-2 rounded-lg bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
                  部分失敗原因（例如 ECPay
                  會員載具映射根因）需等發票供應商整合修法生效後才能重試成功；在根因修復前，這裡的重試預期仍會以同樣原因失敗，這是已知且可接受的中間狀態。
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.orderId}
                  className="flex items-center gap-4 rounded-lg bg-surface p-3"
                >
                  <Checkbox
                    checked={selected.has(item.orderId)}
                    onCheckedChange={(checked) => toggle(item.orderId, checked === true)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-heading">{item.orderNo}</p>
                    <p className="text-xs text-caption">
                      NT$ {item.amount.toLocaleString()}・{formatDate(item.createdAt)}
                      {item.failReason ? `・${item.failReason}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rowPending.has(item.orderId)}
                    onClick={() => reissueOne(item.orderId)}
                    className="rounded-lg border-cta text-cta hover:bg-cta/10"
                  >
                    {rowPending.has(item.orderId) ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ReceiptText className="mr-2 h-4 w-4" />
                    )}
                    重新開立
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
