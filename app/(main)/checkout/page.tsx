// app/(main)/checkout/page.tsx
// 結帳頁面
// 顯示訂單確認資訊並處理付款流程

import { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePrice } from '@/lib/utils/price'
import { describeAccessPolicy } from '@/lib/purchase/compute-expires-at'
import { isPurchaseActive } from '@/lib/purchase/is-active'
import { resolveCourseInviteToken } from '@/lib/actions/course-invites'
import { CheckoutClient } from './checkout-client'
import { getPublicSiteSettings } from '@/lib/site-settings-public'
import { getEInvoiceConfig } from '@/lib/invoice/config'
import { isSubscriptionSupported } from '@/lib/payment/subscription-support'
import { getActiveGatewayType } from '@/lib/payment/gateway-factory'
import { MetaPixelAddToCart, MetaPixelInitiateCheckout } from '@/components/common/meta-pixel-events'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '結帳 | 課程平台',
  description: '完成您的課程購買',
}

interface CheckoutPageProps {
  searchParams: Promise<{
    courseId?: string
    bundleId?: string
    invite?: string
    coupon?: string
    plan?: string
  }>
}

/** 日期格式化（可觀看至日期顯示用） */
function formatAccessDate(date: Date | null): string | null {
  if (!date) return null
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  // 1. 取得登入狀態（不再強制登入）
  const session = await auth()

  // 2. 取得商品 ID
  const { courseId, bundleId, invite, coupon, plan: planId } = await searchParams

  if ((!courseId && !bundleId) || (courseId && bundleId)) {
    redirect('/')
  }

  // 3. 查詢商品資訊
  const course = courseId
    ? await prisma.course.findFirst({
        where: {
          id: courseId,
          status: {
            in: ['PUBLISHED', 'UNLISTED'],
          },
        },
        select: {
          id: true,
          title: true,
          subtitle: true,
          slug: true,
          salesVisibility: true,
          coverImage: true,
          price: true,
          salePrice: true,
          saleEndAt: true,
          saleCycleEnabled: true,
          saleCycleDays: true,
          accessType: true,
          accessDurationDays: true,
          accessExpiresAt: true,
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
        include: {
          courses: {
            orderBy: { order: 'asc' },
            select: {
              courseId: true,
              course: { select: { title: true } },
            },
          },
        },
      })
    : null

  if (courseId && !course) {
    notFound()
  }

  if (bundleId && (!bundle || bundle.courses.length === 0)) {
    notFound()
  }

  if (course?.salesVisibility === 'INVITE_ONLY') {
    const inviteResolution = await resolveCourseInviteToken({
      token: invite,
      courseId: course.id,
      userEmail: session?.user?.email ?? null,
    })

    const allowsGuestEmailVerification =
      !session?.user?.email &&
      !inviteResolution.valid &&
      inviteResolution.reason === 'EMAIL_REQUIRED'

    if (!inviteResolution.valid && !allowsGuestEmailVerification) {
      return (
        <div className="min-h-screen bg-white py-12 sm:py-16 lg:py-24">
          <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
            <div className="rounded-2xl border border-divider bg-surface p-8">
              <p className="text-sm font-semibold text-cta">私密邀請課程</p>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-heading">
                這門課需要有效邀請連結
              </h1>
              <p className="mt-3 text-sm leading-6 text-body">
                目前的邀請連結無效、已過期，或不符合此帳號使用條件。請回到課程頁重新開啟有效邀請連結。
              </p>
              <Button asChild className="mt-6 rounded-xl bg-cta px-6 text-white hover:bg-cta-hover">
                <Link href={`/courses/${course.slug}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`}>
                  回到課程頁
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )
    }
  }

  const productType = bundle ? 'bundle' : 'course'
  const productCourseIds = bundle
    ? bundle.courses.map((item) => item.courseId)
    : [course!.id]

  // 3.5 訂閱模式解析（AC-28）：帶 ?plan= 且方案有效、gateway 支援時進入訂閱結帳。
  // plan 一旦出現在 URL 就必須 fail-closed；不可靜默退回買斷，避免使用者付錯商品。
  let subscriptionPlan: {
    id: string
    label: string
    type: 'UNLIMITED' | 'FIXED_TERM'
    interval: 'MONTH' | 'YEAR'
    price: number
    totalPeriods: number | null
    termEndBehavior: 'GRANT_LIFETIME' | 'END_ACCESS'
  } | null = null

  if (course && planId) {
    const plan = await prisma.courseSubscriptionPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        courseId: true,
        label: true,
        type: true,
        interval: true,
        price: true,
        totalPeriods: true,
        termEndBehavior: true,
        enabled: true,
      },
    })
    const gatewaySupportsSub = await isSubscriptionSupported()
    if (!plan || !plan.enabled || plan.courseId !== course.id || !gatewaySupportsSub) {
      notFound()
    }
    subscriptionPlan = {
      id: plan.id,
      label: plan.label,
      type: plan.type,
      interval: plan.interval,
      price: plan.price,
      totalPeriods: plan.totalPeriods,
      termEndBehavior: plan.termEndBehavior,
    }
  } else if (planId) {
    notFound()
  }

  const isSubscriptionMode = subscriptionPlan !== null

  // 4. 檢查是否已購買（改用 isPurchaseActive：過期者放行回購，PRD §9）
  // 訂閱模式：不 redirect，改顯示阻擋訊息（含可觀看至日期，AC-25）
  if (session?.user?.id) {
    const purchaseRecords = await prisma.purchase.findMany({
      where: {
        userId: session.user.id,
        courseId: { in: productCourseIds },
        revokedAt: null,
      },
      select: { courseId: true, revokedAt: true, expiresAt: true },
    })
    const activePurchases = purchaseRecords.filter((p) => isPurchaseActive(p))

    if (isSubscriptionMode && course) {
      // 訂閱模式的阻擋：任何有效 Purchase 或進行中訂閱都擋（與 service 阻擋規則一致）
      const activeCoursePurchase = activePurchases.find(
        (p) => p.courseId === course.id
      )
      const activeSub = await prisma.courseSubscription.findFirst({
        where: {
          userId: session.user.id,
          courseId: course.id,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        select: { id: true, currentPeriodEnd: true },
      })

      if (activeCoursePurchase || activeSub) {
        const accessEndsAt =
          activeCoursePurchase?.expiresAt ?? activeSub?.currentPeriodEnd ?? null
        const accessDateText = formatAccessDate(accessEndsAt)
        return (
          <div className="min-h-screen bg-white py-12 sm:py-16 lg:py-24">
            <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
              <div className="rounded-2xl border border-divider bg-surface p-8">
                <p className="text-sm font-semibold text-cta">已擁有此課程</p>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-heading">
                  你目前仍可觀看此課程
                </h1>
                <p className="mt-3 text-sm leading-6 text-body">
                  {accessDateText
                    ? `你目前的觀看權限持續至 ${accessDateText}，屆時可重新訂閱。`
                    : '你已擁有此課程的觀看權限，無需重複訂閱。'}
                </p>
                <Button
                  asChild
                  className="mt-6 rounded-xl bg-cta px-6 text-white hover:bg-cta-hover"
                >
                  <Link href={`/courses/${course.slug}`}>前往課程</Link>
                </Button>
              </div>
            </div>
          </div>
        )
      }
    } else {
      // 買斷模式：維持原本 redirect 行為
      if (course && activePurchases.length > 0) {
        redirect(`/courses/${course.slug}`)
      }

      if (bundle && activePurchases.length === productCourseIds.length) {
        redirect('/my-courses')
      }
    }
  }

  // 5. 取得公開設定（含登入方式開關）
  const siteSettings = await getPublicSiteSettings()

  // 5b. 電子發票是否啟用（決定結帳頁是否顯示發票資訊區塊）
  const einvoiceConfig = await getEInvoiceConfig()

  // 5c. 訂閱模式需要 gateway 類型以決定下次扣款日文案（PAYUNi 月底規則）
  const subscriptionGateway = isSubscriptionMode
    ? await getActiveGatewayType()
    : null

  // 6. 計算價格（使用統一的價格計算邏輯）
  const coursePrice = course
    ? calculatePrice({
        originalPrice: course.price,
        salePrice: course.salePrice,
        saleEndAt: course.saleEndAt,
        saleCycleEnabled: course.saleCycleEnabled,
        saleCycleDays: course.saleCycleDays,
      })
    : null
  const finalPrice = bundle ? bundle.salePrice ?? bundle.price : coursePrice!.finalPrice
  const isOnSale = bundle ? bundle.salePrice != null : coursePrice!.isOnSale
  const productTitle = bundle?.title ?? course!.title
  const productId = bundle?.id ?? course!.id

  return (
    <div className="min-h-screen bg-white py-12 sm:py-16 lg:py-24">
      {/* Meta Pixel 漏斗事件 */}
      <MetaPixelAddToCart
        contentName={productTitle}
        contentId={productId}
        value={finalPrice}
      />
      <MetaPixelInitiateCheckout
        contentName={productTitle}
        contentId={productId}
        value={finalPrice}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-heading text-center mb-12 sm:text-4xl">
          確認訂單
        </h1>

        <CheckoutClient
          productType={productType}
          inviteToken={course?.salesVisibility === 'INVITE_ONLY' ? invite : undefined}
          course={{
            id: productId,
            title: productTitle,
            subtitle: bundle
              ? `組合包｜${bundle.courses.length} 門課程`
              : course!.subtitle,
            slug: bundle?.slug ?? course!.slug,
            coverImage: bundle ? bundle.coverImage : course!.coverImage,
            originalPrice: bundle?.price ?? course!.price,
            finalPrice,
            isOnSale,
            saleEndAt: course?.saleEndAt?.toISOString() ?? null,
            accessPolicy: bundle
              ? '購買後開通組合包內所有課程'
              : describeAccessPolicy({
                  accessType: course!.accessType,
                  accessDurationDays: course!.accessDurationDays,
                  accessExpiresAt: course!.accessExpiresAt,
                }),
          }}
          user={{
            name: session?.user?.name || '',
            email: session?.user?.email || '',
            isLoggedIn: !!session?.user?.id,
          }}
          googleLoginEnabled={siteSettings.googleLoginEnabled}
          appleLoginEnabled={siteSettings.appleLoginEnabled}
          einvoiceEnabled={
            einvoiceConfig.enabled &&
            (isSubscriptionMode ? true : finalPrice > 0)
          }
          initialCouponCode={coupon || ''}
          subscriptionPlan={subscriptionPlan ?? undefined}
          subscriptionGateway={subscriptionGateway ?? undefined}
        />
      </div>
    </div>
  )
}
