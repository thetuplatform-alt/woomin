// components/main/landing/pages/ios-vibe-coding.tsx
// iOS Vibe Coding 課程專屬銷售頁
// 完整的 7 段式轉換漏斗結構

'use client'

import { useState } from 'react'
import type { LandingPageProps } from './types'
import {
  LandingHeroSection,
  CourseGlanceSection,
  TestimonialSection,
  ProblemSection,
  CurriculumPreview,
  InstructorSection,
  FAQSection,
  PricingSection,
  StickyCTA,
  FreeCourseCTA,
  AutoEnrollHandler,
} from '@/components/main/landing'
import { PurchasedCurriculumList } from '@/components/main/player/curriculum-list'
import { ReviewSection } from '@/components/main/landing/review-section'
import { ReviewModal } from '@/components/main/landing/review-modal'
import { Button } from '@/components/ui/button'
import { MessageSquarePlus, Pencil } from 'lucide-react'

export default function IosVibeCodingLanding({
  course,
  purchaseStatus,
  isLoggedIn,
  isFree,
  finalPrice,
  originalPrice,
  isOnSale,
  saleEndAt,
  saleLabel,
  countdownTarget,
  saleCycleEnabled,
  saleCycleDays,
  showCountdown,
  shouldAutoEnroll,
  reviewStats,
  reviews,
  reviewsHasMore,
  userReview,
  enableReviews,
  showReviews,
  currentUserId,
  subscriptionPlans,
}: LandingPageProps) {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)

  // 已購買用戶：顯示課程大綱（可點擊進入）+ 簡化的 Hero
  if (purchaseStatus.isPurchased) {
    return (
      <div className="flex flex-col">
        <LandingHeroSection
          course={course}
          isPurchased={true}
          firstLessonId={purchaseStatus.firstLessonId}
        />
        {enableReviews && (
          <div className="flex justify-center bg-white py-4">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8 text-base font-semibold"
              onClick={() => setIsReviewModalOpen(true)}
            >
              {userReview ? (
                <><Pencil className="mr-2 h-4 w-4" />編輯評價</>
              ) : (
                <><MessageSquarePlus className="mr-2 h-4 w-4" />撰寫評價</>
              )}
            </Button>
          </div>
        )}
        <PurchasedCurriculumList
          course={course}
          firstLessonId={purchaseStatus.firstLessonId}
        />
        {/* 評價區塊 */}
        <ReviewSection
          courseId={course.id}
          reviewStats={reviewStats}
          initialReviews={reviews}
          initialHasMore={reviewsHasMore}
          userReview={userReview}
          isPurchased={purchaseStatus.isPurchased}
          isLoggedIn={isLoggedIn}
          enableReviews={enableReviews}
          showReviews={showReviews}
          currentUserId={currentUserId}
        />
        <FAQSection />

        {/* 評價 Modal */}
        {enableReviews && (
          <ReviewModal
            open={isReviewModalOpen}
            onOpenChange={setIsReviewModalOpen}
            courseId={course.id}
            existingReview={userReview}
          />
        )}
      </div>
    )
  }

  // 未購買用戶：顯示 7 段式轉換漏斗
  return (
    <div className="flex flex-col">
      {/* 自動加入處理器 - 僅在需要時渲染 */}
      {shouldAutoEnroll && (
        <AutoEnrollHandler courseId={course.id} courseSlug={course.slug} />
      )}

      {/* 1. Hero — 對齊廣告 hook，首屏 CTA */}
      <LandingHeroSection
        course={course}
        isFree={isFree}
        isLoggedIn={isLoggedIn}
        finalPrice={finalPrice}
        originalPrice={originalPrice}
        isOnSale={isOnSale}
        saleEndAt={saleEndAt}
        saleLabel={saleLabel}
        countdownTarget={countdownTarget}
        saleCycleEnabled={saleCycleEnabled}
        saleCycleDays={saleCycleDays}
        showCountdown={showCountdown}
      />

      {/* 2. 痛點 → 解決方案（合併） */}
      <ProblemSection />

      {/* 3. 課程旅程 — 6 階段 + IAP 預告 */}
      <CurriculumPreview course={course} />

      {/* 3.5 課程資訊橫幅 — Course At a Glance */}
      <CourseGlanceSection />

      {/* 4. Social Proof — 精選學員見證 + marquee */}
      <TestimonialSection courseId={course.id} />

      {/* 5. 講師 + 信任（合併 Service/Toolkit/Bonus） */}
      <InstructorSection />

      {/* 6. 終極 CTA + 價格（免費課程不顯示）— 附訂閱方案 */}
      {!isFree && <PricingSection course={course} plans={subscriptionPlans} />}

      {/* 7. FAQ — 精簡 4 題 */}
      <FAQSection />

      {/* 手機端 Sticky CTA */}
      <StickyCTA
        courseId={course.id}
        courseSlug={course.slug}
        finalPrice={finalPrice}
        originalPrice={originalPrice}
        isOnSale={isOnSale}
        isFree={isFree}
        isLoggedIn={isLoggedIn}
        subscriptionPlans={subscriptionPlans}
      />

      {/* 免費課程底部 CTA */}
      {isFree && (
        <section className="bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
              準備好開始了嗎？
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-body">
              這堂課程限時免費，立即加入開始你的學習旅程！
            </p>
            <div className="mt-8 flex justify-center">
              <FreeCourseCTA
                courseId={course.id}
                courseSlug={course.slug}
                isLoggedIn={isLoggedIn}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
