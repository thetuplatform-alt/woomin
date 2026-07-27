// components/main/landing/sticky-cta.tsx
// 手機端底部固定 CTA 按鈕
// 觸發閾值降低至 400px，更早捕獲用戶

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils/price'
import { enrollFreeCourse } from '@/lib/actions/free-course'
import { lowestPlanPrice } from '@/components/main/landing/subscription-plans'
import type { PlanOption } from '@/lib/actions/public-courses'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface StickyCTAProps {
  courseId: string
  courseSlug: string
  finalPrice: number
  originalPrice?: number
  isOnSale?: boolean
  isFree?: boolean
  isLoggedIn?: boolean
  inviteToken?: string | null
  /** 訂閱方案（AC-19：optional，有方案時顯示訂閱入口次行連結；未傳不渲染） */
  subscriptionPlans?: PlanOption[]
}

export function StickyCTA({
  courseId,
  courseSlug,
  finalPrice,
  originalPrice,
  isOnSale = false,
  isFree = false,
  isLoggedIn = false,
  inviteToken,
  subscriptionPlans,
}: StickyCTAProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const router = useRouter()
  const checkoutHref = `/checkout?courseId=${courseId}${
    inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ''
  }`

  // 訂閱入口（AC-19）：付費課且有方案時，取最低每期價顯示「或 NT$X/月起」
  const lowestPlan = !isFree ? lowestPlanPrice(subscriptionPlans) : null
  const lowestPlanUnit = lowestPlan?.interval === 'YEAR' ? '年' : '月'
  const planCheckoutHref = lowestPlan
    ? `/checkout?courseId=${courseId}&plan=${encodeURIComponent(lowestPlan.id)}`
    : null

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleEnrollFree = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/courses/${courseSlug}?enroll=true`)
      return
    }

    setIsEnrolling(true)
    try {
      const result = await enrollFreeCourse(courseId)
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
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-divider bg-white/95 backdrop-blur-md px-4 py-3 transition-transform duration-300 lg:hidden ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-1.5">
        <div className="flex items-center gap-3">
          {/* 價格資訊 */}
          <div className="flex flex-col">
            {isOnSale && originalPrice !== undefined && (
              <span className="text-xs text-caption line-through">
                NT$ {originalPrice.toLocaleString()}
              </span>
            )}
            <span className="text-lg font-black text-heading">
              {isFree ? '免費' : formatPrice(finalPrice)}
            </span>
          </div>

          {/* CTA 按鈕 */}
          {isFree ? (
            <Button
              onClick={handleEnrollFree}
              disabled={isEnrolling}
              className="flex-1 rounded-full bg-cta py-6 text-sm font-bold text-white hover:bg-cta-hover"
            >
              {isEnrolling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  免費加入
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              asChild
              className="flex-1 rounded-full bg-cta py-6 text-sm font-bold text-white hover:bg-cta-hover"
            >
              <Link href={checkoutHref}>
                立即加入
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        {/* 訂閱入口次行（AC-19）：有方案時顯示「或 NT$X/月起」 */}
        {lowestPlan && planCheckoutHref && (
          <Link
            href={planCheckoutHref}
            className="text-center text-xs font-medium text-cta underline decoration-cta/40 underline-offset-2 hover:decoration-cta"
          >
            或 {formatPrice(lowestPlan.price)}/{lowestPlanUnit}起 訂閱
          </Link>
        )}
      </div>
    </div>
  )
}
