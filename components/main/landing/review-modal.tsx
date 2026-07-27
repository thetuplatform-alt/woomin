// components/main/landing/review-modal.tsx
// 課程評價 Modal — 星等評分 + 文字輸入

'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createReview, updateReview } from '@/lib/actions/reviews'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  existingReview?: {
    id: string
    rating: number
    content: string | null
  } | null
}

export function ReviewModal({
  open,
  onOpenChange,
  courseId,
  existingReview,
}: ReviewModalProps) {
  const isEditing = !!existingReview
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [content, setContent] = useState(existingReview?.content || '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (rating === 0) {
      setError('請選擇評分')
      return
    }
    setError('')

    startTransition(async () => {
      const result = isEditing
        ? await updateReview({
            reviewId: existingReview!.id,
            rating,
            content: content || undefined,
          })
        : await createReview({
            courseId,
            rating,
            content: content || undefined,
          })

      if (result.success) {
        toast.success(isEditing ? '評價已更新' : '感謝您的評價！')
        onOpenChange(false)
      } else {
        toast.error(result.error || '操作失敗')
      }
    })
  }

  // Reset state when modal opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setRating(existingReview?.rating || 0)
      setContent(existingReview?.content || '')
      setError('')
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold text-heading">
            {isEditing ? '編輯評價' : '為這門課程評分'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 星等評分 */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-transform hover:scale-110"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => {
                    setRating(star)
                    setError('')
                  }}
                >
                  <Star
                    className={cn(
                      'h-8 w-8 transition-colors',
                      (hoveredRating || rating) >= star
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-300'
                    )}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-body">
                {rating === 1 && '不太滿意'}
                {rating === 2 && '有待改善'}
                {rating === 3 && '還不錯'}
                {rating === 4 && '很滿意'}
                {rating === 5 && '非常推薦！'}
              </p>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          {/* 文字輸入 */}
          <div className="space-y-2">
            <Textarea
              placeholder="分享你的學習心得...（選填）"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={2000}
              className="resize-none"
            />
            <p className="text-right text-xs text-caption">
              {content.length} / 2000
            </p>
          </div>

          {/* 按鈕 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              className="flex-1 bg-cta text-white hover:bg-cta-hover"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? '送出中...' : isEditing ? '更新評價' : '送出評價'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
