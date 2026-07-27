// lib/course-welcome-email-service.ts
// 課程購買後自動歡迎信寄送服務

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendCustomHtmlEmail } from '@/lib/email'
import { SETTING_KEYS } from '@/lib/validations/settings'
import {
  buildWelcomeEmailContext,
  getUnknownWelcomeEmailTokens,
  renderWelcomeEmailHtmlFromMarkdown,
  renderWelcomeEmailTemplate,
} from '@/lib/welcome-email'

interface SendCourseWelcomeEmailForPaidOrderParams {
  orderId: string
  userId: string
  courseId: string
  toEmail: string
  userName?: string | null
  courseTitle: string
  courseSlug: string
  paidAt?: Date
}

async function getSupportEmail(): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.CONTACT_EMAIL },
      select: { value: true },
    })

    if (setting?.value) {
      return setting.value
    }
  } catch (error) {
    console.error('[Course Welcome Email] 讀取客服信箱失敗:', error)
  }

  return process.env.EMAIL_FROM || 'noreply@fishot.com'
}

export async function sendCourseWelcomeEmailForPaidOrder(
  params: SendCourseWelcomeEmailForPaidOrderParams
): Promise<void> {
  if (!params.toEmail) {
    return
  }

  const welcomeEmail = await prisma.courseWelcomeEmail.findUnique({
    where: {
      courseId_planSlug: {
        courseId: params.courseId,
        planSlug: 'basic',
      },
    },
    select: {
      enabled: true,
      subjectTemplate: true,
      markdownTemplate: true,
    },
  })

  if (!welcomeEmail?.enabled) {
    return
  }

  let deliveryLogId: string

  try {
    const log = await prisma.emailDeliveryLog.create({
      data: {
        type: 'COURSE_WELCOME',
        status: 'PENDING',
        orderId: params.orderId,
        userId: params.userId,
        courseId: params.courseId,
        planSlug: 'basic',
        toEmail: params.toEmail,
        subject: welcomeEmail.subjectTemplate,
      },
      select: { id: true },
    })

    deliveryLogId = log.id
  } catch (error) {
    // 唯一鍵衝突代表該訂單已處理過歡迎信（避免 webhook 重送造成重複發信）
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      return
    }

    throw error
  }

  const supportEmail = await getSupportEmail()

  const context = await buildWelcomeEmailContext({
    userName: params.userName,
    courseTitle: params.courseTitle,
    courseSlug: params.courseSlug,
    supportEmail,
    purchaseDate: params.paidAt,
  })

  const unknownTokens = [
    ...getUnknownWelcomeEmailTokens(welcomeEmail.subjectTemplate),
    ...getUnknownWelcomeEmailTokens(welcomeEmail.markdownTemplate),
  ]

  if (unknownTokens.length > 0) {
    await prisma.emailDeliveryLog.update({
      where: { id: deliveryLogId },
      data: {
        status: 'SKIPPED',
        errorMessage: `模板包含未支援關鍵字: ${Array.from(new Set(unknownTokens)).join(', ')}`,
      },
    })
    return
  }

  const renderedSubject = renderWelcomeEmailTemplate(
    welcomeEmail.subjectTemplate,
    context
  )
  const renderedMarkdown = renderWelcomeEmailTemplate(
    welcomeEmail.markdownTemplate,
    context
  )
  const renderedHtml = renderWelcomeEmailHtmlFromMarkdown(renderedMarkdown)

  const sendResult = await sendCustomHtmlEmail({
    to: params.toEmail,
    subject: renderedSubject,
    html: renderedHtml,
  })

  if (sendResult.success) {
    await prisma.emailDeliveryLog.update({
      where: { id: deliveryLogId },
      data: {
        status: 'SENT',
        subject: renderedSubject,
        providerMessageId: sendResult.messageId || null,
        sentAt: new Date(),
      },
    })
    return
  }

  await prisma.emailDeliveryLog.update({
    where: { id: deliveryLogId },
    data: {
      status: 'FAILED',
      subject: renderedSubject,
      errorMessage: sendResult.error || '發送失敗',
    },
  })
}
