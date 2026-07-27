// components/main/landing/pricing-section.tsx
// 價格區塊 — 吸收 Bonus 清單 + IAP 項目

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Shield,
  RefreshCw,
  ArrowRight,
  Loader2,
  Gift,
  AlertTriangle,
} from 'lucide-react'
import type { CourseDetail, PlanOption } from '@/lib/actions/public-courses'
import { formatPrice, calculatePrice } from '@/lib/utils/price'
import { enrollFreeCourse } from '@/lib/actions/free-course'
import { SubscriptionPlans } from '@/components/main/landing/subscription-plans'
import posthog from 'posthog-js'
import { toast } from 'sonner'

interface PricingSectionProps {
  course: CourseDetail
  /** 訂閱方案（AC-18：optional，有方案時於買斷卡下方渲染訂閱區；未傳不渲染） */
  plans?: PlanOption[]
}

// 價值堆疊清單
const valueStack = [
  { name: '完整核心實戰課程', value: 'NT$ 3,000' },
  { name: '所有 Prompt 提示詞包', value: 'NT$ 1,500' },
  { name: '金流變現實戰課程', value: 'NT$ 2,000' },
  { name: '未來永久課程更新', value: '∞' },
]

export function PricingSection({ course, plans }: PricingSectionProps) {
  const [isEnrolling, setIsEnrolling] = useState(false)
  const router = useRouter()

  const priceResult = calculatePrice({
    originalPrice: course.price,
    salePrice: course.salePrice,
    saleEndAt: course.saleEndAt,
    saleLabel: course.saleLabel,
    saleCycleEnabled: course.saleCycleEnabled,
    saleCycleDays: course.saleCycleDays,
  })

  // 設定一個錨定總價值（可依需求微調）
  const totalValue = 8000
  const originalPrice = course.price
  const finalPrice = priceResult.finalPrice
  const savings = originalPrice - finalPrice
  const isFree = finalPrice === 0

  const handleEnrollFree = async () => {
    setIsEnrolling(true)
    try {
      const result = await enrollFreeCourse(course.id)
      if (result.success) {
        toast.success('成功加入課程！')
        if (result.firstLessonId && result.courseSlug) {
          router.push(`/courses/${result.courseSlug}/lessons/${result.firstLessonId}`)
        } else {
          router.push('/my-courses')
        }
      } else {
        toast.error(result.error || '加入課程失敗')
      }
    } catch {
      toast.error('加入課程時發生錯誤')
    } finally {
      setIsEnrolling(false)
    }
  }

  return (
    <>
    <section className="bg-surface py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* 標題區 */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            Join the Revolution
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-black tracking-tight text-heading sm:text-4xl lg:text-5xl"
          >
            別讓你的好點子
            <span className="lg:inline hidden">
              ，
            </span>
            <span className="lg:hidden inline">
              <br />
            </span>
            只停留在「我想過」
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-4 max-w-2xl text-base text-body sm:text-lg"
          >
            技術門檻已經消失，現在是你將影響力裝進別人手機裡的最好時機。
          </motion.p>
        </div>

        {/* 底部對比區 (外包 vs 自學) */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-center"
        >
          <p className="text-sm font-bold text-caption mb-4">傳統開發方式的殘酷現實</p>
          <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-16">
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-caption uppercase tracking-widest">外包行情</span>
              <span className="mt-1 text-2xl font-black text-heading line-through decoration-cta decoration-2">NT$ 200,000+</span>
            </div>
            <div className="hidden h-10 w-px bg-divider sm:block" />
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-caption uppercase tracking-widest">自學 Swift</span>
              <span className="mt-1 text-2xl font-black text-heading line-through decoration-cta decoration-2">6 個月以上</span>
            </div>
            <div className="hidden h-10 w-px bg-divider sm:block" />
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-caption uppercase tracking-widest">自學 AI</span>
              <span className="mt-1 text-2xl font-black text-heading line-through decoration-cta decoration-2">無限撞牆</span>
            </div>
          </div>
        </motion.div>

        {/* 定價主卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-[2rem] border-4 border-heading bg-white shadow-2xl"
        >
          <div className="grid lg:grid-cols-5">
            {/* 左側：價值堆疊區 (佔 3/5) */}
            <div className="p-8 sm:p-10 lg:col-span-3 lg:p-12">
              <h3 className="text-2xl font-bold text-heading">這堂課你將獲得：</h3>

              <ul className="mt-8 space-y-5">
                {valueStack.map((item, index) => (
                  <li key={index} className="flex items-start justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cta" />
                      <span className="text-base font-medium text-[#262626]">{item.name}</span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-caption">{item.value}</span>
                  </li>
                ))}
              </ul>

              {/* 限量 1 on 1 Bonus 區塊 */}
              <div className="mt-8 rounded-2xl border-2 border-dashed border-cta bg-amber-50/50 p-5">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-cta" />
                  <span className="text-sm font-bold text-cta uppercase tracking-wider">限時加贈 Bonus</span>
                </div>
                <h4 className="mt-2 text-lg font-bold text-heading">15 分鐘 1 對 1 專屬技術急診</h4>
                <p className="mt-2 text-sm text-body leading-relaxed">
                  不怕 AI 報錯你看不懂。購課後 30 天內，實作若遇卡關，提供完整截圖即可預約講師親自線上健檢，確保 App 順利跑起來。
                </p>
              </div>
            </div>

            {/* 右側：結帳與 CTA (佔 2/5) */}
            <div className="flex flex-col bg-heading p-8 sm:p-10 lg:col-span-2 lg:p-12">
              <div className="mt-auto mb-auto flex flex-col items-center justify-center text-center">
                <div className="flex flex-col items-center space-y-1">
                  {priceResult.isOnSale && (
                    <span className="text-lg font-bold text-caption line-through">
                      原價 NT$ {originalPrice.toLocaleString()}
                    </span>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white sm:text-6xl tracking-tight">
                      {isFree ? '免費' : formatPrice(finalPrice)}
                    </span>
                  </div>
                </div>

                {priceResult.isOnSale && savings > 0 && (
                  <div className="mt-4 inline-flex items-center rounded-full bg-cta/20 px-4 py-1.5 text-sm font-bold text-cta">
                    {isFree ? '限時免費體驗' : `${priceResult.saleLabel} · 現省 NT$ ${savings.toLocaleString()}`}
                  </div>
                )}

                {priceResult.isOnSale && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-cta" />
                    <span className="text-sm font-medium text-white/80">
                      將於第七章節上線後正式漲價
                    </span>
                  </div>
                )}

                {isFree ? (
                  <Button
                    onClick={handleEnrollFree}
                    disabled={isEnrolling}
                    className="group mt-8 h-14 w-full rounded-xl bg-cta text-lg font-bold text-white transition-all hover:bg-cta-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isEnrolling ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        加入中...
                      </>
                    ) : (
                      <>
                        立即免費加入
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="group mt-8 h-14 w-full rounded-xl bg-cta text-lg font-bold text-white transition-all hover:bg-cta-hover hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Link
                      href={`/checkout?courseId=${course.id}`}
                      onClick={() => {
                        posthog.capture("cta_clicked", {
                          cta_location: "pricing",
                          cta_text: "立即加入課程，解鎖所有 Bonus",
                          course_id: course.id,
                          course_slug: course.slug,
                          final_price: finalPrice,
                          original_price: originalPrice,
                          is_on_sale: priceResult.isOnSale,
                        });
                      }}
                    >
                      立即加入課程
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                )}

                {!isFree && (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <p className="text-xs font-semibold text-caption uppercase tracking-widest">
                      Secure Payment via Stripe
                    </p>
                    <div className="flex gap-4 flex-col">
                      <div className="flex items-center gap-1.5 text-xs text-caption">
                        <Shield className="h-3.5 w-3.5" />
                        7 日內未觀看 100% 退費保證
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-caption">
                        <RefreshCw className="h-3.5 w-3.5" />
                        內容永久更新
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>

    {/* 訂閱方案（AC-18：有方案時渲染於買斷卡下方；空/未傳自動不顯示） */}
    {plans && plans.length > 0 && (
      <SubscriptionPlans
        courseId={course.id}
        courseSlug={course.slug}
        plans={plans}
        isOnSale={priceResult.isOnSale}
        variant="light"
      />
    )}
    </>
  )
}