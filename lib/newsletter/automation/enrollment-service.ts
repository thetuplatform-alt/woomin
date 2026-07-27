import { NewsletterAutomationDeliveryStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { processAutomationDeliveryById } from '@/lib/newsletter/automation/delivery-service'
import type { CoursePurchasedForAutomationInput } from '@/lib/newsletter/automation/types'

export function calculateAutomationScheduledAt(
  enrolledAt: Date,
  delayDays: number,
  delayHours: number
): Date {
  return new Date(
    enrolledAt.getTime() +
      delayDays * 24 * 60 * 60 * 1000 +
      delayHours * 60 * 60 * 1000
  )
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

export async function onCoursePurchasedForAutomation(
  input: CoursePurchasedForAutomationInput
): Promise<void> {
  const automation = await prisma.newsletterAutomation.findFirst({
    where: {
      courseId: input.courseId,
      enabled: true,
    },
    include: {
      steps: {
        where: { enabled: true },
        orderBy: { stepOrder: 'asc' },
      },
    },
  })

  if (!automation || automation.steps.length === 0) return

  let enrollment: { id: string }
  try {
    enrollment = await prisma.newsletterAutomationEnrollment.create({
      data: {
        userId: input.userId,
        automationId: automation.id,
        orderId: input.orderId,
        enrolledAt: input.paidAt,
      },
      select: { id: true },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) return
    throw error
  }

  await prisma.newsletterAutomationDelivery.createMany({
    data: automation.steps.map((step) => ({
      enrollmentId: enrollment.id,
      stepId: step.id,
      status: NewsletterAutomationDeliveryStatus.PENDING,
      scheduledAt: calculateAutomationScheduledAt(
        input.paidAt,
        step.delayDays,
        step.delayHours
      ),
    })),
    skipDuplicates: true,
  })

  const zeroDelayStepIds = automation.steps
    .filter((step) => step.delayDays === 0 && step.delayHours === 0)
    .map((step) => step.id)

  if (zeroDelayStepIds.length === 0) return

  const zeroDelayDeliveries = await prisma.newsletterAutomationDelivery.findMany({
    where: {
      enrollmentId: enrollment.id,
      stepId: { in: zeroDelayStepIds },
      status: NewsletterAutomationDeliveryStatus.PENDING,
    },
    select: { id: true },
  })

  for (const delivery of zeroDelayDeliveries) {
    await processAutomationDeliveryById(delivery.id)
  }
}
