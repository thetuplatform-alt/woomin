// lib/payment/post-payment-actions.ts
// 付款成功後的共用授權與 side effects

import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPostHogClient, flushPostHogInBackground } from '@/lib/posthog-server'
import { sendMetaCAPIPurchaseEvent } from '@/lib/meta-capi'
import { sendAdminPurchaseNotification, sendPurchaseConfirmation } from '@/lib/email'
import { sendGuestActivationEmail } from '@/lib/guest-activation'
import { sendCourseWelcomeEmailForPaidOrder } from '@/lib/course-welcome-email-service'
import { onCoursePurchasedForAutomation } from '@/lib/newsletter/automation/enrollment-service'
import { upsertPaidPurchase } from '@/lib/purchase/upsert-paid-purchase'
import {
  getCourseInviteOrderMetadata,
  markCourseInviteOrderMetadataConsumed,
} from '@/lib/payment/course-invite-order-metadata'

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface PostPaymentOrder {
  id: string
  orderNo: string
  userId: string
  courseId?: string | null
  bundleId?: string | null
  amount: number
  clientIpAddress: string | null
  clientUserAgent: string | null
}

interface GrantPaidOrderAccessParams {
  tx: TxClient | Prisma.TransactionClient
  order: {
    id: string
    userId: string
    courseId: string | null
    bundleId: string | null
  }
  paidAt?: Date
}

export async function consumeInviteForPaidOrder(
  tx: TxClient | Prisma.TransactionClient,
  orderId: string,
  courseId: string
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { gatewayPaymentInstructions: true },
  })

  const metadata = getCourseInviteOrderMetadata(
    order?.gatewayPaymentInstructions
  )
  if (!metadata || metadata.consumedAt || metadata.courseId !== courseId) {
    return
  }

  const updated = await tx.courseInvite.updateMany({
    where: {
      id: metadata.inviteId,
      courseId,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(metadata.maxUses == null
        ? {}
        : { usedCount: { lt: metadata.maxUses } }),
    },
    data: {
      usedCount: { increment: 1 },
    },
  })

  if (updated.count === 0) {
    console.warn('[Course Invite] 付款成功但找不到邀請紀錄:', {
      orderId,
      courseId,
      inviteId: metadata.inviteId,
    })
    return
  }

  const consumedInstructions = markCourseInviteOrderMetadataConsumed(
    order?.gatewayPaymentInstructions,
    new Date()
  )

  if (consumedInstructions) {
    await tx.order.update({
      where: { id: orderId },
      data: { gatewayPaymentInstructions: consumedInstructions },
    })
  }
}

export async function grantPaidOrderAccess({
  tx,
  order,
  paidAt = new Date(),
}: GrantPaidOrderAccessParams): Promise<string[]> {
  if (order.courseId) {
    await upsertPaidPurchase({
      tx,
      userId: order.userId,
      courseId: order.courseId,
      orderId: order.id,
      paidAt,
      source: 'PAID',
      bundleId: null,
    })
    await consumeInviteForPaidOrder(tx, order.id, order.courseId)
    return [order.courseId]
  }

  if (!order.bundleId) {
    throw new Error('ORDER_MISSING_COURSE_OR_BUNDLE')
  }

  const bundle = await tx.bundle.findUnique({
    where: { id: order.bundleId },
    select: {
      courses: {
        orderBy: { order: 'asc' },
        select: { courseId: true },
      },
    },
  })

  if (!bundle || bundle.courses.length === 0) {
    throw new Error(`Bundle has no courses: ${order.bundleId}`)
  }

  const courseIds = bundle.courses.map((item) => item.courseId)
  for (const courseId of courseIds) {
    await upsertPaidPurchase({
      tx,
      userId: order.userId,
      courseId,
      orderId: order.id,
      paidAt,
      source: 'BUNDLE',
      bundleId: order.bundleId,
    })
  }

  return courseIds
}

/**
 * 付款成功後執行的所有 side effects（非阻塞）
 * - PostHog 追蹤
 * - Meta CAPI Purchase 事件
 * - 管理員購買通知 Email（依課程設定）
 * - Guest 啟用信
 * - 課程歡迎信
 */
