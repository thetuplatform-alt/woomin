import {
  executePostPaymentActions,
  grantPaidOrderAccess,
} from '@/lib/payment/post-payment-actions'
import { onCoursePurchasedForAutomation } from '@/lib/newsletter/automation/enrollment-service'
import { upsertPaidPurchase } from '@/lib/purchase/upsert-paid-purchase'
import { prisma } from '@/lib/prisma'
import {
  sendAdminPurchaseNotification,
  sendPurchaseConfirmation,
} from '@/lib/email'
import { sendGuestActivationEmail } from '@/lib/guest-activation'
import { sendCourseWelcomeEmailForPaidOrder } from '@/lib/course-welcome-email-service'
import { maybeAutoIssueForOrder } from '@/lib/invoice/service'
import { getPostHogClient } from '@/lib/posthog-server'
import { sendMetaCAPIPurchaseEvent } from '@/lib/meta-capi'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    course: { findUnique: jest.fn() },
    bundle: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/posthog-server', () => ({
  getPostHogClient: jest.fn(),
  flushPostHogInBackground: jest.fn(),
}))
jest.mock('@/lib/meta-capi', () => ({
  sendMetaCAPIPurchaseEvent: jest.fn(),
}))
jest.mock('@/lib/email', () => ({
  sendAdminPurchaseNotification: jest.fn(),
  sendPurchaseConfirmation: jest.fn(),
}))
jest.mock('@/lib/guest-activation', () => ({
  sendGuestActivationEmail: jest.fn(),
}))
jest.mock('@/lib/course-welcome-email-service', () => ({
  sendCourseWelcomeEmailForPaidOrder: jest.fn(),
}))
jest.mock('@/lib/purchase/upsert-paid-purchase', () => ({
  upsertPaidPurchase: jest.fn(),
}))
jest.mock('@/lib/invoice/service', () => ({
  maybeAutoIssueForOrder: jest.fn(),
}))
jest.mock('@/lib/payment/course-invite-order-metadata', () => ({
  getCourseInviteOrderMetadata: jest.fn(() => null),
  markCourseInviteOrderMetadataConsumed: jest.fn(),
}))
jest.mock('@/lib/newsletter/automation/enrollment-service', () => ({
  onCoursePurchasedForAutomation: jest.fn(),
}))

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock }
  course: { findUnique: jest.Mock }
  bundle: { findUnique: jest.Mock }
}

describe('newsletter automation payment integration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockedPrisma.user.findUnique.mockResolvedValue({
      email: 'student@example.com',
      name: '學員',
      isGuest: false,
    })
    mockedPrisma.course.findUnique.mockResolvedValue({
      title: '課程',
      slug: 'course-1',
      notifyAdminOnPurchase: false,
    })
    mockedPrisma.bundle.findUnique.mockResolvedValue(null)
    ;(getPostHogClient as jest.Mock).mockResolvedValue(null)
    ;(sendMetaCAPIPurchaseEvent as jest.Mock).mockResolvedValue(undefined)
    ;(maybeAutoIssueForOrder as jest.Mock).mockResolvedValue(undefined)
    ;(sendPurchaseConfirmation as jest.Mock).mockResolvedValue(undefined)
    ;(sendAdminPurchaseNotification as jest.Mock).mockResolvedValue(undefined)
    ;(sendGuestActivationEmail as jest.Mock).mockResolvedValue(undefined)
    ;(sendCourseWelcomeEmailForPaidOrder as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not run newsletter automation enrollment inside grantPaidOrderAccess', async () => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ gatewayPaymentInstructions: null }),
        update: jest.fn(),
      },
      courseInvite: {
        updateMany: jest.fn(),
      },
    }
    ;(upsertPaidPurchase as jest.Mock).mockResolvedValue(undefined)

    await expect(
      grantPaidOrderAccess({
        tx: tx as never,
        order: {
          id: 'order_1',
          userId: 'user_1',
          courseId: 'course_1',
          bundleId: null,
        },
        paidAt: new Date('2026-07-01T10:00:00Z'),
      })
    ).resolves.toEqual(['course_1'])

    expect(onCoursePurchasedForAutomation).not.toHaveBeenCalled()
  })

  it('runs newsletter automation enrollment after payment commit and does not throw when automation enrollment fails', async () => {
    ;(onCoursePurchasedForAutomation as jest.Mock).mockRejectedValue(
      new Error('AUTOMATION_UNAVAILABLE')
    )

    await expect(
      executePostPaymentActions({
        id: 'order_123',
        orderNo: 'R202607010001',
        userId: 'user_123',
        courseId: 'course_1',
        bundleId: null,
        amount: 1200,
        clientIpAddress: '127.0.0.1',
        clientUserAgent: 'jest',
      })
    ).resolves.toBeUndefined()

    expect(onCoursePurchasedForAutomation).toHaveBeenCalledWith({
      userId: 'user_123',
      courseId: 'course_1',
      orderId: 'order_123',
      paidAt: expect.any(Date),
    })
  })
})
