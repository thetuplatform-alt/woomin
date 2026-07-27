// components/admin/orders/invoice-actions.tsx
// 訂單詳情頁的電子發票操作：開立 / 作廢 / 折讓 + 狀態顯示

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ReceiptText, Loader2, FileX, FileMinus } from 'lucide-react'
import {
  issueInvoiceAction,
  voidInvoiceAction,
  allowanceInvoiceAction,
} from '@/lib/actions/einvoice'
import type { InvoiceStatus } from '@prisma/client'

interface InvoiceInfo {
  provider: string
  status: InvoiceStatus
  invoiceNumber: string | null
  allowanceNumber: string | null
  allowanceAmount: number | null
  allowanceTotal: number
  allowancePendingNumber: string | null
  allowancePendingAmount: number | null
  allowancePendingExpiresAt: Date | string | null
  operationType: string | null
  failReason: string | null
}

interface InvoiceActionsProps {
  orderId: string
  orderNo: string
  amount: number
  invoice: InvoiceInfo | null
  /** 訂單退款已經會自動沖銷發票，僅在自動沖銷失敗時提供分開操作入口。 */
  showStandaloneOperations?: boolean
}

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  PENDING: { label: '發票待開立', className: 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]' },
  ISSUED: { label: '發票已開立', className: 'bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]' },
  FAILED: { label: '發票開立失敗', className: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]' },
  VOIDED: { label: '發票已作廢', className: 'bg-surface-hover text-body border border-divider' },
  ALLOWANCE: { label: '發票已折讓', className: 'bg-[#EDE9FE] text-[#5B21B6] border border-[#C4B5FD]' },
}

export function InvoiceActions({
  orderId,
  orderNo,
  amount,
  invoice,
  showStandaloneOperations = false,
}: InvoiceActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [voidOpen, setVoidOpen] = useState(false)
  const [allowanceOpen, setAllowanceOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [allowanceAmount, setAllowanceAmount] = useState(
    String(Math.max(0, amount - (invoice?.allowanceTotal ?? 0)))
  )

  const status = invoice?.status ?? null
  const canIssue = status === null || status === 'FAILED' || status === 'PENDING'
  const remainingAllowance = Math.max(0, amount - (invoice?.allowanceTotal ?? 0))
  const isEzpay = invoice?.provider === 'ezpay'
  const hasPendingOperation = !!invoice?.operationType || !!invoice?.allowancePendingNumber
  const canVoid = showStandaloneOperations && status === 'ISSUED' && !hasPendingOperation
  const canAllow =
    showStandaloneOperations &&
    (status === 'ISSUED' || status === 'ALLOWANCE') &&
    remainingAllowance > 0 &&
    !hasPendingOperation

  function handleIssue() {
    startTransition(async () => {
      const result = await issueInvoiceAction(orderId)
      if (result.success) {
        toast.success(
          result.message ??
            (result.invoiceNumber ? `發票已開立：${result.invoiceNumber}` : '發票處理完成')
        )
        router.refresh()
      } else {
        toast.error(result.error || '開立失敗')
      }
    })
  }

  function handleVoid() {
    startTransition(async () => {
      const result = await voidInvoiceAction(orderId, voidReason.trim() || '訂單作廢')
      if (result.success) {
        toast.success('發票已作廢')
        setVoidOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || '作廢失敗')
      }
    })
  }

  function handleAllowance() {
    const value = Number(allowanceAmount)
    if (!Number.isInteger(value) || value <= 0 || value > remainingAllowance) {
      toast.error('請輸入正確的折讓金額')
      return
    }
    if (isEzpay && (invoice?.allowanceTotal !== 0 || value !== amount)) {
      toast.error('ezPay 為避免重複折讓，目前僅支援一次全額折讓')
      return
    }
    startTransition(async () => {
      const result = await allowanceInvoiceAction(orderId, value)
      if (result.success) {
        toast.success(result.message ?? '折讓單已開立')
        setAllowanceOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || '折讓失敗')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status && (
        <Badge className={STATUS_BADGE[status].className}>
          {STATUS_BADGE[status].label}
          {invoice?.invoiceNumber ? `（${invoice.invoiceNumber}）` : ''}
        </Badge>
      )}

      {invoice?.allowancePendingNumber && (
        <Badge className="border border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]">
          線上折讓待買受人確認（{invoice.allowancePendingNumber}）
        </Badge>
      )}

      {canIssue && (
        <Button
          variant="outline"
          onClick={handleIssue}
          disabled={isPending}
          className="rounded-lg border-cta text-cta hover:bg-cta/10"
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ReceiptText className="mr-2 h-4 w-4" />
          )}
          {status === 'FAILED' ? '重新開立發票' : '開立發票'}
        </Button>
      )}

      {(canVoid || canAllow) && (
        <>
          {/* 作廢 */}
          {canVoid && <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="rounded-lg border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2]"
              >
                <FileX className="mr-2 h-4 w-4" />
                作廢發票
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl border-divider bg-white sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-heading">作廢發票</DialogTitle>
                <DialogDescription className="text-body">
                  作廢訂單 {orderNo} 的發票 {invoice?.invoiceNumber}。作廢有期限限制，跨期請改開折讓。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label className="text-heading">作廢原因</Label>
                <Textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="請輸入作廢原因"
                  maxLength={20}
                  className="min-h-[80px] rounded-lg border-divider"
                />
                <p className="text-xs text-caption">上限 20 個英數字；使用 ezPay 時中文請控制在 6 字內。</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVoidOpen(false)} className="rounded-lg border-divider">
                  取消
                </Button>
                <Button
                  onClick={handleVoid}
                  disabled={isPending}
                  className="rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                >
                  {isPending ? '處理中...' : '確認作廢'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>}

          {/* 折讓 */}
          {canAllow && <Dialog open={allowanceOpen} onOpenChange={setAllowanceOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-lg border-divider text-body hover:bg-surface">
                <FileMinus className="mr-2 h-4 w-4" />
                開立折讓
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl border-divider bg-white sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-heading">開立折讓單</DialogTitle>
                <DialogDescription className="text-body">
                  對發票 {invoice?.invoiceNumber} 開立折讓（退款 / 退課沖銷）。預設為全額。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label className="text-heading">折讓金額（含稅）</Label>
                <Input
                  type="number"
                  value={allowanceAmount}
                  onChange={(e) => setAllowanceAmount(e.target.value)}
                  max={remainingAllowance}
                  min={1}
                  readOnly={isEzpay}
                  className="rounded-lg border-divider font-mono"
                />
                <p className="text-xs text-caption">
                  {isEzpay
                    ? `ezPay 僅支援一次全額折讓：NT$ ${amount.toLocaleString()}`
                    : `剩餘可折讓：NT$ ${remainingAllowance.toLocaleString()}`}
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAllowanceOpen(false)}
                  className="rounded-lg border-divider"
                >
                  取消
                </Button>
                <Button
                  onClick={handleAllowance}
                  disabled={isPending}
                  className="rounded-lg bg-cta text-white hover:bg-cta-hover"
                >
                  {isPending ? '處理中...' : '確認折讓'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>}
        </>
      )}

      {status === 'FAILED' && invoice?.failReason && (
        <span className="text-xs text-[#DC2626]">{invoice.failReason}</span>
      )}
    </div>
  )
}
