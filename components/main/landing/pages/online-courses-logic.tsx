// components/main/landing/pages/online-courses-logic.tsx
// 「線上課程的底層邏輯」專屬銷售頁

'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers,
  MessageSquarePlus,
  Pencil,
  PlayCircle,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils/price'
import { describeAccessPolicy } from '@/lib/purchase/compute-expires-at'
import type { LandingPageProps } from './types'
import {
  AutoEnrollHandler,
  FreeCourseCTA,
  StickyCTA,
} from '@/components/main/landing'
import { ReviewSection } from '@/components/main/landing/review-section'
import { ReviewModal } from '@/components/main/landing/review-modal'
import { PurchasedCurriculumList } from '@/components/main/player/curriculum-list'

const pillars = [
  {
    icon: Target,
    title: '心態',
    text: '先看懂學習線上課程前該有的判斷方式，不再被單一技巧牽著走。',
  },
  {
    icon: Zap,
    title: '行銷',
    text: '拆解一堂課如何被包裝、被看見、被購買，理解背後的成交邏輯。',
  },
  {
    icon: Layers,
    title: '經營',
    text: '看見課程不是一次交易，而是內容、信任與長期關係的累積。',
  },
  {
    icon: Sparkles,
    title: '情感',
    text: '理解學員為什麼被打動，也看懂自己真正想從課程得到什麼。',
  },
]

const audience = [
  '買過很多課，卻常常學完沒有真正改變的人。',
  '想做自己的知識產品，但還看不懂課程市場的人。',
  '想判斷一堂課值不值得買，不想只靠衝動下單的人。',
  '希望從講師、經營者、學員三個角度理解線上課程的人。',
]

const outcomes = [
  '你會更清楚自己為什麼要學一門課。',
  '你會看懂課程銷售頁背後的設計與說服方式。',
  '你會理解一堂課從內容到成交的完整脈絡。',
  '你會建立篩選課程、設計課程、經營信任的基本框架。',
]

const faqs = [
  {
    question: '這堂課是在教怎麼做線上課程嗎？',
    answer:
      '它不是只教操作工具，而是先帶你看懂線上課程產業的底層邏輯。懂了這些，你之後買課、學課、做課都會更有判斷力。',
  },
  {
    question: '我還沒有想做課，適合上嗎？',
    answer:
      '適合。這堂課也適合單純想把課買得更精準、學得更有效的人。你會知道自己到底在為什麼付費。',
  },
  {
    question: '課程會很商業、很難懂嗎？',
    answer:
      '不會。課程會用心態、行銷、經營、情感四個面向拆解，重點是讓你看懂，而不是堆很多專有名詞。',
  },
  {
    question: '付款後多久可以開始？',
    answer:
      '付款完成後會自動開通課程權限。之後可以從你的課程頁進入，依照自己的時間安排學習。',
  },
]

const instructorProof = [
  { value: '15 年', label: '網路行銷與線上課程經驗' },
  { value: '3,000+', label: '線上課程付費學員' },
  { value: '5.9 萬', label: 'YouTube 頻道訂閱' },
  { value: '1,000 萬+', label: '內容累積流量' },
]

const instructorImage = '/images/landing/online-courses-logic-fish.png'
const stageImage = '/images/landing/online-courses-logic-stage.png'
const instructorFullImage = '/images/landing/online-courses-logic-instructor.jpg'

const visualMaps = [
  {
    index: '01',
    title: '買課前先看懂自己',
    text: '先判斷你現在缺的是知識、方法、陪伴，還是行動環境。',
  },
  {
    index: '02',
    title: '拆開一頁銷售頁',
    text: '看見標題、見證、價格、限時優惠背後各自扮演的角色。',
  },
  {
    index: '03',
    title: '理解課程如何被經營',
    text: '把內容、信任、社群、續購放在同一條長期路徑裡看。',
  },
  {
    index: '04',
    title: '辨認情感如何成交',
    text: '知道你被什麼打動，也知道怎麼更清醒地做選擇。',
  },
]

const instructorMilestones = [
  '打造個人一人公司 10 年的經驗',
  '自學 AI 應用，打造 10 個不同的網站系統',
  'YouTube 頻道 5.9 萬人訂閱，累積超過 1,000 萬流量',
  '線上課程付費學員超過 3,000 位',
]

