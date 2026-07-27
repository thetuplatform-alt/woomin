// components/admin/subscriptions/cancel-subscription-dialog.tsx
// 後台代學員取消訂閱 Dialog（AC-60）。
// 明示：立即停止未來扣款、已付期間內仍可觀看至實際截止日、分期不轉永久、已繳不退。

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Ban, AlertTriangle } from 'lucide-react'
import { adminCancelSubscription } from '@/lib/actions/subscriptions-admin'
import { toast } from 'sonner'

interface CancelSubscriptionDialogProps {
  subscriptionId: string
  isFixedTerm: boolean
  accessEndsAt: Date | null
}

export function CancelSubscriptionDialog({
  subscriptionId,
  isFixedTerm,
  accessEndsAt,
}: CancelSubscriptionDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleCancel = async () => {
    try {
      setIsSubmitting(true)
      const result = await adminCancelSubscription(subscriptionId, reason)
      if (!result.success) {
        throw new Error(result.error || '取消失敗')
      }
      toast.success('已取消訂閱')
      setOpen(false)
      setReason('')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '取消失敗，請稍後再試')
    } finally {
      setIsSubmitting(false)
    }
  }

  const accessEndsLabel = accessEndsAt
    ? format(new Date(accessEndsAt), 'yyyy/MM/dd', { locale: zhTW })
    : '本期期末'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#991B1B] rounded-lg"
        >
          <Ban className="mr-2 h-4 w-4" />
          代取消訂閱
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white border-divider sm:max-w-[460px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-heading flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-cta" />
            代學員取消訂閱
          </DialogTitle>
          <DialogDescription className="text-body">
            此操作會<strong>立即停止未來扣款</strong>。學員在已付期間內仍可觀看至{' '}
            <strong>{accessEndsLabel}</strong>（含寬限期），屆時自然斷權。
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[#FCD34D] bg-[#FEF3C7] p-3 text-sm text-[#92400E] space-y-1">
          <p>取消後：</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {isFixedTerm && <li>期限訂閱<strong>不會轉為永久擁有</strong>。</li>}
            <li>已扣款的期款<strong>不會自動退款</strong>（需退款請至該期訂單處理）。</li>
            <li>學員可於權限結束後重新訂閱或買斷。</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label className="text-heading">取消原因（選填，記入操作日誌）</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：學員來信要求取消"
            className="bg-white border-divider text-heading placeholder:text-caption min-h-[80px] rounded-lg"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
          >
            返回
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleCancel}
            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg"
          >
            {isSubmitting ? '處理中...' : '確認取消訂閱'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
