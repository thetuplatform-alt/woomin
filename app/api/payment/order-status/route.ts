// app/api/payment/order-status/route.ts
// 查詢訂單付款狀態（供成功頁輪詢使用）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { coercePendingPaymentInstructions } from '@/lib/payment/payment-instructions'
import {
  checkRateLimit,
  getIdentifier,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit'

/**
 * GET /api/payment/order-status?orderNo=xxx
 *
 * 回傳訂單目前的付款狀態，供成功頁 polling 使用。
 * 不需要登入（只回傳最小必要資訊，不暴露敏感資料）。
 */
export async function GET(request: NextRequest) {
  // L39：此端點不需登入（供成功頁輪詢），加上速率限制避免以 orderNo 枚舉訂單狀態。
  const rateLimitResult = checkRateLimit(
    `order-status:${getIdentifier(request)}`,
    RATE_LIMIT_CONFIGS.api
  )
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    )
  }

  const { searchParams } = new URL(request.url)
  const orderNo = searchParams.get('orderNo')

  if (!orderNo) {
    return NextResponse.json({ error: 'Missing orderNo' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNo },
    select: {
      status: true,
      amount: true,
      courseId: true,
      bundleId: true,
      userId: true,
      paidAt: true,
      subscriptionId: true,
      gatewayPaymentInstructions: true,
      gatewayPaymentExpiresAt: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // 訂閱訂單：附上訂閱狀態摘要供成功頁顯示（AC-28）
  // 首期 checkout.session.completed 即把 Order 轉 PAID + 訂閱轉 ACTIVE，
  // 故 30 秒輪詢內可讀到 status=ACTIVE 與下次扣款日。
  let subscription:
    | { status: string; nextBillingAt: string | null; planLabel: string | null }
    | null = null
  if (order.subscriptionId) {
    const sub = await prisma.courseSubscription.findUnique({
      where: { id: order.subscriptionId },
      select: {
        status: true,
        currentPeriodEnd: true,
        plan: { select: { label: true } },
      },
    })
    if (sub) {
      subscription = {
        status: sub.status,
        // 訂閱下次扣款日 = 本期週期末（未含寬限，用於「下次扣款日」顯示）
        nextBillingAt: sub.currentPeriodEnd?.toISOString() ?? null,
        planLabel: sub.plan?.label ?? null,
      }
    }
  }

  // 分別查詢 user 和 course（Order 沒有直接的 relation field）
  const [orderUser, course, bundle] = await Promise.all([
    prisma.user.findUnique({
      where: { id: order.userId },
      select: { isGuest: true, email: true },
    }),
    order.courseId
      ? prisma.course.findUnique({
          where: { id: order.courseId },
          select: {
            title: true,
            slug: true,
            chapters: {
              orderBy: { order: 'asc' },
              take: 1,
              select: {
                lessons: {
                  orderBy: { order: 'asc' },
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
    order.bundleId
      ? prisma.bundle.findUnique({
          where: { id: order.bundleId },
          select: {
            title: true,
            slug: true,
            courses: {
              orderBy: { order: 'asc' },
              take: 1,
              select: {
                course: {
                  select: {
                    slug: true,
                    chapters: {
                      orderBy: { order: 'asc' },
                      take: 1,
                      select: {
                        lessons: {
                          orderBy: { order: 'asc' },
                          take: 1,
                          select: { id: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
  ])

  const firstBundleCourse = bundle?.courses[0]?.course ?? null
  const firstLessonId =
    course?.chapters[0]?.lessons[0]?.id ??
    firstBundleCourse?.chapters[0]?.lessons[0]?.id ??
    null
  const paymentInstructions = coercePendingPaymentInstructions(
    order.gatewayPaymentInstructions
  )
  const instructionExpiresAt =
    paymentInstructions?.expiresAt ||
    order.gatewayPaymentExpiresAt?.toISOString() ||
    null

  return NextResponse.json({
    status: order.status,
    amount: order.amount,
    courseId: order.courseId,
    bundleId: order.bundleId,
    paidAt: order.paidAt,
    isGuest: orderUser?.isGuest ?? false,
    // 訂閱訂單摘要（買斷訂單為 null）
    subscription,
    // 不回傳 guestEmail，避免透過訂單編號洩漏用戶 email
    paymentInstructions: paymentInstructions
      ? {
          ...paymentInstructions,
          expiresAt: instructionExpiresAt,
        }
      : null,
    course: course
      ? {
          title: course.title,
          slug: course.slug,
          firstLessonId,
        }
      : null,
    bundle: bundle
      ? {
          title: bundle.title,
          slug: bundle.slug,
          firstCourseSlug: firstBundleCourse?.slug ?? null,
          firstLessonId,
        }
      : null,
  })
}