export default function OnlineCoursesLogicLanding({
  course,
  purchaseStatus,
  isLoggedIn,
  isFree,
  finalPrice,
  originalPrice,
  isOnSale,
  saleLabel,
  shouldAutoEnroll,
  inviteToken,
  reviewStats,
  reviews,
  reviewsHasMore,
  userReview,
  enableReviews,
  showReviews,
  currentUserId,
}: LandingPageProps) {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const checkoutHref = `/checkout?courseId=${course.id}${
    inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ''
  }`
  const accessLabel = describeAccessPolicy({
    accessType: course.accessType,
    accessDurationDays: course.accessDurationDays,
    accessExpiresAt: course.accessExpiresAt,
  })
  const ratingText =
    reviewStats.reviewCount > 0
      ? `${reviewStats.averageRating.toFixed(1)} 分 / ${reviewStats.reviewCount} 則評價`
      : '評價開放後顯示'
  const instructorName = course.instructorName || '課程講師'
  const instructorTitle = course.instructorTitle || '線上課程講師'
  const instructorDesc =
    course.instructorDesc ||
    '長期研究線上課程、內容經營與知識產品，擅長把複雜的市場邏輯拆成清楚可理解的判斷框架。'

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
              <h1 className="mt-5 text-3xl font-bold text-heading sm:text-5xl">
                {course.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-body sm:text-lg">
                {course.subtitle || course.description}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {purchaseStatus.firstLessonId && (
                  <Button
                    asChild
                    size="lg"
                    className="rounded-lg bg-cta px-6 text-base font-semibold text-white hover:bg-cta-hover"
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
                    className="rounded-lg border-divider px-6 text-base font-semibold"
                    onClick={() => setIsReviewModalOpen(true)}
                  >
                    {userReview ? (
                      <>
                        <Pencil className="mr-2 h-4 w-4" />
                        編輯評價
                      </>
                    ) : (
                      <>
                        <MessageSquarePlus className="mr-2 h-4 w-4" />
                        撰寫評價
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <CourseVisual course={course} />
          </div>
        </section>

        <PurchasedCurriculumList
          course={course}
          firstLessonId={purchaseStatus.firstLessonId}
        />

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

  return (
    <div className="flex flex-col bg-white">
      {shouldAutoEnroll && (
        <AutoEnrollHandler courseId={course.id} courseSlug={course.slug} />
      )}

      <section className="relative isolate overflow-hidden bg-[#020617] text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.82]"
          style={{ backgroundImage: `url(${stageImage})` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_74%_50%,rgba(2,6,23,0.04),rgba(2,6,23,0.44)_38%,rgba(2,6,23,0.92)_78%),linear-gradient(90deg,rgba(2,6,23,0.98)_0%,rgba(2,6,23,0.72)_42%,rgba(2,6,23,0.22)_74%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:80px_80px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(2,6,23,0.96))]" />
        <div className="relative mx-auto grid min-h-[calc(100svh-132px)] max-w-7xl gap-8 px-4 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-end lg:px-8">
          <div className="relative z-20 pb-8 lg:pb-20">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white/82 backdrop-blur"
            >
              <BookOpen className="h-4 w-4 text-[#7dd3fc]" />
              線上課程底層邏輯
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-6 max-w-[760px] text-[38px] font-black leading-[1.08] tracking-normal text-white sm:text-[52px] lg:text-[58px] xl:text-[62px]"
            >
              <span className="block sm:hidden">
                <span className="block">看懂線上課程，</span>
                <span className="block">不再一直買下</span>
                <span className="block">一堂課</span>
              </span>
              <span className="hidden sm:block">
                <span className="block">看懂線上課程，</span>
                <span className="block">不再一直買下一堂課</span>
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mt-6 max-w-2xl text-base leading-8 text-white/72 sm:text-xl"
            >
              {course.description ||
                '拆解線上課程產業，從心態、行銷、經營、情感四個面向看懂課程真正的價值。'}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              {isFree ? (
                <FreeCourseCTA
                  courseId={course.id}
                  courseSlug={course.slug}
                  isLoggedIn={isLoggedIn}
                />
              ) : (
                <Button
                  asChild
                  size="lg"
                  className="group rounded-full bg-[#4f8cff] py-3 pl-7 pr-3 text-base font-bold text-white shadow-[0_18px_50px_rgba(79,140,255,0.32)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#6aa2ff] active:scale-[0.98] sm:min-w-[272px]"
                >
                  <Link href={checkoutHref}>
                    立即加入，看懂課程邏輯
                    <span className="ml-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/16 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-0.5">
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </Link>
                </Button>
              )}
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/18 bg-white/8 px-7 py-6 text-base font-bold text-white transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/14 active:scale-[0.98] sm:min-w-[220px]"
              >
                <Link href="#pillars">
                  先看課程重點 <BookOpen className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>

            <div className="mt-8 flex flex-wrap gap-2">
              <HeroFact value="15 年實戰經驗" />
              <HeroFact value="3,000+ 付費學員" />
              <HeroFact value={ratingText} />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-white/68">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#7dd3fc]" />
                付款後自動開通
              </span>
              <span className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-[#7dd3fc]" />
                依照自己的時間觀看
              </span>
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#7dd3fc]" />
                {accessLabel}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-end gap-3">
              <span className="text-sm font-semibold text-white/48">課程價格</span>
              <span className="text-4xl font-black text-white">
                {isFree ? '免費' : formatPrice(finalPrice)}
              </span>
              {!isFree && isOnSale && (
                <>
                  <span className="pb-1 text-sm text-white/40 line-through">
                    {formatPrice(originalPrice)}
                  </span>
                  <span className="mb-1 rounded-full border border-[#7dd3fc]/30 bg-[#7dd3fc]/10 px-3 py-1 text-sm font-bold text-[#bae6fd]">
                    {saleLabel || '優惠中'}
                  </span>
                </>
              )}
            </div>

            <div className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 p-1.5 lg:hidden">
              <div className="relative h-[330px] overflow-hidden rounded-[calc(2rem-0.375rem)] bg-[#040b1d]">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-65"
                  style={{ backgroundImage: `url(${stageImage})` }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={instructorImage}
                  alt={`${instructorName} 課程講師`}
                  className="absolute bottom-0 right-[-18px] h-[320px] w-auto max-w-none object-contain"
                />
                <div className="absolute bottom-5 left-5 border-l border-[#7dd3fc]/70 pl-4 text-sm leading-6 text-white/78">
                  <span className="block font-bold text-white">{instructorName}</span>
                  <span>{instructorTitle}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 hidden min-h-[420px] lg:block lg:min-h-[680px]">
            <div className="absolute bottom-0 right-[-96px] h-[520px] w-[520px] rounded-full border border-white/8 lg:right-[-120px] lg:h-[760px] lg:w-[760px]" />
            <div className="absolute bottom-8 right-2 hidden w-[260px] border-t border-white/18 lg:block" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={instructorImage}
              alt={`${instructorName} 課程講師`}
              className="absolute bottom-0 right-[-42px] z-10 h-[500px] w-auto max-w-none object-contain drop-shadow-[0_32px_80px_rgba(0,0,0,0.55)] sm:right-0 sm:h-[560px] lg:right-[-40px] lg:h-[720px]"
            />
            <div className="absolute bottom-8 left-0 z-20 max-w-[240px] border-l border-[#7dd3fc]/70 pl-4 text-sm leading-6 text-white/70 lg:left-10">
              <span className="block font-bold text-white">{instructorName}</span>
              <span>{instructorTitle}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="pillars" className="bg-[#f5f7fb] py-16 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            label="Four Angles"
            title="四個面向，拆開線上課程的真正價值"
            text="這堂課不急著塞技巧，而是先讓你知道線上課程為什麼成立、怎麼被買、怎麼被經營，也怎麼影響學員。"
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {visualMaps.map((item) => (
              <VisualMapCard key={item.index} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <SectionHeader
              label="For You"
              title="這堂課適合誰"
              text="如果你一直在買課，但不知道哪些課值得投資，我將幫你建立分析思維。"
              align="left"
            />
            <div className="mt-6 grid gap-3">
              {audience.map((item) => (
                <InfoRow key={item} icon={<Users className="h-5 w-5" />} text={item} />
              ))}
            </div>
          </div>
          <div>
            <SectionHeader
              label="Outcome"
              title="學完你會帶走什麼"
              text="重點不是背答案，而是把課程、學習、成交、信任放回同一張地圖裡看。"
              align="left"
            />
            <div className="mt-6 grid gap-3">
              {outcomes.map((item) => (
                <InfoRow
                  key={item}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  text={item}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="curriculum"
        className="border-y border-divider bg-[#07111f] py-16 text-white sm:py-20 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-sm font-bold text-[#7dd3fc]">Course Map</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                把看不見的課程邏輯，變成四張地圖
              </h2>
              <p className="mt-5 text-base leading-8 text-white/64">
                你會從這四個問題開始，理解自己為什麼學、課程如何被看見、如何被經營，以及情感如何影響選擇。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visualMaps.map((item) => (
                <div
                  key={item.index}
                  className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5"
                >
                  <p className="text-xs font-bold text-[#7dd3fc]">{item.index}</p>
                  <h3 className="mt-3 text-lg font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/64">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 hidden gap-4 lg:grid lg:grid-cols-4">
            {pillars.map((pillar, index) => (
              <div
                key={pillar.title}
                className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
              >
                <p className="text-sm font-semibold text-[#7dd3fc]">
                  Part {index + 1}
                </p>
                <h3 className="mt-2 text-lg font-bold text-white">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  {pillar.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8">
          <div className="overflow-hidden rounded-[2rem] border border-black/8 bg-[#f4f6fa] p-1.5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2rem-0.375rem)] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={instructorFullImage}
                alt={`${instructorName} 課程講師`}
                className="h-full w-full object-cover object-[42%_30%]"
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-cta">Instructor</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-heading sm:text-5xl">
              由 {instructorName} 帶你拆解
            </h2>
            <p className="mt-5 text-base leading-8 text-body">
              {instructorDesc.split('\n')[0] || instructorDesc}
            </p>
            <div className="mt-7 grid gap-3">
              {instructorMilestones.map((item, index) => (
                <div
                  key={item}
                  className="flex gap-4 rounded-[1.25rem] border border-divider bg-surface p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-cta">
                    {index + 1}
                  </span>
                  <p className="min-w-0 text-sm leading-6 text-body sm:text-base">
                    {item}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {instructorProof.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.25rem] border border-divider bg-white p-4"
                >
                  <p className="text-2xl font-black text-heading">{item.value}</p>
                  <p className="mt-1 text-sm leading-6 text-body">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            label="FAQ"
            title="購買前常見問題"
            text="先把最容易猶豫的地方講清楚。"
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {faqs.map((faq) => (
              <FaqItem
                key={faq.question}
                question={faq.question}
                answer={faq.answer}
              />
            ))}
          </div>
        </div>
      </section>

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

      <section className="bg-heading py-14 text-white sm:py-16 lg:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-white/60">Start Learning</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            現在開始，看懂你正在投入的課程世界
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/70">
            用一堂課建立判斷框架。之後你買課、學課、做課，都會更清楚。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isFree ? (
              <FreeCourseCTA
                courseId={course.id}
                courseSlug={course.slug}
                isLoggedIn={isLoggedIn}
              />
            ) : (
              <Button
                asChild
                size="lg"
                className="rounded-lg bg-cta px-8 py-6 text-base font-semibold text-white hover:bg-cta-hover"
              >
                <Link href={checkoutHref}>
                  立即加入課程
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            <span className="text-sm text-white/60">
              {isFree ? '登入後即可加入' : '付款完成後自動開通'}
            </span>
          </div>
        </div>
      </section>

      <StickyCTA
        courseId={course.id}
        courseSlug={course.slug}
        finalPrice={finalPrice}
        originalPrice={originalPrice}
        isOnSale={isOnSale}
        isFree={isFree}
        isLoggedIn={isLoggedIn}
        inviteToken={inviteToken}
      />
    </div>
  )
}

function CourseVisual({ course }: { course: LandingPageProps['course'] }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-white">
      {course.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={course.coverImage}
          alt={course.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full grid-cols-2 border-b border-divider bg-white">
          {pillars.map((pillar) => {
            const Icon = pillar.icon
            return (
              <div
                key={pillar.title}
                className="flex min-h-0 flex-col justify-between border-r border-t border-divider p-4"
              >
                <Icon className="h-6 w-6 text-cta" />
                <div>
                  <p className="text-sm font-bold text-heading">
                    {pillar.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-caption">
                    線上課程判斷面向
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-heading backdrop-blur">
        {course.title}
      </div>
    </div>
  )
}

function VisualMapCard({
  item,
}: {
  item: (typeof visualMaps)[number]
}) {
  return (
    <div className="group overflow-hidden rounded-[2rem] border border-black/6 bg-white p-1.5">
      <div className="relative min-h-[260px] overflow-hidden rounded-[calc(2rem-0.375rem)] bg-[#07111f] p-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(125,211,252,0.28),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.12),transparent_44%)] opacity-80" />
        <div className="relative flex h-full min-h-[212px] flex-col justify-between">
          <p className="text-sm font-black text-[#7dd3fc]">{item.index}</p>
          <div>
            <h3 className="text-xl font-black leading-tight text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-white/68">{item.text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({
  label,
  title,
  text,
  align = 'center',
}: {
  label: string
  title: string
  text: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : ''}>
      <p className="text-sm font-bold text-cta">{label}</p>
      <h2 className="mt-3 text-2xl font-bold text-heading sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-body">{text}</p>
    </div>
  )
}

function HeroFact({ value }: { value: string }) {
  return (
    <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white/76">
      <span>{value}</span>
    </div>
  )
}

function InfoRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-divider bg-surface p-4">
      <span className="mt-0.5 shrink-0 text-cta">{icon}</span>
      <p className="min-w-0 text-sm leading-6 text-body sm:text-base">{text}</p>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border border-divider bg-white p-5">
      <h3 className="text-base font-bold text-heading">{question}</h3>
      <p className="mt-2 text-sm leading-6 text-body">{answer}</p>
    </div>
  )
}
