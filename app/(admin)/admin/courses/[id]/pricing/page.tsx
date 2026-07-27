// app/(admin)/admin/courses/[id]/pricing/page.tsx
// 定價與促銷頁面

import { notFound } from 'next/navigation'
import { getCourseById } from '@/lib/actions/courses'
import { getCouponsByCourseId } from '@/lib/actions/coupons'
import { getSubscriptionPlansByCourseId } from '@/lib/actions/subscription-plans'
import { isSubscriptionSupported } from '@/lib/payment/subscription-support'
import { CoursePricingForm } from '@/components/admin/courses/course-pricing-form'

export const metadata = {
  title: '定價與促銷',
}

interface PricingPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { id } = await params

  const [course, coupons, subscriptionPlans, subscriptionSupported] =
    await Promise.all([
      getCourseById(id),
      getCouponsByCourseId(id),
      getSubscriptionPlansByCourseId(id),
      isSubscriptionSupported(),
    ])

  if (!course) {
    notFound()
  }

  // 判定課程是否使用「客製銷售頁」（AC-14）：
  // - HTML 模式：直接視為客製
  // - React 模式且指定了 slug（對應 registry 中的專屬元件）：客製
  // default.tsx 會自動組裝訂閱方案，客製頁則需前端手動更新才會顯示訂閱選項。
  const usesCustomLandingPage =
    course.landingPageMode === 'html' ||
    (course.landingPageMode !== 'html' &&
      !!course.landingPageSlug &&
      course.landingPageSlug.length > 0)

  return (
    <CoursePricingForm
      course={course}
      coupons={coupons}
      subscriptionPlans={subscriptionPlans}
      subscriptionSupported={subscriptionSupported}
      usesCustomLandingPage={usesCustomLandingPage}
    />
  )
}
