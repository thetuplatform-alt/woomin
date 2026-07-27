import { Prisma } from '@prisma/client'
import { onCoursePurchasedForAutomation } from '@/lib/newsletter/automation/enrollment-service'
import { processAutomationDeliveryById } from '@/lib/newsletter/automation/delivery-service'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    newsletterAutomation: {
      findFirst: jest.fn(),
    },
    newsletterAutomationEnrollment: {
      create: jest.fn(),
    },
    newsletterAutomationDelivery: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/newsletter/automation/delivery-service', () => ({
  processAutomationDeliveryById: jest.fn(),
}), { virtual: true })

const mockedPrisma = prisma as unknown as {
  newsletterAutomation: { findFirst: jest.Mock }
  newsletterAutomationEnrollment: { create: jest.Mock }
  newsletterAutomationDelivery: { createMany: jest.Mock; findMany: jest.Mock }
}

describe('newsletter automation enrollment-service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates one enrollment, schedules every enabled step, and sends zero-delay steps immediately', async () => {
    const paidAt = new Date('2026-08-01T10:00:00Z')
    mockedPrisma.newsletterAutomation.findFirst.mockResolvedValue({
      id: 'automation_1',
      courseId: 'course_abc',
      enabled: true,
      steps: [
        { id: 'step_1', delayDays: 0, delayHours: 0, enabled: true },
        { id: 'step_2', delayDays: 3, delayHours: 0, enabled: true },
        { id: 'step_3', delayDays: 7, delayHours: 0, enabled: true },
      ],
    })
    mockedPrisma.newsletterAutomationEnrollment.create.mockResolvedValue({
      id: 'enrollment_1',
      userId: 'user_1',
      automationId: 'automation_1',
      orderId: 'order_1',
      enrolledAt: paidAt,
    })
    mockedPrisma.newsletterAutomationDelivery.findMany.mockResolvedValue([
      { id: 'delivery_1', stepId: 'step_1', status: 'PENDING' },
    ])

    await onCoursePurchasedForAutomation({
      userId: 'user_1',
      courseId: 'course_abc',
      orderId: 'order_1',
      paidAt,
    })

    expect(mockedPrisma.newsletterAutomationEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'user_1',
          automationId: 'automation_1',
          orderId: 'order_1',
          enrolledAt: paidAt,
        },
      })
    )
    expect(mockedPrisma.newsletterAutomationDelivery.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          enrollmentId: 'enrollment_1',
          stepId: 'step_1',
          status: 'PENDING',
          scheduledAt: new Date('2026-08-01T10:00:00Z'),
        }),
        expect.objectContaining({
          enrollmentId: 'enrollment_1',
          stepId: 'step_2',
          status: 'PENDING',
          scheduledAt: new Date('2026-08-04T10:00:00Z'),
        }),
        expect.objectContaining({
          enrollmentId: 'enrollment_1',
          stepId: 'step_3',
          status: 'PENDING',
          scheduledAt: new Date('2026-08-08T10:00:00Z'),
        }),
      ],
      skipDuplicates: true,
    })
    expect(processAutomationDeliveryById).toHaveBeenCalledWith('delivery_1')
  })

  it('does not create duplicate enrollment or deliveries when the purchase webhook is retried', async () => {
    mockedPrisma.newsletterAutomation.findFirst.mockResolvedValue({
      id: 'automation_1',
      courseId: 'course_abc',
      enabled: true,
      steps: [{ id: 'step_1', delayDays: 0, delayHours: 0, enabled: true }],
    })
    mockedPrisma.newsletterAutomationEnrollment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`userId`,`automationId`)',
        {
          code: 'P2002',
          clientVersion: '7.2.0',
        }
      )
    )

    await expect(
      onCoursePurchasedForAutomation({
        userId: 'user_1',
        courseId: 'course_abc',
        orderId: 'order_retry',
        paidAt: new Date('2026-08-01T10:00:00Z'),
      })
    ).resolves.toBeUndefined()

    expect(mockedPrisma.newsletterAutomationEnrollment.create).toHaveBeenCalledTimes(1)
    expect(mockedPrisma.newsletterAutomationDelivery.createMany).not.toHaveBeenCalled()
    expect(processAutomationDeliveryById).not.toHaveBeenCalled()
  })

  it('does nothing when the purchased course has no enabled automation', async () => {
    mockedPrisma.newsletterAutomation.findFirst.mockResolvedValue(null)

    await onCoursePurchasedForAutomation({
      userId: 'user_1',
      courseId: 'course_without_automation',
      orderId: 'order_1',
      paidAt: new Date('2026-08-01T10:00:00Z'),
    })

    expect(mockedPrisma.newsletterAutomationEnrollment.create).not.toHaveBeenCalled()
    expect(mockedPrisma.newsletterAutomationDelivery.createMany).not.toHaveBeenCalled()
    expect(processAutomationDeliveryById).not.toHaveBeenCalled()
  })
})
