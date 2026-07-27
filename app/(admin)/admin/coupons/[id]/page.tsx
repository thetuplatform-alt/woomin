// app/(admin)/admin/coupons/[id]/page.tsx
// 編輯優惠券頁面

import { notFound } from 'next/navigation'
import { getBundlesForCoupon, getCouponById, getCoursesForCoupon } from '@/lib/actions/coupons'
import { CouponForm } from '@/components/admin/coupons/coupon-form'
import { requireAdminAuth } from '@/lib/require-admin'

export const metadata = {
  title: '編輯優惠券 | 後台管理',
}

interface EditCouponPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCouponPage({ params }: EditCouponPageProps) {
  const { id } = await params
  const user = await requireAdminAuth()
  const [coupon, courses, bundles] = await Promise.all([
    getCouponById(id),
    getCoursesForCoupon(),
    getBundlesForCoupon(),
  ])

  if (!coupon) {
    notFound()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-foreground">編輯優惠券</h1>
      <CouponForm
        coupon={coupon}
        courses={courses}
        bundles={bundles}
        allowGlobalCoupons={user.role === 'ADMIN'}
      />
    </div>
  )
}
