'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { normalizeNewsletterContent } from '@/lib/newsletter/render'
import type { NewsletterContent } from '@/lib/newsletter/types'

type Result<T = void> = { success: boolean; error?: string; data?: T }

type AutomationStepInput = {
  id?: string
  subjectTemplate: string
  delayDays: number
  delayHours: number
  enabled: boolean
  contentJson: NewsletterContent
}

type AutomationInput = {
  name: string
  courseId: string
  enabled: boolean
  steps: AutomationStepInput[]
}

function jsonInput<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

function normalizeStep(step: AutomationStepInput, index: number) {
  const subjectTemplate = step.subjectTemplate.trim()
  const delayDays = Math.max(0, Math.floor(Number(step.delayDays) || 0))
  const delayHours = Math.max(0, Math.floor(Number(step.delayHours) || 0))

  if (!subjectTemplate) {
    throw new Error(`第 ${index + 1} 封信請填寫主旨。`)
  }

  return {
    id: step.id,
    stepOrder: index + 1,
    subjectTemplate,
    delayDays,
    delayHours,
    enabled: step.enabled,
    contentJson: normalizeNewsletterContent(step.contentJson),
  }
}

function normalizeAutomationInput(data: AutomationInput) {
  const name = data.name.trim()
  const courseId = data.courseId.trim()
  const steps = data.steps.map(normalizeStep)

  if (!name) throw new Error('請填寫流程名稱。')
  if (!courseId) throw new Error('請選擇綁定課程。')
  if (steps.length === 0) throw new Error('至少需要一個信件步驟。')

  return {
    name,
    courseId,
    enabled: data.enabled,
    steps,
  }
}

function revalidateAutomationPaths(id?: string) {
  revalidatePath('/admin/newsletters')
  revalidatePath('/admin/newsletters/automations')
  if (id) revalidatePath(`/admin/newsletters/automations/${id}/edit`)
}

export async function listNewsletterAutomations() {
  await requireAdminAuth()

  const automations = await prisma.newsletterAutomation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      _count: {
        select: {
          steps: true,
          enrollments: true,
        },
      },
      steps: {
        orderBy: { stepOrder: 'asc' },
        select: {
          id: true,
          enabled: true,
          delayDays: true,
          delayHours: true,
        },
      },
    },
  })

  const deliveryCounts = await prisma.newsletterAutomationDelivery.groupBy({
    by: ['status'],
    _count: { _all: true },
  })

  return {
    automations,
    stats: {
      automations: automations.length,
      enabled: automations.filter((automation) => automation.enabled).length,
      enrollments: automations.reduce(
        (total, automation) => total + automation._count.enrollments,
        0
      ),
      sent: deliveryCounts
        .filter((item) => item.status === 'SENT')
        .reduce((total, item) => total + item._count._all, 0),
    },
  }
}

export async function getNewsletterAutomation(id: string) {
  await requireAdminAuth()

  const automation = await prisma.newsletterAutomation.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  })

  if (!automation) throw new Error('找不到自動化流程。')
  return automation
}

export async function getNewsletterAutomationEditorOptions() {
  await requireAdminAuth()

  const [courses, coupons] = await Promise.all([
    prisma.course.findMany({
      where: { status: { in: ['PUBLISHED', 'UNLISTED'] } },
      select: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        price: true,
        salePrice: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
    prisma.coupon.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  return { courses, coupons }
}

export async function createNewsletterAutomation(
  data: AutomationInput
): Promise<Result<{ id: string }>> {
  try {
    await requireAdminAuth()
    const input = normalizeAutomationInput(data)

    const automation = await prisma.newsletterAutomation.create({
      data: {
        name: input.name,
        courseId: input.courseId,
        enabled: input.enabled,
        steps: {
          create: input.steps.map((step) => ({
            stepOrder: step.stepOrder,
            delayDays: step.delayDays,
            delayHours: step.delayHours,
            subjectTemplate: step.subjectTemplate,
            enabled: step.enabled,
            contentJson: jsonInput(step.contentJson),
          })),
        },
      },
      select: { id: true },
    })

    revalidateAutomationPaths(automation.id)
    return { success: true, data: automation }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, error: '這門課已經有自動化流程。' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '建立自動化流程失敗。',
    }
  }
}

export async function updateNewsletterAutomation(
  id: string,
  data: AutomationInput
): Promise<Result<{ id: string }>> {
  try {
    await requireAdminAuth()
    const input = normalizeAutomationInput(data)
    const existingStepIds = input.steps
      .map((step) => step.id)
      .filter((stepId): stepId is string => !!stepId)

    await prisma.$transaction(async (tx) => {
      await tx.newsletterAutomation.update({
        where: { id },
        data: {
          name: input.name,
          courseId: input.courseId,
          enabled: input.enabled,
        },
      })

      for (let index = 0; index < existingStepIds.length; index += 1) {
        await tx.newsletterAutomationStep.updateMany({
          where: { id: existingStepIds[index], automationId: id },
          data: { stepOrder: -1000 - index },
        })
      }

      await tx.newsletterAutomationStep.deleteMany({
        where: {
          automationId: id,
          ...(existingStepIds.length ? { id: { notIn: existingStepIds } } : {}),
        },
      })

      for (const step of input.steps) {
        const dataForStep = {
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          subjectTemplate: step.subjectTemplate,
          enabled: step.enabled,
          contentJson: jsonInput(step.contentJson),
        }

        if (step.id) {
          await tx.newsletterAutomationStep.update({
            where: { id: step.id },
            data: dataForStep,
          })
        } else {
          await tx.newsletterAutomationStep.create({
            data: {
              automationId: id,
              ...dataForStep,
            },
          })
        }
      }
    })

    revalidateAutomationPaths(id)
    return { success: true, data: { id } }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, error: '這門課已經有自動化流程。' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '儲存自動化流程失敗。',
    }
  }
}
