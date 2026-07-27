// components/main/landing/pages/default.tsx
// 預設銷售頁 — 當課程沒有對應的 React 銷售頁元件時使用
// 從 DB 資料自動組裝基本版面

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  MessageSquarePlus,
  Pencil,
  PlayCircle,
  Shield,
  Sparkles,
  Star,
  Target,
  Users,
} from 'lucide-react'
import type { LandingPageProps } from './types'
import { formatPrice } from '@/lib/utils/price'
import { describeAccessPolicy } from '@/lib/purchase/compute-expires-at'
import { CurriculumPreview, StickyCTA, FreeCourseCTA, AutoEnrollHandler } from '@/components/main/landing'
import { SubscriptionPlans } from '@/components/main/landing/subscription-plans'
import { ReviewSection } from '@/components/main/landing/review-section'
import { ReviewModal } from '@/components/main/landing/review-modal'
import { PurchasedCurriculumList } from '@/components/main/player/curriculum-list'

export default function DefaultLanding({
  course,
  purchaseStatus,
  isLoggedIn,
  isFree,
  finalPrice,
  originalPrice,
  isOnSale,
  shouldAutoEnroll,
  inviteToken,
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
  const accessLabel = describeAccessPolicy({
    accessType: course.accessType,
    accessDurationDays: course.accessDurationDays,
    accessExpiresAt: course.accessExpiresAt,
  })
  const durationLabel = formatDuration(course.totalDuration)
  const primaryLessonHref = purchaseStatus.firstLessonId
    ? `/courses/${course.slug}/lessons/${purchaseStatus.firstLessonId}`
    : `/courses/${course.slug}`
  const reviewCountLabel = reviewStats.reviewCount > 0 ? `${reviewStats.reviewCount} 則評價` : '學員評價開放中'
  const ratingLabel = reviewStats.reviewCount > 0 ? reviewStats.averageRating.toFixed(1) : course.ratingValue || '5.0'
  const instructorName = course.instructorName || '課程講師'
  const instructorTitle = course.instructorTitle || '實戰教學與課程設計'
  const instructorDesc = course.instructorDesc || '用清楚的架構帶你完成學習路徑，從基礎觀念到實作應用都能逐步跟上。'
  const headline = course.subtitle || course.description || '一套為實際學習成果設計的線上課程。'
  const outcomes = buildOutcomeItems(course)
  const audience = buildAudienceItems(course)
  const checkoutHref = `/checkout?courseId=${course.id}${
    inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ''
  }`

  // 已購買
  if (purchaseStatus.isPurchased) {
    return (
      <div className="flex flex-col bg-white">
        <section className="border-b border-divider bg-surface py-12 sm:py-16 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-lg bg-cta/10 px-3 py-1.5 text-sm font-semibold text-cta">
                <CheckCircle2 className="h-4 w-4" />
                已擁有課程
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-heading sm:text-5xl">
                {course.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-body sm:text-lg">
                {headline}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {purchaseStatus.firstLessonId && (
                  <Button asChild size="lg" className="rounded-lg bg-cta px-6 text-base font-semibold text-white hover:bg-cta-hover">
                    <Link href={primaryLessonHref}>
                      進入課程 <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                )}
                <Button asChild size="lg" variant="outline" className="rounded-lg border-divider px-6 text-base font-semibold text-heading hover:bg-white">
                  <Link href="#curriculum">
                    查看課綱 <BookOpen className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-divider bg-white">
              <CourseVisual course={course} />
              <div className="grid grid-cols-3 divide-x divide-divider border-t border-divider text-center">
                <MetricItem value={`${course.chapters.length}`} label="章節" />
                <MetricItem value={`${course.lessonCount}`} label="單元" />
                <MetricItem value={durationLabel} label="總時長" />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <ActionPanel
                icon={<PlayCircle className="h-5 w-5" />}
                title="接續學習"
                description="從第一個可觀看單元開始，快速回到課程內容。"
                href={primaryLessonHref}
                label="進入課程"
              />
              <ActionPanel
                icon={<BookOpen className="h-5 w-5" />}
                title="完整課綱"
                description={`${course.chapters.length} 個章節，${course.lessonCount} 個單元。`}
                href="#curriculum"
                label="查看內容"
              />
              {enableReviews && (
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="rounded-lg border border-divider bg-surface p-5 text-left transition-colors hover:border-cta/40 hover:bg-white"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cta/10 text-cta">
                    {userReview ? <Pencil className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
                  </span>
                  <span className="mt-4 block text-base font-bold text-heading">
                    {userReview ? '編輯評價' : '撰寫評價'}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-body">
                    分享你的學習體驗，幫助其他學員判斷是否適合。
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>

        <PurchasedCurriculumList course={course} firstLessonId={purchaseStatus.firstLessonId} />

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

  // 未購買
  return (
    <div className="flex flex-col bg-white">
      {shouldAutoEnroll && (
        <AutoEnrollHandler courseId={course.id} courseSlug={course.slug} />
      )}

      {/* Hero */}
      <section className="overflow-hidden border-b border-divider bg-white py-12 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-body">
              <Sparkles className="h-4 w-4 text-cta" />
              {isFree ? '免費課程' : isOnSale ? '限時優惠中' : '線上課程'}
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-heading sm:text-5xl lg:text-6xl">
              {course.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-body sm:text-xl">
              {headline}
            </p>
            {course.description && course.description !== headline && (
              <p className="mt-4 max-w-2xl text-base leading-7 text-body">
                {course.description}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {isFree ? (
                <FreeCourseCTA courseId={course.id} courseSlug={course.slug} isLoggedIn={isLoggedIn} />
              ) : (
                <Button asChild size="lg" className="rounded-lg bg-cta px-6 py-6 text-base font-semibold text-white hover:bg-cta-hover">
                  <Link href={checkoutHref}>
                    立即加入課程 <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
              <Button asChild size="lg" variant="outline" className="rounded-lg border-divider px-6 py-6 text-base font-semibold text-heading hover:bg-surface">
                <Link href="#curriculum">
                  查看課程大綱 <BookOpen className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <MiniFact icon={<BookOpen className="h-4 w-4" />} value={`${course.lessonCount} 個單元`} />
              <MiniFact icon={<Clock className="h-4 w-4" />} value={durationLabel} />
              <MiniFact icon={<Shield className="h-4 w-4" />} value={accessLabel} />
            </div>
          </div>

          <aside className="overflow-hidden rounded-lg border border-divider bg-surface">
            <CourseVisual course={course} />
            <div className="border-t border-divider bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-caption">課程價格</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    {isFree ? (
                      <span className="text-3xl font-bold text-heading">免費</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-heading">{formatPrice(finalPrice)}</span>
                        {isOnSale && (
                          <span className="text-sm text-caption line-through">
                            {formatPrice(originalPrice)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!isFree && isOnSale && (
                  <span className="rounded-lg bg-cta/10 px-3 py-1.5 text-sm font-bold text-cta">
                    優惠中
                  </span>
                )}
              </div>
              <div className="mt-5 grid gap-2 text-sm text-body">
                <TrustLine icon={<CheckCircle2 className="h-4 w-4" />} text="完成付款後立即開通課程" />
                <TrustLine icon={<Shield className="h-4 w-4" />} text={isFree ? '登入後即可加入學習' : '支援安全結帳與訂單紀錄'} />
                <TrustLine icon={<Star className="h-4 w-4" />} text={`${ratingLabel} / ${reviewCountLabel}`} />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-surface py-8">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
          <FeatureStat icon={<BookOpen className="h-5 w-5" />} title="結構化內容" text={`${course.chapters.length} 個章節，安排清楚的學習順序。`} />
          <FeatureStat icon={<Target className="h-5 w-5" />} title="可立即開始" text={course.courseWorkload || '依照自己的節奏完成每個單元。'} />
          <FeatureStat icon={<Award className="h-5 w-5" />} title="長期回看" text={accessLabel} />
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <SectionLabel>Learning Outcomes</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-heading sm:text-4xl">
              你會帶走什麼
            </h2>
            <div className="mt-6 grid gap-3">
              {outcomes.map((item) => (
                <InfoRow key={item} icon={<CheckCircle2 className="h-5 w-5" />} text={item} />
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Best For</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-heading sm:text-4xl">
              適合這樣的學員
            </h2>
            <div className="mt-6 grid gap-3">
              {audience.map((item) => (
                <InfoRow key={item} icon={<Users className="h-5 w-5" />} text={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 訂閱方案（AC-17/20：僅未購買且有啟用方案時渲染；空陣列自動不顯示） */}
      {!isFree && subscriptionPlans && subscriptionPlans.length > 0 && (
        <SubscriptionPlans
          courseId={course.id}
          courseSlug={course.slug}
          plans={subscriptionPlans}
          isOnSale={isOnSale}
          variant="light"
        />
      )}

      <section className="border-y border-divider bg-surface py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <SectionLabel>Instructor</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-heading sm:text-4xl">
              由 {instructorName} 帶你學
            </h2>
            <p className="mt-4 text-base leading-7 text-body">
              {instructorDesc}
            </p>
          </div>
          <div className="rounded-lg border border-divider bg-white p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-cta/10 text-2xl font-bold text-cta">
                {instructorName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-heading">{instructorName}</h3>
                <p className="mt-1 text-sm font-medium text-body">{instructorTitle}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MetricItem value={`${course.chapters.length}`} label="章節規劃" />
              <MetricItem value={`${course.lessonCount}`} label="課程單元" />
              <MetricItem value={durationLabel} label="內容時長" />
            </div>
          </div>
        </div>
      </section>

      {/* 課程大綱 */}
      <CurriculumPreview course={course} />

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

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-heading sm:text-4xl">
              購買前常見問題
            </h2>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <FaqItem
              question="付款後何時可以開始？"
              answer={isFree ? '免費加入成功後即可進入課程。' : '完成付款後系統會自動開通，並可在我的課程中繼續學習。'}
            />
            <FaqItem
              question="可以看多久？"
              answer={accessLabel}
            />
            <FaqItem
              question="需要照固定時間上課嗎？"
              answer="課程為線上內容，可依照自己的節奏安排觀看與複習。"
            />
          </div>
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="bg-heading py-16 text-white sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">Start Learning</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            準備好開始學習 {course.title} 了嗎？
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/70">
            現在加入，依照課程大綱逐步完成學習，並保留後續回看與複習的空間。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isFree ? (
              <FreeCourseCTA courseId={course.id} courseSlug={course.slug} isLoggedIn={isLoggedIn} />
            ) : (
              <Button asChild size="lg" className="rounded-lg bg-cta px-8 py-6 text-base font-semibold text-white hover:bg-cta-hover">
                <Link href={checkoutHref}>
                  立即加入課程 <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            <span className="text-sm text-white/60">
              {isFree ? '免費加入，不需付款' : '安全結帳，付款完成自動開通'}
            </span>
          </div>
        </div>
      </section>

      {/* Sticky CTA */}
      <StickyCTA
        courseId={course.id}
        courseSlug={course.slug}
        finalPrice={finalPrice}
        originalPrice={originalPrice}
        isOnSale={isOnSale}
        isFree={isFree}
        isLoggedIn={isLoggedIn}
        inviteToken={inviteToken}
        subscriptionPlans={subscriptionPlans}
      />
    </div>
  )
}

function CourseVisual({ course }: { course: LandingPageProps['course'] }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-hover">
      {course.coverImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={course.coverImage}
          alt={course.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-cta">
            <BookOpen className="h-8 w-8" />
          </div>
          <p className="max-w-xs px-6 text-sm font-semibold text-heading">
            {course.title}
          </p>
        </div>
      )}
      <div className="absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-heading backdrop-blur">
        線上課程
      </div>
    </div>
  )
}

function MetricItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 px-3 py-4">
      <p className="truncate text-base font-bold text-heading">{value}</p>
      <p className="mt-1 text-xs text-caption">{label}</p>
    </div>
  )
}

function MiniFact({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-divider bg-surface px-3 py-2 text-sm font-medium text-body">
      <span className="shrink-0 text-cta">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  )
}

function TrustLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-cta">{icon}</span>
      <span className="min-w-0">{text}</span>
    </div>
  )
}

function FeatureStat({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-divider bg-white p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cta/10 text-cta">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-bold text-heading">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-body">{text}</p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-cta">
      {children}
    </p>
  )
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-divider bg-surface p-4">
      <span className="mt-0.5 shrink-0 text-cta">{icon}</span>
      <p className="min-w-0 text-sm leading-6 text-body sm:text-base">{text}</p>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border border-divider bg-surface p-5">
      <h3 className="text-base font-bold text-heading">{question}</h3>
      <p className="mt-2 text-sm leading-6 text-body">{answer}</p>
    </div>
  )
}

function ActionPanel({
  icon,
  title,
  description,
  href,
  label,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-divider bg-surface p-5 transition-colors hover:border-cta/40 hover:bg-white"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cta/10 text-cta">
        {icon}
      </span>
      <span className="mt-4 block text-base font-bold text-heading">{title}</span>
      <span className="mt-1 block text-sm leading-6 text-body">{description}</span>
      <span className="mt-4 inline-flex items-center text-sm font-bold text-cta">
        {label} <ArrowRight className="ml-1 h-4 w-4" />
      </span>
    </Link>
  )
}

function formatDuration(totalSeconds: number) {
  if (!totalSeconds || totalSeconds <= 0) return '彈性學習'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)

  if (hours > 0 && minutes > 0) return `${hours} 小時 ${minutes} 分`
  if (hours > 0) return `${hours} 小時`
  return `${Math.max(minutes, 1)} 分鐘`
}

function buildOutcomeItems(course: LandingPageProps['course']) {
  const firstChapters = course.chapters.slice(0, 2).map((chapter) => `掌握「${chapter.title}」的核心觀念與實作脈絡。`)

  return [
    ...firstChapters,
    course.courseWorkload
      ? `依照 ${course.courseWorkload} 的節奏完成課程安排。`
      : '用清楚的單元順序建立完整學習路徑。',
    '保留課程內容作為後續複習與實作參考。',
  ].slice(0, 4)
}

function buildAudienceItems(course: LandingPageProps['course']) {
  return [
    '想用結構化課程節省摸索時間的學員。',
    course.lessonCount > 0
      ? `希望透過 ${course.lessonCount} 個單元循序推進的人。`
      : '希望從基礎到應用穩定前進的人。',
    '需要能夠彈性安排時間、反覆觀看複習的學習者。',
  ]
}
