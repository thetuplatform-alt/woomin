// app/(admin)/admin/courses/[id]/reviews/page-client.tsx
// 課程評價管理 — 客戶端元件（含回覆、舉報標記）

'use client'

import { useState, useTransition } from 'react'
import { Star, Eye, EyeOff, MessageSquare, AlertTriangle, Send, Trash2, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  toggleReviewVisibility,
  updateEnableReviews,
  updateShowReviews,
  replyToReview,
  deleteReplyToReview,
} from '@/lib/actions/reviews-admin'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AdminReviewData, ReviewStats } from '@/lib/validations/review'

interface ReviewsAdminClientProps {
  courseId: string
  reviews: AdminReviewData[]
  stats: ReviewStats
  enableReviews: boolean
  showReviews: boolean
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-4 w-4',
            rating >= star
              ? 'fill-amber-400 text-amber-400'
              : 'text-gray-300'
          )}
        />
      ))}
    </div>
  )
}

function RatingDistribution({ stats }: { stats: ReviewStats }) {
  const maxCount = Math.max(...Object.values(stats.distribution), 1)

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = stats.distribution[star] || 0
        const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
        return (
          <div key={star} className="flex items-center gap-2 text-sm">
            <span className="w-6 text-right text-caption">{star}</span>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <div className="flex-1 h-2 rounded-full bg-surface-hover overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs text-caption">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function AdminReviewCard({
  review,
  onToggleVisibility,
  onReply,
  onDeleteReply,
  isPending,
  isTourAnchor = false,
}: {
  review: AdminReviewData
  onToggleVisibility: (id: string) => void
  onReply: (id: string, content: string) => void
  onDeleteReply: (id: string) => void
  isPending: boolean
  isTourAnchor?: boolean
}) {
  const [replyText, setReplyText] = useState(review.replyContent || '')
  const [isEditing, setIsEditing] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const hasReply = !!review.replyContent

  return (
    <div
      className={cn(
        'rounded-lg border border-divider p-4 transition-colors',
        !review.isVisible && 'bg-surface-hover opacity-60'
      )}
    >
      {/* 用戶資訊 + 操作 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {review.user.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={review.user.image}
              alt={review.user.name || '學員'}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-xs font-bold text-caption">
              {(review.user.name || '學')[0]}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-heading">
                {review.user.name || '匿名學員'}
              </p>
              {review.reportCount > 0 && (
                <button
                  {...(isTourAnchor ? { 'data-tour': 'review-report-badge' } : {})}
                  onClick={() => setShowReports(!showReports)}
                  className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-200"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {review.reportCount} 舉報
                </button>
              )}
              {!review.isVisible && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                  已隱藏
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StarDisplay rating={review.rating} />
              <span className="text-xs text-caption">
                {new Date(review.createdAt).toLocaleDateString('zh-TW')}
              </span>
              {review.helpfulCount > 0 && (
                <span className="text-xs text-caption">
                  · {review.helpfulCount} 人覺得有用
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          {...(isTourAnchor ? { 'data-tour': 'review-visibility-toggle' } : {})}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onToggleVisibility(review.id)}
          disabled={isPending}
          title={review.isVisible ? '隱藏此評價' : '顯示此評價'}
        >
          {review.isVisible ? (
            <EyeOff className="h-4 w-4 text-caption" />
          ) : (
            <Eye className="h-4 w-4 text-caption" />
          )}
        </Button>
      </div>

      {/* 評價內容 */}
      {review.content && (
        <p className="mt-2 text-sm leading-relaxed text-body pl-11">
          {review.content}
        </p>
      )}

      {/* 舉報詳情 */}
      {showReports && review.reports.length > 0 && (
        <div className="mt-2 ml-11 rounded-lg bg-red-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-700">舉報原因：</p>
          {review.reports.map((rp, i) => (
            <p key={i} className="text-xs text-red-600">
              · {rp.reason}（{new Date(rp.createdAt).toLocaleDateString('zh-TW')}）
            </p>
          ))}
        </div>
      )}

      {/* 回覆區域 */}
      <div
        {...(isTourAnchor ? { 'data-tour': 'review-reply-box' } : {})}
        className="mt-3 ml-11"
      >
        {hasReply && !isEditing ? (
          <div className="rounded-lg bg-surface p-3 border-l-2 border-cta/30">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-cta mb-1">講師回覆</p>
                <p className="text-sm text-body">{review.replyContent}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => { setIsEditing(true); setReplyText(review.replyContent || '') }}
                  title="編輯回覆"
                >
                  <Pencil className="h-3 w-3 text-caption" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onDeleteReply(review.id)}
                  disabled={isPending}
                  title="刪除回覆"
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Textarea
              placeholder="回覆學員..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                className="h-8 bg-cta text-white hover:bg-cta-hover"
                onClick={() => {
                  onReply(review.id, replyText)
                  setIsEditing(false)
                }}
                disabled={!replyText.trim() || isPending}
              >
                <Send className="h-3 w-3" />
              </Button>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setIsEditing(false)}
                >
                  取消
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ReviewsAdminClient({
  courseId,
  reviews: initialReviews,
  stats,
  enableReviews: initialEnableReviews,
  showReviews: initialShowReviews,
}: ReviewsAdminClientProps) {
  const [reviews, setReviews] = useState(initialReviews)
  const [enableReviews, setEnableReviews] = useState(initialEnableReviews)
  const [showReviews, setShowReviews] = useState(initialShowReviews)
  const [filterRating, setFilterRating] = useState<string>('all')
  const [isPending, startTransition] = useTransition()

  const handleToggleEnableReviews = (checked: boolean) => {
    setEnableReviews(checked)
    if (!checked) setShowReviews(false) // 關閉功能時連帶關閉顯示
    startTransition(async () => {
      const result = await updateEnableReviews(courseId, checked)
      if (!result.success) {
        setEnableReviews(!checked)
        if (!checked) setShowReviews(initialShowReviews)
        toast.error(result.error || '操作失敗')
      } else {
        toast.success(checked ? '已開啟評價功能' : '已關閉評價功能')
      }
    })
  }

  const handleToggleShowReviews = (checked: boolean) => {
    setShowReviews(checked)
    startTransition(async () => {
      const result = await updateShowReviews(courseId, checked)
      if (!result.success) {
        setShowReviews(!checked)
        toast.error(result.error || '操作失敗')
      } else {
        toast.success(checked ? '已開啟評價顯示' : '已關閉評價顯示')
      }
    })
  }

  const handleToggleVisibility = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, isVisible: !r.isVisible } : r
      )
    )

    startTransition(async () => {
      const result = await toggleReviewVisibility(reviewId)
      if (!result.success) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, isVisible: !r.isVisible } : r
          )
        )
        toast.error(result.error || '操作失敗')
      }
    })
  }

  const handleReply = (reviewId: string, content: string) => {
    startTransition(async () => {
      const result = await replyToReview({ reviewId, content })
      if (result.success) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, replyContent: content, replyAt: new Date().toISOString() }
              : r
          )
        )
        toast.success('回覆已送出')
      } else {
        toast.error(result.error || '回覆失敗')
      }
    })
  }

  const handleDeleteReply = (reviewId: string) => {
    startTransition(async () => {
      const result = await deleteReplyToReview(reviewId)
      if (result.success) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, replyContent: null, replyAt: null } : r
          )
        )
        toast.success('回覆已刪除')
      } else {
        toast.error(result.error || '刪除失敗')
      }
    })
  }

  const filteredReviews =
    filterRating === 'all'
      ? reviews
      : reviews.filter((r) => r.rating === parseInt(filterRating))

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 h-full overflow-y-auto">
      {/* 評價設定 */}
      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="enable-reviews" className="text-sm font-medium text-heading">
                啟用評價功能
              </Label>
              <p className="text-xs text-caption">
                關閉後，學員將無法撰寫評價，所有評價入口消失
              </p>
            </div>
            <Switch
              id="enable-reviews"
              data-tour="enable-reviews-switch"
              checked={enableReviews}
              onCheckedChange={handleToggleEnableReviews}
              disabled={isPending}
            />
          </div>
          {enableReviews && (
            <>
              <div className="border-t border-divider" />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="show-reviews" className="text-sm font-medium text-heading">
                    在銷售頁顯示評價
                  </Label>
                  <p className="text-xs text-caption">
                    開啟後，評價區塊將出現在課程銷售頁上
                  </p>
                </div>
                <Switch
                  id="show-reviews"
                  data-tour="show-reviews-switch"
                  checked={showReviews}
                  onCheckedChange={handleToggleShowReviews}
                  disabled={isPending}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 統計卡片 */}
      <div data-tour="review-stats" className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-caption">平均評分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-heading">
                {stats.reviewCount > 0 ? stats.averageRating : '-'}
              </span>
              {stats.reviewCount > 0 && <StarDisplay rating={stats.averageRating} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-caption">評價數量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-heading">{stats.reviewCount}</span>
              <MessageSquare className="h-5 w-5 text-caption" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-caption">星等分佈</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingDistribution stats={stats} />
          </CardContent>
        </Card>
      </div>

      {/* 評價列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-heading">
            所有評價
          </CardTitle>
          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="篩選星等" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="5">5 星</SelectItem>
              <SelectItem value="4">4 星</SelectItem>
              <SelectItem value="3">3 星</SelectItem>
              <SelectItem value="2">2 星</SelectItem>
              <SelectItem value="1">1 星</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredReviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-caption">
              {reviews.length === 0 ? '目前還沒有評價' : '沒有符合篩選條件的評價'}
            </p>
          ) : (
            filteredReviews.map((review, index) => (
              <AdminReviewCard
                key={review.id}
                review={review}
                onToggleVisibility={handleToggleVisibility}
                onReply={handleReply}
                onDeleteReply={handleDeleteReply}
                isPending={isPending}
                isTourAnchor={index === 0}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
