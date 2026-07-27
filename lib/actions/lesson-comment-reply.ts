// lib/actions/lesson-comment-reply.ts
// 留言回覆 Server Action：可發送留言回覆、寄送 Email 給留言者

'use server'

import { prisma } from '@/lib/prisma'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import { sendCustomHtmlEmail } from '@/lib/email'
import {
  renderWelcomeEmailHtmlFromMarkdown,
} from '@/lib/welcome-email'
import { renderReplyTemplate } from '@/lib/comment-reply'

export async function replyToLessonComment(input: {
  commentId: string
  markdownContent: string
  subject: string
  sendAsComment: boolean
  sendAsEmail: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!input.sendAsComment && !input.sendAsEmail) {
      return { success: false, error: '請至少選擇一種發送方式' }
    }

    if (!input.markdownContent.trim()) {
      return { success: false, error: '回覆內容不能為空' }
    }

    // 取得原始留言及相關資訊
    const comment = await prisma.lessonComment.findUnique({
      where: { id: input.commentId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        lesson: {
          select: {
            id: true,
            title: true,
            chapter: {
              select: {
                title: true,
                course: { select: { id: true, title: true, slug: true } },
              },
            },
          },
        },
      },
    })

    if (!comment) {
      return { success: false, error: '留言不存在' }
    }
    const admin = await requireCourseManageAccess(comment.lesson.chapter.course.id)

    const context = {
      userName: comment.user.name || '學員',
      courseTitle: comment.lesson.chapter.course.title,
      lessonTitle: comment.lesson.title,
      originalComment: comment.content,
    }

    const renderedMarkdown = renderReplyTemplate(input.markdownContent, context)
    const renderedSubject = renderReplyTemplate(input.subject, context)

    // 發送留言回覆（建立新留言）
    if (input.sendAsComment) {
      await prisma.lessonComment.create({
        data: {
          lessonId: comment.lessonId,
          userId: admin.id as string,
          content: renderedMarkdown,
          isAnonymous: false,
        },
      })
    }

    // 寄送 Email
    if (input.sendAsEmail) {
      const html = renderWelcomeEmailHtmlFromMarkdown(renderedMarkdown)

      const result = await sendCustomHtmlEmail({
        to: comment.user.email,
        subject: renderedSubject,
        html,
      })

      if (!result.success) {
        return {
          success: false,
          error: `留言${input.sendAsComment ? '已發送' : ''}，但 Email 發送失敗：${result.error}`,
        }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('回覆留言失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '回覆留言失敗',
    }
  }
}
