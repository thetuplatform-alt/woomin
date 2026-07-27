// components/main/landing/review-section.tsx
// 銷售頁評價區塊 — 平均評分、排序、分頁、按讚、舉報、講師回覆

'use client'

import { useState, useTransition } from 'react'
import { Star, MessageSquarePlus, Pencil, ThumbsUp, Flag, ChevronDown, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ReviewModal } from './review-modal'
import { toggleHelpful, reportReview, getReviews } from '@/lib/actions/reviews'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ReviewStats, ReviewData, UserReview, ReviewSortBy } from '@/lib/validations/review'
import { REPORT_REASONS } from '@/lib/validations/review'

interface ReviewSectionProps {
  courseId: string
  reviewStats: ReviewStats
  initialReviews: ReviewData[]
  initialHasMore: boolean
  userReview: UserReview | null
  isPurchased: boolean
  isLoggedIn: boolean
  enableReviews: boolean  // 評價功能總開關（關閉後無法評價）
  showReviews: boolean    // 銷售頁顯示評價區塊
  currentUserId?: string | null
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClass,
            rating >= star
              ? 'fill-amber-400 text-amber-400'
              : rating >= star - 0.5
                ? 'fill-amber-400/50 text-amber-400'
                : 'text-gray-300'
          )}
        />
      ))}
    </div>
  )
}

function ReviewCard({
  review,
  isOwn,
  isLoggedIn,
  onHelpfulToggle,
  onReport,
}: {
  review: ReviewData
  isOwn: boolean
  isLoggedIn: boolean
  onHelpfulToggle: (reviewId: string) => void
  onReport: (reviewId: string) => void
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-divider bg-white p-5',
        isOwn && 'ring-2 ring-cta/20'
      )}
    >
      {/* 用戶資訊 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {review.user.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={review.user.image}
              alt={review.user.name || '學員'}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-sm font-bold text-caption">
              {(review.user.name || '學')[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-heading">
              {review.user.name || '學員'}
              {isOwn && (
                <span className="ml-2 text-xs text-cta">（你的評價）</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} />
              <span className="text-xs text-caption">
                {new Date(review.createdAt).toLocaleDateString('zh-TW')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 評價內容 */}
      {review.content && (
        <p className="mt-3 text-sm leading-relaxed text-body">
          {review.content}
        </p>
      )}

      {/* 講師回覆 */}
      {review.replyContent && (
        <div className="mt-3 rounded-lg bg-surface p-3 border-l-2 border-cta/30">
          <p className="text-xs font-semibold text-cta mb-1">講師回覆</p>
          <p className="text-sm text-body">{review.replyContent}</p>
          {review.replyAt && (
            <p className="mt-1 text-[10px] text-caption">
              {new Date(review.replyAt).toLocaleDateString('zh-TW')}
            </p>
          )}
        </div>
      )}

      {/* 互動按鈕 */}
      {isLoggedIn && !isOwn && (
        <div className="mt-3 flex items-center gap-4 border-t border-divider pt-3">
          <button
            onClick={() => onHelpfulToggle(review.id)}
            className={cn(
              'flex items-center gap-1 text-xs transition-colors',
              review.isHelpful
                ? 'text-cta font-medium'
                : 'text-caption hover:text-body'
            )}
          >
            <ThumbsUp className={cn('h-3.5 w-3.5', review.isHelpful && 'fill-current')} />
            有用{review.helpfulCount > 0 && ` (${review.helpfulCount})`}
          </button>
          {!review.hasReported && (
            <button
              onClick={() => onReport(review.id)}
              className="flex items-center gap-1 text-xs text-caption transition-colors hover:text-red-500"
            >
              <Flag className="h-3.5 w-3.5" />
              舉報
            </button>
          )}
          {review.hasReported && (
            <span className="flex items-center gap-1 text-xs text-caption">
              <Flag className="h-3.5 w-3.5" />
              已舉報
            </span>
          )}
        </div>
      )}

      {/* 未登入時只顯示有用數 */}
      {!isLoggedIn && review.helpfulCount > 0 && (
        <div className="mt-3 border-t border-divider pt-3">
          <span className="flex items-center gap-1 text-xs text-caption">
            <ThumbsUp className="h-3.5 w-3.5" />
            {review.helpfulCount} 人覺得有用
          </span>
        </div>
      )}
    </div>
  )
}

