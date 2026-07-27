// lib/actions/course-welcome-email.ts
// 課程歡迎信後台管理 Server Actions

'use server'

import { revalidatePath } from 'next/cache'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import { prisma } from '@/lib/prisma'
import { sendCustomHtmlEmail } from '@/lib/email'
import {
  courseWelcomeEmailSchema,
  courseWelcomeEmailTestSchema,
  type CourseWelcomeEmailFormData,
} from '@/lib/validations/course-welcome-email'
import {
  DEFAULT_WELCOME_EMAIL_MARKDOWN,
  DEFAULT_WELCOME_EMAIL_SUBJECT,
  WELCOME_EMAIL_VARIABLES,
  buildWelcomeEmailContext,
  getUnknownWelcomeEmailTokens,
  renderWelcomeEmailHtmlFromMarkdown,
  renderWelcomeEmailTemplate,
} from '@/lib/welcome-email'

export interface CourseWelcomeEmailSettings {
  enabled: boolean
  subjectTemplate: string
  markdownTemplate: string
  availableVariables: typeof WELCOME_EMAIL_VARIABLES
}

export async function getCourseWelcomeEmailSettings(
  courseId: string
): Promise<CourseWelcomeEmailSettings> {
  await requireCourseManageAccess(courseId)

  const settings = await prisma.courseWelcomeEmail.findUnique({
    where: { courseId_planSlug: { courseId, planSlug: 'basic' } },
    select: {
      enabled: true,
      subjectTemplate: true,
      markdownTemplate: true,
    },
  })

  return {
    enabled: settings?.enabled ?? false,
    subjectTemplate: settings?.subjectTemplate ?? DEFAULT_WELCOME_EMAIL_SUBJECT,
    markdownTemplate: settings?.markdownTemplate ?? DEFAULT_WELCOME_EMAIL_MARKDOWN,
    availableVariables: WELCOME_EMAIL_VARIABLES,
  }
}

export async function updateCourseWelcomeEmailSettings(
  courseId: string,
  data: CourseWelcomeEmailFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireCourseManageAccess(courseId)
    const validated = courseWelcomeEmailSchema.parse(data)

    const unknownTokens = [
      ...getUnknownWelcomeEmailTokens(validated.subjectTemplate),
      ...getUnknownWelcomeEmailTokens(validated.markdownTemplate),
    ]

    if (unknownTokens.length > 0) {
      return {
        success: false,
        error: `包含未支援關鍵字: ${Array.from(new Set(unknownTokens)).join(', ')}`,
      }
    }

    await prisma.courseWelcomeEmail.upsert({
      where: { courseId_planSlug: { courseId, planSlug: 'basic' } },
      create: {
        courseId,
        planSlug: 'basic',
        enabled: validated.enabled,
        subjectTemplate: validated.subjectTemplate,
        markdownTemplate: validated.markdownTemplate,
        updatedBy: currentUser.id as string,
      },
      update: {
        enabled: validated.enabled,
        subjectTemplate: validated.subjectTemplate,
        markdownTemplate: validated.markdownTemplate,
        updatedBy: currentUser.id as string,
      },
    })

    revalidatePath(`/admin/courses/${courseId}/welcome-email`)

    return { success: true }
  } catch (error) {
    console.error('更新課程歡迎信設定失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新設定時發生錯誤' }
  }
}

export async function sendCourseWelcomeEmailTest(
  courseId: string,
  input: {
    toEmail: string
    subjectTemplate: string
    markdownTemplate: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireCourseManageAccess(courseId)

    const validated = courseWelcomeEmailTestSchema.parse(input)

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true, slug: true },
    })

    if (!course) {
      return { success: false, error: '課程不存在' }
    }

    const unknownTokens = [
      ...getUnknownWelcomeEmailTokens(validated.subjectTemplate),
      ...getUnknownWelcomeEmailTokens(validated.markdownTemplate),
    ]

    if (unknownTokens.length > 0) {
      return {
        success: false,
        error: `包含未支援關鍵字: ${Array.from(new Set(unknownTokens)).join(', ')}`,
      }
    }

    const context = await buildWelcomeEmailContext({
      userName: '測試學員',
      courseTitle: course.title,
      courseSlug: course.slug,
      purchaseDate: new Date(),
    })

    const renderedSubject = renderWelcomeEmailTemplate(validated.subjectTemplate, context)
    const renderedMarkdown = renderWelcomeEmailTemplate(validated.markdownTemplate, context)
    const renderedHtml = renderWelcomeEmailHtmlFromMarkdown(renderedMarkdown)

    const sendResult = await sendCustomHtmlEmail({
      to: validated.toEmail,
      subject: renderedSubject,
      html: renderedHtml,
    })

    if (!sendResult.success) {
      return { success: false, error: sendResult.error || '發送失敗' }
    }

    return { success: true }
  } catch (error) {
    console.error('發送課程歡迎信測試失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '發送測試信時發生錯誤' }
  }
}
