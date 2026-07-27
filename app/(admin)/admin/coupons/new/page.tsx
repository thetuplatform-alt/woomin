// app/(admin)/admin/coupons/new/page.tsx
// 新增優惠券頁面

import { getBundlesForCoupon, getCoursesForCoupon } from '@/lib/actions/coupons'
import { CouponForm } from '@/components/admin/coupons/coupon-form'
import { requireAdminAuth } from '@/lib/require-admin'

export const metadata = {
  title: '新增優惠券 | 後台管理',
}

interface NewCouponPageProps {
  searchParams: Promise<{
    courseId?: string
  }>
}

export default async function NewCouponPage({ searchParams }: NewCouponPageProps) {
  const { courseId } = await searchParams
  const user = await requireAdminAuth()
  const [courses, bundles] = await Promise.all([
    getCoursesForCoupon(),
    getBundlesForCoupon(),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">新增優惠券</h1>
      <CouponForm
        courses={courses}
        bundles={bundles}
        defaultCourseIds={courseId ? [courseId] : undefined}
        allowGlobalCoupons={user.role === 'ADMIN'}
      />
    </div>
  )
}