export function ReviewSection({
  courseId,
  reviewStats,
  initialReviews,
  initialHasMore,
  userReview,
  isPurchased,
  isLoggedIn,
  enableReviews,
  showReviews,
  currentUserId,
}: ReviewSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reviews, setReviews] = useState<ReviewData[]>(initialReviews)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<ReviewSortBy>('helpful')
  const [isLoadingMore, startLoadMore] = useTransition()
  const [isSorting, startSort] = useTransition()

  // 舉報 Modal
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportTargetId, setReportTargetId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [isReporting, startReport] = useTransition()

  if (!enableReviews) return null
  if (!showReviews && !isPurchased) return null
  if (reviewStats.reviewCount === 0 && !isPurchased) return null

  const handleSortChange = (newSort: ReviewSortBy) => {
    setSortBy(newSort)
    startSort(async () => {
      const result = await getReviews(courseId, { sortBy: newSort, page: 1, limit: 10 })
      setReviews(result.reviews)
      setHasMore(result.hasMore)
      setPage(1)
    })
  }

  const handleLoadMore = () => {
    const nextPage = page + 1
    startLoadMore(async () => {
      const result = await getReviews(courseId, { sortBy, page: nextPage, limit: 10 })
      setReviews((prev) => [...prev, ...result.reviews])
      setHasMore(result.hasMore)
      setPage(nextPage)
    })
  }

  const handleHelpfulToggle = (reviewId: string) => {
    // Optimistic update
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id !== reviewId) return r
        const newIsHelpful = !r.isHelpful
        return {
          ...r,
          isHelpful: newIsHelpful,
          helpfulCount: r.helpfulCount + (newIsHelpful ? 1 : -1),
        }
      })
    )

    toggleHelpful(reviewId).then((result) => {
      if (!result.success) {
        // Rollback
        setReviews((prev) =>
          prev.map((r) => {
            if (r.id !== reviewId) return r
            const rollback = !r.isHelpful
            return {
              ...r,
              isHelpful: rollback,
              helpfulCount: r.helpfulCount + (rollback ? 1 : -1),
            }
          })
        )
        toast.error(result.error || '操作失敗')
      }
    })
  }

  const handleOpenReport = (reviewId: string) => {
    setReportTargetId(reviewId)
    setReportReason('')
    setReportModalOpen(true)
  }

  const handleSubmitReport = () => {
    if (!reportTargetId || !reportReason) return

    startReport(async () => {
      const result = await reportReview({ reviewId: reportTargetId, reason: reportReason })
      if (result.success) {
        toast.success('已送出舉報')
        setReviews((prev) =>
          prev.map((r) => r.id === reportTargetId ? { ...r, hasReported: true } : r)
        )
        setReportModalOpen(false)
      } else {
        toast.error(result.error || '舉報失敗')
      }
    })
  }

  return (
    <section className="py-12 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* 標題 + 統計 */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-heading sm:text-3xl">
              學員評價
            </h2>
            {reviewStats.reviewCount > 0 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <StarRating rating={reviewStats.averageRating} size="lg" />
                <span className="text-2xl font-bold text-heading">
                  {reviewStats.averageRating}
                </span>
                <span className="text-body">
                  （{reviewStats.reviewCount} 則評價）
                </span>
              </div>
            )}
          </div>

          {/* 操作列：撰寫/編輯 + 排序 */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {isPurchased && isLoggedIn && (
              <Button
                onClick={() => setIsModalOpen(true)}
                variant="outline"
                className="gap-2 rounded-full border-cta/30 text-cta hover:bg-cta/5"
              >
                {userReview ? (
                  <>
                    <Pencil className="h-4 w-4" />
                    編輯評價
                  </>
                ) : (
                  <>
                    <MessageSquarePlus className="h-4 w-4" />
                    撰寫評價
                  </>
                )}
              </Button>
            )}

            {reviewStats.reviewCount > 1 && (
              <Select value={sortBy} onValueChange={(v) => handleSortChange(v as ReviewSortBy)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="helpful">最有用</SelectItem>
                  <SelectItem value="newest">最新</SelectItem>
                  <SelectItem value="highest">最高分</SelectItem>
                  <SelectItem value="lowest">最低分</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 評價列表 */}
          <div className={cn('space-y-4', isSorting && 'opacity-50')}>
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  isOwn={!!currentUserId && review.user.id === currentUserId}
                  isLoggedIn={isLoggedIn}
                  onHelpfulToggle={handleHelpfulToggle}
                  onReport={handleOpenReport}
                />
              ))
            ) : (
              isPurchased && (
                <p className="text-center text-body py-8">
                  還沒有評價，成為第一個評價的人吧！
                </p>
              )
            )}
          </div>

          {/* 載入更多 */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-2 rounded-full"
              >
                {isLoadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                載入更多評價
              </Button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Review Modal */}
      <ReviewModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        courseId={courseId}
        existingReview={userReview ? {
          id: userReview.id,
          rating: userReview.rating,
          content: userReview.content,
        } : null}
      />

      {/* Report Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>舉報評價</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <RadioGroup value={reportReason} onValueChange={setReportReason}>
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={`report-${r.value}`} />
                  <Label htmlFor={`report-${r.value}`} className="text-sm">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setReportModalOpen(false)}
                disabled={isReporting}
              >
                取消
              </Button>
              <Button
                className="flex-1 bg-red-500 text-white hover:bg-red-600"
                onClick={handleSubmitReport}
                disabled={!reportReason || isReporting}
              >
                {isReporting ? '送出中...' : '送出舉報'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
