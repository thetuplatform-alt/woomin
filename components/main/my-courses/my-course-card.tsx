// components/main/my-courses/my-course-card.tsx
// 我的課程卡片 - 顯示課程封面、進度和狀態

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, CheckCircle2, PlayCircle, ArrowRight, Star, Pencil, Clock, AlertTriangle, Lock, RefreshCw, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ReviewModal } from '@/components/main/landing/review-modal'
import type { MyCourse } from '@/lib/actions/my-courses'

interface MyCourseCardProps {
  course: MyCourse
  index: number
}

export function MyCourseCard({ course, index }: MyCourseCardProps) {
  const { progress, isCompleted, lastLesson, review, enableReviews, isExpired, daysUntilExpiration, expiresAt, subscription } = course
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)

  // 訂閱徽章文案（AC-57）
  const subscriptionBadge = subscription
    ? {
        ACTIVE: { label: '訂閱中', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        PAST_DUE: { label: '扣款失敗', className: 'bg-red-100 text-red-700 border-red-200' },
        CANCELED: { label: '已取消訂閱', className: 'bg-surface-hover text-caption border-divider' },
        COMPLETED: { label: subscription.isFixedTerm ? '分期繳清' : '訂閱結束', className: 'bg-amber-50 text-amber-700 border-amber-200' },
      }[subscription.status]
    : null

  const nextBillingText =
    subscription?.status === 'ACTIVE' && subscription.nextBillingAt
      ? new Date(subscription.nextBillingAt).toLocaleDateString('zh-TW', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null

  // 已過期 → 導向銷售頁；其餘照舊
  const targetUrl = isExpired
    ? `/courses/${course.slug}`
    : lastLesson
      ? `/courses/${course.slug}/lessons/${lastLesson.id}`
      : `/courses/${course.slug}`

  const isExpiringSoon =
    !isExpired && daysUntilExpiration !== null && daysUntilExpiration <= 7
  const isExpiringMedium =
    !isExpired && daysUntilExpiration !== null && daysUntilExpiration <= 30 && daysUntilExpiration > 7

  const expiresDateText = expiresAt
    ? new Date(expiresAt).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link href={targetUrl} className="group block h-full">
        <Card
          className={`h-full overflow-hidden border-divider bg-white transition-all duration-300 hover:border-cta/30 hover:shadow-xl hover:shadow-cta/5 ${
            isExpired ? 'opacity-70' : ''
          }`}
        >
          {/* 封面圖片區域 */}
          <div className="relative aspect-video overflow-hidden">
            {course.coverImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={course.coverImage}
                alt={course.title}
                className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
                  isExpired ? 'grayscale' : ''
                }`}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface-hover">
                <BookOpen className="h-12 w-12 text-caption" />
              </div>
            )}

            {/* 過期徽章（最高優先級） */}
            {isExpired ? (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 shadow-sm">
                <Lock className="h-3.5 w-3.5 text-white" />
                <span className="text-xs font-bold text-white">已過期</span>
              </div>
            ) : isExpiringSoon ? (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 shadow-sm backdrop-blur-sm border border-red-200">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                <span className="text-xs font-bold text-red-700">
                  剩 {daysUntilExpiration} 天
                </span>
              </div>
            ) : isExpiringMedium ? (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 shadow-sm backdrop-blur-sm border border-amber-200">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-bold text-amber-700">
                  剩 {daysUntilExpiration} 天
                </span>
              </div>
            ) : isCompleted ? (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                <CheckCircle2 className="h-4 w-4 text-cta" />
                <span className="text-xs font-bold text-heading">已完成</span>
              </div>
            ) : null}

            {/* 訂閱徽章（左上角，與右側到期/完成徽章分列不衝突） */}
            {subscriptionBadge && (
              <div
                className={`absolute left-3 top-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-sm backdrop-blur-sm ${subscriptionBadge.className}`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">{subscriptionBadge.label}</span>
              </div>
            )}

            {/* 進度條覆蓋在圖片底部 */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/20 to-transparent">
              <Progress
                value={progress.progressPercentage}
                className="h-1.5 bg-white/30"
                indicatorClassName="bg-cta"
              />
            </div>

            {/* Hover 狀態 Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
               <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cta text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                  <PlayCircle className="h-6 w-6 fill-current" />
               </div>
            </div>
          </div>

          {/* 課程資訊 */}
          <CardContent className="flex flex-col flex-1 p-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                 <span className="inline-block rounded-md bg-surface-hover px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-caption">
                    {isCompleted ? 'Finished' : 'Learning'}
                 </span>
              </div>
              
              <h3 className="line-clamp-2 text-xl font-bold text-heading transition-colors group-hover:text-cta">
                {course.title}
              </h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-body">
                    {progress.completedLessons} / {progress.totalLessons} 單元
                  </span>
                  <span className="font-bold text-heading">
                    {progress.progressPercentage}%
                  </span>
                </div>
              </div>

              {expiresDateText && !isExpired && (
                <p
                  className={`text-xs ${
                    isExpiringSoon
                      ? 'text-red-600 font-medium'
                      : isExpiringMedium
                        ? 'text-amber-700'
                        : 'text-caption'
                  }`}
                >
                  觀看期限：{expiresDateText}
                </p>
              )}
              {isExpired && expiresDateText && (
                <p className="text-xs text-red-600 font-medium">
                  已於 {expiresDateText} 到期，點擊可重新購買
                </p>
              )}

              {/* 訂閱管理入口（AC-57）：下次扣款日 + 連向 /my-subscriptions */}
              {subscription && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2">
                  <span className="text-xs text-caption">
                    {subscription.status === 'ACTIVE' && nextBillingText
                      ? `下次扣款：${nextBillingText}`
                      : subscription.status === 'PAST_DUE'
                        ? '扣款失敗，請前往處理'
                        : subscription.status === 'CANCELED'
                          ? '訂閱已取消'
                          : subscription.isFixedTerm
                            ? '分期已繳清'
                            : '訂閱已結束'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      window.location.assign('/my-subscriptions')
                    }}
                    className="flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-cta transition-colors hover:text-cta-hover"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    管理訂閱
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-surface-hover pt-4">
               <span className="text-sm font-medium text-body flex items-center gap-1">
                  {isExpired ? '重新購買' : isCompleted ? '重新觀看' : '繼續學習'}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
               </span>
               {enableReviews && (
                 <button
                   onClick={(e) => {
                     e.preventDefault()
                     e.stopPropagation()
                     setIsReviewModalOpen(true)
                   }}
                   className="flex items-center gap-1 text-sm text-caption transition-colors hover:text-cta"
                 >
                   {review ? (
                     <>
                       <div className="flex">
                         {[1, 2, 3, 4, 5].map((star) => (
                           <Star
                             key={star}
                             className={`h-3 w-3 ${
                               review.rating >= star
                                 ? 'fill-amber-400 text-amber-400'
                                 : 'text-gray-300'
                             }`}
                           />
                         ))}
                       </div>
                       <Pencil className="h-3 w-3" />
                     </>
                   ) : (
                     <>
                       <Star className="h-3.5 w-3.5" />
                       <span>給予評價</span>
                     </>
                   )}
                 </button>
               )}
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Review Modal */}
      <ReviewModal
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
        courseId={course.id}
        existingReview={review ? {
          id: review.id,
          rating: review.rating,
          content: review.content,
        } : null}
      />
    </motion.div>
  )
}

