// components/main/landing/pages/react-beginner.tsx
// React 給新手的入門磚 — 免費課程專屬行銷頁
// 簡潔風格，重點在讓人有興趣學習

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Code, Layers, Zap, RefreshCw, ArrowRight, MessageSquarePlus, Pencil } from 'lucide-react'
import type { LandingPageProps } from './types'
import {
  FAQSection,
  StickyCTA,
  FreeCourseCTA,
  AutoEnrollHandler,
} from '@/components/main/landing'
import { SubscriptionPlans } from '@/components/main/landing/subscription-plans'
import { PurchasedCurriculumList } from '@/components/main/player/curriculum-list'
import { ReviewSection } from '@/components/main/landing/review-section'
import { ReviewModal } from '@/components/main/landing/review-modal'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// 五個單元的概覽資料
const lessons = [
  {
    icon: BookOpen,
    number: 1,
    title: '出發前的準備',
    description: '了解為什麼選擇 React、課程目標與最終成品展示。在正式動手前，先建立正確的學習心態。',
  },
  {
    icon: Code,
    number: 2,
    title: '基礎',
    description: '認識 React 專案結構、JSX 語法的本質與四大規則。學會在 JSX 中插入變數、綁定事件與撰寫樣式。',
  },
  {
    icon: Layers,
    number: 3,
    title: '元件',
    description: '掌握 React 最核心的概念 — 元件。學習如何拆分畫面、透過 Props 傳遞資料，以及 children 的靈活運用。',
  },
  {
    icon: Zap,
    number: 4,
    title: '狀態',
    description: '使用 useState 在元件中管理資料。理解狀態的運作原理、雙向綁定，以及元件之間共享資料的「狀態提升」模式。',
  },
  {
    icon: RefreshCw,
    number: 5,
    title: '效果與 Functional Programming',
    description: '學習 useEffect 處理副作用，實作存檔與讀檔功能。最後認識 Functional Programming 的核心觀念，為進階學習打下基礎。',
  },
]

