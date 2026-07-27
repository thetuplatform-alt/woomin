// components/main/my-subscriptions/cancel-subscription-dialog.tsx
// 取消訂閱確認 Dialog（AC-56）。
// 文案照 PRD §4.7：實際存取截止日（含寬限）、分期不轉永久、已繳不退、恢復管道。

'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cancelMySubscription } from '@/lib/actions/subscriptions'
import type { MySubscription } from '@/lib/actions/subscriptions'

interface CancelSubscriptionDialogProps {
  subscription: MySubscription
  open: boolean
  onOpenChange: (open: boolean) => void
  onCanceled: () => void
}

function formatDate(date: Date | string | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function CancelSubscriptionDialog({
  subscription,
  open,
  onOpenChange,
  onCanceled,
}: CancelSubscriptionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accessEndsText = formatDate(subscription.accessEndsAt)
  const isFixedTerm = subscription.planType === 'FIXED_TERM'

  const handleCancel = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await cancelMySubscription(subscription.id)
      if (result.success) {
        onOpenChange(false)
        onCanceled()
      } else {
        setError(result.error || '取消失敗，請稍後再試')
      }
    } catch {
      setError('取消訂閱時發生錯誤')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-heading">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            取消訂閱「{subscription.courseTitle}」
          </DialogTitle>
          <DialogDescription className="text-body">
            取消後將立即停止未來扣款。請確認以下事項：
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5 rounded-xl border border-divider bg-surface/50 p-4 text-sm text-body">
          <li className="flex gap-2">
            <span className="text-cta">•</span>
            <span>
              取消後仍可觀看至{' '}
              <strong className="text-heading">
                {accessEndsText ?? '本期已付期間結束'}
              </strong>
              （已付期間內含寬限），屆時自動停止存取。
            </span>
          </li>
          {isFixedTerm && (
            <li className="flex gap-2">
              <span className="text-cta">•</span>
              <span>
                此為期限（分期）訂閱，
                <strong className="text-heading">中途取消不會轉為永久擁有</strong>。
              </span>
            </li>
          )}
          <li className="flex gap-2">
            <span className="text-cta">•</span>
            <span>已扣款的期款不會自動退款。</span>
          </li>
          <li className="flex gap-2">
            <span className="text-cta">•</span>
            <span>
              權限結束後，您可以隨時
              <strong className="text-heading">重新訂閱或買斷</strong>本課程。
            </span>
          </li>
        </ul>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            保留訂閱
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {isSubmitting ? '取消中…' : '確認取消訂閱'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