export async function executePostPaymentActions(
  order: PostPaymentOrder
): Promise<void> {
  const [user, courseInfo, bundleInfo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: order.userId },
      select: { email: true, name: true, isGuest: true },
    }),
    order.courseId
      ? prisma.course.findUnique({
          where: { id: order.courseId },
          select: { title: true, slug: true, notifyAdminOnPurchase: true },
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
              select: {
                course: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    notifyAdminOnPurchase: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
  ])

  const contentTitle = courseInfo?.title || bundleInfo?.title
  const contentId = order.courseId || order.bundleId || undefined

  try {
    const posthog = await getPostHogClient()
    if (posthog) {
      posthog.capture({
        distinctId: order.userId,
        event: 'payment_succeeded',
        properties: {
          order_id: order.id,
          order_no: order.orderNo,
          item_type: order.bundleId ? 'bundle' : 'course',
          course_id: order.courseId ?? null,
          course_title: courseInfo?.title,
          bundle_id: order.bundleId ?? null,
          bundle_title: bundleInfo?.title,
          amount: order.amount,
          currency: 'TWD',
          is_guest: user?.isGuest ?? false,
          paid_at: new Date().toISOString(),
        },
      })
      flushPostHogInBackground(posthog)
    }
  } catch (err) {
    console.error('[PostHog] payment_succeeded 發送失敗:', err)
  }

  sendMetaCAPIPurchaseEvent({
    orderNo: order.orderNo,
    value: order.amount,
    contentName: contentTitle,
    contentId,
    userEmail: user?.email,
    clientIpAddress: order.clientIpAddress,
    clientUserAgent: order.clientUserAgent,
  }).catch((err) => console.error('[Meta CAPI] 背景發送失敗:', err))

  if (user?.email && contentTitle) {
    sendPurchaseConfirmation(user.email, {
      userName: user.name ?? '學員',
      courseName: bundleInfo ? `組合包：${contentTitle}` : contentTitle,
      orderNo: order.orderNo,
      amount: order.amount,
    }).catch((err) => console.error('[Purchase Confirmation] 背景發送失敗:', err))
  }

  if (courseInfo?.notifyAdminOnPurchase) {
    sendAdminPurchaseNotification({
      studentName: user?.name ?? '未提供',
      studentEmail: user?.email ?? '未提供',
      paidAt: new Date(),
      courseName: courseInfo.title,
      amount: order.amount,
      orderNo: order.orderNo,
    }).catch((err) => console.error('[Admin Email] 背景發送失敗:', err))
  }

  for (const item of bundleInfo?.courses ?? []) {
    if (!item.course.notifyAdminOnPurchase) continue
    sendAdminPurchaseNotification({
      studentName: user?.name ?? '未提供',
      studentEmail: user?.email ?? '未提供',
      paidAt: new Date(),
      courseName: `${item.course.title}（組合包：${bundleInfo?.title}）`,
      amount: order.amount,
      orderNo: order.orderNo,
    }).catch((err) => console.error('[Admin Email] 背景發送失敗:', err))
  }

  if (user?.isGuest) {
    sendGuestActivationEmail(order.userId).catch((err) =>
      console.error('[Guest Activation] 背景發送失敗:', err)
    )
  }

  if (user?.email && courseInfo?.title && courseInfo?.slug && order.courseId) {
    sendCourseWelcomeEmailForPaidOrder({
      orderId: order.id,
      userId: order.userId,
      courseId: order.courseId,
      toEmail: user.email,
      userName: user.name,
      courseTitle: courseInfo.title,
      courseSlug: courseInfo.slug,
      paidAt: new Date(),
    }).catch((err) =>
      console.error('[Course Welcome Email] 背景發送失敗:', err)
    )
  }

  if (order.courseId) {
    await onCoursePurchasedForAutomation({
      userId: order.userId,
      courseId: order.courseId,
      orderId: order.id,
      paidAt: new Date(),
    }).catch((err) =>
      console.error('[Newsletter Automation] 購買加入流程失敗:', err)
    )
  }

  if (user?.email && bundleInfo) {
    for (const item of bundleInfo.courses) {
      sendCourseWelcomeEmailForPaidOrder({
        orderId: order.id,
        userId: order.userId,
        courseId: item.course.id,
        toEmail: user.email,
        userName: user.name,
        courseTitle: item.course.title,
        courseSlug: item.course.slug,
        paidAt: new Date(),
      }).catch((err) =>
        console.error('[Course Welcome Email] 背景發送失敗:', err)
      )
    }
  }
}