export default function ReactBeginnerLanding({
  course,
  purchaseStatus,
  isLoggedIn,
  isFree,
  finalPrice,
  originalPrice,
  isOnSale,
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

  // 已購買用戶
  if (purchaseStatus.isPurchased) {
    return (
      <div className="flex flex-col">
        {/* 簡化 Hero */}
        <section className="bg-white py-12 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-5xl">
              {course.title}
            </h1>
            <p className="mt-4 text-lg text-body">{course.subtitle}</p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {purchaseStatus.firstLessonId && (
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-cta px-8 text-base font-semibold text-white hover:bg-cta-hover"
                >
                  <Link
                    href={`/courses/${course.slug}/lessons/${purchaseStatus.firstLessonId}`}
                  >
                    進入課程 <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
              {enableReviews && (
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
              )}
            </div>
          </div>
        </section>
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

  // 未購買用戶
  return (
    <div className="flex flex-col">
      {shouldAutoEnroll && (
        <AutoEnrollHandler courseId={course.id} courseSlug={course.slug} />
      )}

      {/* Hero Section */}
      <section className="bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            免費課程
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold tracking-tight text-heading sm:text-5xl lg:text-6xl"
          >
            {course.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-body sm:text-xl"
          >
            {course.subtitle}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-body"
          >
            專為零 React 經驗的初學者設計，只要你會基礎 JavaScript，就能跟著這五堂課一步步掌握
            React 的核心觀念，從 JSX、元件、狀態到副作用處理，最終完成一個個人履歷編輯器。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-10 flex justify-center"
          >
            <FreeCourseCTA
              courseId={course.id}
              courseSlug={course.slug}
              isLoggedIn={isLoggedIn}
            />
          </motion.div>

          {/* 信任信號 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-caption"
          >
            <span>5 個單元</span>
            <span className="hidden sm:inline">|</span>
            <span>完整文字講義</span>
            <span className="hidden sm:inline">|</span>
            <span>永久觀看</span>
          </motion.div>
        </div>
      </section>

      {/* 這堂課適合誰 */}
      <section className="border-t border-surface-hover bg-surface py-12 sm:py-16 lg:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl font-bold text-heading sm:text-3xl lg:text-4xl"
            >
              這堂課適合你嗎？
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mx-auto mt-4 max-w-2xl text-base text-body"
            >
              如果你符合以下任何一項，這堂課就是為你準備的。
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-10 grid gap-4 sm:grid-cols-2"
          >
            {[
              '會基礎 JavaScript，想開始學前端框架',
              '聽過 React 但不知道從何下手',
              '看過文件或教學，但覺得觀念零散、難以串連',
              '想用一個實際專案來驗證自己學到的東西',
            ].map((text, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-divider bg-white p-5"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cta/10 text-xs font-bold text-cta">
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-heading sm:text-base">
                  {text}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 課程大綱 */}
      <section className="bg-white py-12 sm:py-16 lg:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-sm font-bold tracking-widest text-cta uppercase"
            >
              Curriculum
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mt-3 text-2xl font-bold text-heading sm:text-3xl lg:text-4xl"
            >
              五堂課，帶你走完 React 入門之路
            </motion.h2>
          </div>

          <div className="mt-10 space-y-4 sm:mt-12">
            {lessons.map((lesson, index) => {
              const Icon = lesson.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="flex gap-4 rounded-2xl border border-divider bg-white p-5 sm:gap-6 sm:p-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cta/10 sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5 text-cta sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold tracking-wider text-caption uppercase">
                      Part {lesson.number}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-heading sm:text-lg">
                      {lesson.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-body">
                      {lesson.description}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 講師簡介 */}
      <section className="border-t border-surface-hover bg-surface py-12 sm:py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            Instructor
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-2xl font-bold text-heading sm:text-3xl"
          >
            關於講師
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-8 rounded-2xl border border-divider bg-white p-6 text-left sm:p-8"
          >
            <h3 className="text-lg font-bold text-heading">Fish</h3>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-body">
              <p>
                FillCast CoFounder、台灣大學課程網前端工程師，同時擁有遊戲開發經驗。
              </p>
              <p>
                擅長將複雜的技術概念拆解成新手也能理解的知識點，用最直覺的方式帶你建立扎實的基礎。
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <ReactFAQSection />

      {/* 訂閱方案（AC-18：付費且有方案時渲染；免費課/空陣列自動不顯示） */}
      {!isFree && subscriptionPlans && subscriptionPlans.length > 0 && (
        <SubscriptionPlans
          courseId={course.id}
          courseSlug={course.slug}
          plans={subscriptionPlans}
          isOnSale={isOnSale}
          variant="light"
        />
      )}

      {/* 底部 CTA */}
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
            準備好開始了嗎？
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-body">
            完全免費，不需要信用卡，立即開始你的 React 學習之旅。
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

      {/* Sticky CTA */}
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
    </div>
  )
}

// React 課程專屬 FAQ
function ReactFAQSection() {
  const faqs = [
    {
      question: '需要什麼基礎才能上這堂課？',
      answer:
        '你需要會基礎的 JavaScript 語法，例如知道 function、變數、陣列是什麼。課程不會從頭教 JavaScript，但會帶到一些 ES6 的新語法。',
    },
    {
      question: '課程有觀看期限嗎？',
      answer:
        '沒有。課程一旦加入就是永久觀看，你可以依照自己的節奏學習，隨時回來複習。',
    },
    {
      question: '這堂課真的完全免費嗎？',
      answer:
        '是的，五堂課全部免費開放，包含影片與完整文字講義，沒有任何隱藏費用。',
    },
    {
      question: '學完之後能做什麼？',
      answer:
        '你將掌握 React 的核心基礎，包含 JSX、元件、狀態管理與副作用處理，足以開始獨立建構簡單的 React 應用程式，也能銜接更進階的 React 課程或專案。',
    },
  ]

  return (
    <section className="bg-surface py-10 sm:py-14 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            F.A.Q
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-2xl font-bold text-heading sm:text-3xl lg:text-4xl"
          >
            你可能想問的問題
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8 space-y-3 sm:mt-10"
        >
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group overflow-hidden rounded-2xl border border-divider bg-white"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-bold text-heading transition-colors hover:text-cta sm:text-base [&::-webkit-details-marker]:hidden">
                {faq.question}
                <span className="ml-4 shrink-0 text-caption transition-transform group-open:rotate-180">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 text-sm leading-relaxed text-body sm:text-base">
                {faq.answer}
              </div>
            </details>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-caption">
            還有其他問題？
            <a
              href="mailto:fish@fishot.com"
              className="ml-1.5 font-bold text-heading underline decoration-cta decoration-2 underline-offset-4 transition-colors hover:text-cta"
            >
              聯繫我們
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
