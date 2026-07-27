// app/api/coupon/validate/route.ts
// 優惠碼驗證 API
// 前台結帳頁用戶輸入優惠碼時呼叫

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateCouponSchema } from '@/lib/validations/coupon'
import { validateCoupon } from '@/lib/actions/coupons'
import { calculatePrice } from '@/lib/utils/price'
import {
  checkRateLimit,
  getIdentifier,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // M27：對外公開端點加上速率限制，避免暴力枚舉優惠碼
    const rateLimitResult = checkRateLimit(
      `coupon-validate:${getIdentifier(request)}`,
      RATE_LIMIT_CONFIGS.api
    )
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: '請求過於頻繁，請稍後再試' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const body = await request.json()
    const validationResult = validateCouponSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '請求資料格式錯誤', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { code, courseId, bundleId } = validationResult.data

    // 查詢商品和價格
    const course = courseId
      ? await prisma.course.findFirst({
          where: {
            id: courseId,
            status: { in: ['PUBLISHED', 'UNLISTED'] },
          },
        })
      : null

    const bundle = bundleId
      ? await prisma.bundle.findFirst({
          where: {
            id: bundleId,
            status: 'PUBLISHED',
            visibility: { in: ['PUBLIC', 'UNLISTED'] },
          },
        })
      : null

    if (courseId && !course) {
      return NextResponse.json(
        { error: '課程不存在或尚未發佈' },
        { status: 404 }
      )
    }

    if (bundleId && !bundle) {
      return NextResponse.json(
        { error: '組合包不存在或尚未發佈' },
        { status: 404 }
      )
    }

    // 計算促銷後價格
    const { finalPrice } = course
      ? calculatePrice({
          originalPrice: course.price,
          salePrice: course.salePrice,
          saleEndAt: course.saleEndAt,
          saleCycleEnabled: course.saleCycleEnabled,
          saleCycleDays: course.saleCycleDays,
        })
      : { finalPrice: bundle!.salePrice ?? bundle!.price }

    // 取得用戶 ID（訪客為 null）
    const session = await auth()
    const userId = session?.user?.id || null

    // 驗證優惠券
    const result = await validateCoupon(
      code,
      course ? { courseId: course.id } : { bundleId: bundle!.id },
      finalPrice,
      userId
    )

    if (!result.valid) {
      // M27：對外回傳模糊訊息，避免依細分原因枚舉「優惠碼是否存在 / 狀態」；
      // 具體原因僅記錄於伺服器日誌供除錯。
      console.log('[Coupon Validate] 驗證未通過:', result.error)
      return NextResponse.json(
        { error: '優惠碼無效、已失效或不適用於此訂單' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      couponId: result.couponId,
      code: result.code,
      name: result.name,
      discountType: result.discountType,
      discountAmount: result.discountAmount,
      finalPrice: result.finalPrice,
    })
  } catch (error) {
    console.error('[Coupon Validate] 錯誤:', error)
    return NextResponse.json(
      { error: '驗證優惠碼失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
