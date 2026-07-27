// app/(admin)/admin/coupons/page.tsx
// 優惠券管理列表頁

import { getCoupons } from '@/lib/actions/coupons'
import { CouponList } from '@/components/admin/coupons/coupon-list'

export const metadata = {
  title: '優惠券管理 | 後台管理',
}

export default async function CouponsPage() {
  const coupons = await getCoupons()

  return (
    <div className="space-y-6 p-6">
      <CouponList coupons={coupons} />
    </div>
  )
}
