// components/admin/subscriptions/reauth-button.tsx
// PAYUNi PAST_DUE 訂閱的「重新扣款」按鈕（mdfStatus reauth）。
// 僅對 PAYUNi + PAST_DUE 顯示；扣款成功後由 period Notify 回來走正常入帳。

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { reauthSubscription } from '@/lib/actions/subscriptions-admin'
import { toast } from 'sonner'

interface ReauthButtonProps {
  subscriptionId: string
}

export function ReauthButton({ subscriptionId }: ReauthButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleReauth = async () => {
    try {
      setIsSubmitting(true)
      const result = await reauthSubscription(subscriptionId)
      if (!result.success) {
        throw new Error(result.error || '重新扣款失敗')
      }
      toast.success('已送出重新扣款請求，扣款結果將於稍後由金流通知回報')
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '重新扣款失敗，請稍後再試'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isSubmitting}
      onClick={handleReauth}
      className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isSubmitting ? 'animate-spin' : ''}`} />
      {isSubmitting ? '處理中...' : 'PAYUNi 重新扣款'}
    </Button>
  )
}
