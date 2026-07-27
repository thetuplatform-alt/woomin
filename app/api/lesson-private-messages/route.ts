import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { sendPrivateMessageReplyEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { canManageCourse } from '@/lib/course-permissions'

const listPrivateMessagesSchema = z.object({
  lessonId: z.string().min(1),
  userId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
})

const createPrivateMessageSchema = z.object({
  lessonId: z.string().min(1),
  userId: z.string().optional(),
  content: z.string().trim().max(2000).default(''),
  attachmentMediaId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.content && !data.attachmentMediaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['content'],
      message: '請輸入內容或選擇附件',
    })
  }
})

async function getCurrentUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, image: true },
  })
}

function isTeacherRole(role: string | null | undefined) {
  return role === 'ADMIN' || role === 'INSTRUCTOR' || role === 'EDITOR'
}

/**
 * 老師（講師）操作他人私訊串前，必須確認自己有此單元所屬課程的管理權限。
 * 防止講師讀寫不屬於自己課程的私訊（跨課程 IDOR）。
 */
async function requireTeacherCourseAccess(
  currentUser: { id: string; role: string | null },
  lessonId: string
) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { chapter: { select: { courseId: true } } },
  })

  if (!lesson) {
    return { ok: false as const, status: 404, error: '單元不存在' }
  }

  const allowed = await canManageCourse(
    { id: currentUser.id, role: currentUser.role ?? '' },
    lesson.chapter.courseId
  )

  if (!allowed) {
    return { ok: false as const, status: 403, error: '沒有此課程的管理權限' }
  }

  return { ok: true as const }
}

async function requireLessonAccess(params: {
  lessonId: string
  userId: string
}) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      chapter: {
        include: {
          course: { select: { id: true, status: true } },
        },
      },
    },
  })

  if (!lesson || lesson.chapter.course.status === 'DRAFT') {
    return { ok: false as const, status: 404, error: '單元不存在' }
  }

  if (lesson.isFree) {
    return { ok: true as const, lesson }
  }

  const purchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId: params.userId,
        courseId: lesson.chapter.course.id,
      },
    },
  })

  if (
    purchase &&
    !purchase.revokedAt &&
    (!purchase.expiresAt || purchase.expiresAt > new Date())
  ) {
    return { ok: true as const, lesson }
  }

  return { ok: false as const, status: 403, error: '您尚未購買此課程' }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const parsed = listPrivateMessagesSchema.safeParse({
      lessonId: url.searchParams.get('lessonId') ?? '',
      userId: url.searchParams.get('userId') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || '輸入資料格式錯誤' },
        { status: 400 }
      )
    }

    const { lessonId, userId, cursor, limit } = parsed.data
    const currentUser = await getCurrentUser(session.user.id)
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '用戶不存在' },
        { status: 401 }
      )
    }

    const isTeacher = isTeacherRole(currentUser.role)
    const isTeacherThread = isTeacher && Boolean(userId)
    const threadUserId = isTeacherThread ? userId : session.user.id

    if (!threadUserId) {
      return NextResponse.json(
        { success: false, error: '缺少私訊對象' },
        { status: 400 }
      )
    }

    if (isTeacherThread) {
      // 講師只能讀取自己可管理課程的私訊串
      const access = await requireTeacherCourseAccess(currentUser, lessonId)
      if (!access.ok) {
        return NextResponse.json(
          { success: false, error: access.error },
          { status: access.status }
        )
      }

      const messages = await prisma.lessonPrivateMessage.findMany({
        where: { lessonId, userId: threadUserId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: { user: { select: { id: true, name: true, image: true } } },
      })

      return NextResponse.json({
        success: true,
        messages: messages.map((message) => ({
          id: message.id,
          lessonId: message.lessonId,
          content: message.content,
          attachmentMediaId: message.attachmentMediaId,
          attachmentUrl: message.attachmentUrl,
          attachmentName: message.attachmentName,
          attachmentMimeType: message.attachmentMimeType,
          attachmentSize: message.attachmentSize,
          isFromTeacher: message.isFromTeacher,
          createdAt: message.createdAt.toISOString(),
          user: {
            id: message.user.id,
            name: message.isFromTeacher ? '老師' : message.user.name,
            image: message.isFromTeacher ? null : message.user.image,
          },
        })),
        nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
      })
    }

    if (!isTeacher) {
      const access = await requireLessonAccess({ lessonId, userId: session.user.id })
      if (!access.ok) {
        return NextResponse.json(
          { success: false, error: access.error },
          { status: access.status }
        )
      }
    }

    const messages = await prisma.lessonPrivateMessage.findMany({
      where: { lessonId, userId: threadUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { user: { select: { id: true, name: true, image: true } } },
    })

    const nextCursor =
      messages.length === limit ? messages[messages.length - 1].id : null

    return NextResponse.json({
      success: true,
      messages: messages.map((message) => ({
        id: message.id,
        lessonId: message.lessonId,
        content: message.content,
        attachmentMediaId: message.attachmentMediaId,
        attachmentUrl: message.attachmentUrl,
        attachmentName: message.attachmentName,
        attachmentMimeType: message.attachmentMimeType,
        attachmentSize: message.attachmentSize,
        isFromTeacher: message.isFromTeacher,
        createdAt: message.createdAt.toISOString(),
        user: {
          id: message.user.id,
          name: message.isFromTeacher ? '老師' : message.user.name,
          image: message.isFromTeacher ? null : message.user.image,
        },
      })),
      nextCursor,
    })
  } catch (error) {
    console.error('取得私訊失敗:', error)
    return NextResponse.json(
      { success: false, error: '取得私訊失敗' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const parsed = createPrivateMessageSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || '輸入資料格式錯誤' },
        { status: 400 }
      )
    }

    const { lessonId, userId, content, attachmentMediaId } = parsed.data
    const currentUser = await getCurrentUser(session.user.id)
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '用戶不存在' },
        { status: 401 }
      )
    }

    const isTeacher = isTeacherRole(currentUser.role)
    const isTeacherReply = isTeacher && Boolean(userId)
    const threadUserId = isTeacherReply ? userId : session.user.id
    if (!threadUserId) {
      return NextResponse.json(
        { success: false, error: '缺少私訊對象' },
        { status: 400 }
      )
    }

    if (!isTeacher) {
      const access = await requireLessonAccess({ lessonId, userId: session.user.id })
      if (!access.ok) {
        return NextResponse.json(
          { success: false, error: access.error },
          { status: access.status }
        )
      }
    } else if (isTeacherReply) {
      // 講師回覆他人私訊串前，必須確認有此課程的管理權限
      const access = await requireTeacherCourseAccess(currentUser, lessonId)
      if (!access.ok) {
        return NextResponse.json(
          { success: false, error: access.error },
          { status: access.status }
        )
      }

      // L21：講師只能「回覆既有私訊串」，不能對任意 userId 主動發訊（避免對非本課程學員發訊 / 寄信）
      const existingThread = await prisma.lessonPrivateMessage.findFirst({
        where: { lessonId, userId: threadUserId },
        select: { id: true },
      })
      if (!existingThread) {
        return NextResponse.json(
          { success: false, error: '找不到對應的私訊串，無法回覆' },
          { status: 404 }
        )
      }
    }

    const attachment = attachmentMediaId
      ? await prisma.media.findUnique({ where: { id: attachmentMediaId } })
      : null

    if (attachmentMediaId && !attachment) {
      return NextResponse.json(
        { success: false, error: '附件不存在' },
        { status: 404 }
      )
    }

    if (attachment && attachment.sourceType !== 'PRIVATE_MESSAGE') {
      return NextResponse.json(
        { success: false, error: '附件來源不正確' },
        { status: 400 }
      )
    }

    // M20：附件歸屬檢查對「所有人」一致（含講師回覆）——不再因 isTeacherReply 而豁免，
    // 避免講師把某學員上傳的附件轉貼到對另一學員的對話中造成跨使用者檔案外洩。
    if (attachment && attachment.uploadedBy && attachment.uploadedBy !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '不能使用其他人的附件' },
        { status: 403 }
      )
    }

    // M20：附件若已綁定到其他訊息（sourceId 已設定），不可重複使用
    if (attachment && attachment.sourceId) {
      return NextResponse.json(
        { success: false, error: '此附件已被使用，請重新上傳' },
        { status: 400 }
      )
    }

    const last = await prisma.lessonPrivateMessage.findFirst({
      where: { userId: threadUserId, isFromTeacher: isTeacherReply },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    if (last) {
      const elapsedMs = Date.now() - last.createdAt.getTime()
      if (elapsedMs < 15_000) {
        return NextResponse.json(
          {
            success: false,
            error: '每 15 秒只能發送一次私訊',
            retryAfterSec: Math.ceil((15_000 - elapsedMs) / 1000),
          },
          { status: 429 }
        )
      }
    }

    const created = await prisma.lessonPrivateMessage.create({
      data: {
        lessonId,
        userId: threadUserId,
        content,
        attachmentMediaId: attachment?.id ?? null,
        attachmentUrl: attachment?.url ?? null,
        attachmentName: attachment?.originalName ?? null,
        attachmentMimeType: attachment?.mimeType ?? null,
        attachmentSize: attachment?.size ?? null,
        isFromTeacher: isTeacherReply,
        ...(isTeacherReply ? { readByTeacher: true } : {}),
      },
      include: { user: { select: { id: true, name: true, image: true } } },
    })

    if (attachment) {
      await prisma.media.update({
        where: { id: attachment.id },
        data: {
          sourceId: created.id,
          sourceLabel: `私訊附件: ${attachment.originalName}`,
          sourceUrl: '/admin/messages',
        },
      })
    }

    if (isTeacherReply) {
      const notificationContext = await prisma.lessonPrivateMessage.findUnique({
        where: { id: created.id },
        select: {
          content: true,
          user: { select: { email: true, name: true } },
          lesson: {
            select: {
              id: true,
              title: true,
              chapter: {
                select: {
                  course: { select: { title: true, slug: true } },
                },
              },
            },
          },
        },
      })

      if (notificationContext?.user.email) {
        const result = await sendPrivateMessageReplyEmail({
          toEmail: notificationContext.user.email,
          userName: notificationContext.user.name || '學員',
          courseName: notificationContext.lesson.chapter.course.title,
          lessonTitle: notificationContext.lesson.title,
          replyContent: notificationContext.content,
          courseSlug: notificationContext.lesson.chapter.course.slug,
          lessonId: notificationContext.lesson.id,
        })

        if (!result.success) {
          console.warn('私訊回覆通知 Email 發送失敗:', result.error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        id: created.id,
        lessonId: created.lessonId,
        content: created.content,
        attachmentMediaId: created.attachmentMediaId,
        attachmentUrl: created.attachmentUrl,
        attachmentName: created.attachmentName,
        attachmentMimeType: created.attachmentMimeType,
        attachmentSize: created.attachmentSize,
        isFromTeacher: created.isFromTeacher,
        createdAt: created.createdAt.toISOString(),
        user: {
          id: created.user.id,
          name: created.isFromTeacher ? '老師' : created.user.name,
          image: created.isFromTeacher ? null : created.user.image,
        },
      },
    })
  } catch (error) {
    console.error('建立私訊失敗:', error)
    return NextResponse.json(
      { success: false, error: '建立私訊失敗' },
      { status: 500 }
    )
  }
}
