// lib/actions/private-messages-admin.ts
// 老師私訊（一對一）- 後台管理 Server Actions
// 以「學員 × 單元」為單位聚合成對話串，供 Messenger 式收件匣使用。
// 與「課程留言」(lesson-comments-admin.ts) 完全獨立。

'use server'

import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import {
  manageableCourseWhereForUser,
  requireCourseManageAccess,
} from '@/lib/course-permissions'

// 聚合對話時掃描的最近訊息上限（涵蓋實務規模；超出者以最新活動為主）
const CONVERSATION_SCAN_LIMIT = 5000

export type PrivateMessageConversation = {
  /** 對話唯一鍵：lessonId::userId */
  key: string
  lessonId: string
  userId: string
  student: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  course: { id: string; title: string; slug: string }
  lesson: { id: string; title: string; chapterTitle: string }
  lastMessage: {
    content: string
    createdAt: string
    isFromTeacher: boolean
    hasAttachment: boolean
  }
  lastActivityAt: string
  totalCount: number
  unreadCount: number
}

export type PrivateMessageThreadItem = {
  id: string
  content: string
  attachmentUrl: string | null
  attachmentName: string | null
  attachmentMimeType: string | null
  attachmentSize: number | null
  isFromTeacher: boolean
  readByTeacher: boolean
  createdAt: string
  user: { id: string; name: string | null; image: string | null }
}

/**
 * 取得老師可管理範圍內的私訊對話清單（依學員×單元聚合）。
 * @param courseId 指定課程時只回傳該課程的對話；未指定時回傳所有可管理課程。
 */
export async function getPrivateMessageConversations(
  courseId?: string
): Promise<PrivateMessageConversation[]> {
  const user = await requireAdminAuth()
  if (courseId) await requireCourseManageAccess(courseId)

  const messages = await prisma.lessonPrivateMessage.findMany({
    where: {
      lesson: {
        chapter: courseId
          ? { courseId }
          : { course: manageableCourseWhereForUser(user) },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: CONVERSATION_SCAN_LIMIT,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
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

  const map = new Map<string, PrivateMessageConversation>()

  // messages 已依 createdAt desc 排序，故每個對話第一次出現的即為最後一則訊息
  for (const m of messages) {
    const key = `${m.lessonId}::${m.userId}`
    const isUnread = !m.isFromTeacher && !m.readByTeacher

    const existing = map.get(key)
    if (existing) {
      existing.totalCount += 1
      if (isUnread) existing.unreadCount += 1
      continue
    }

    map.set(key, {
      key,
      lessonId: m.lessonId,
      userId: m.userId,
      student: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      },
      course: m.lesson.chapter.course,
      lesson: {
        id: m.lesson.id,
        title: m.lesson.title,
        chapterTitle: m.lesson.chapter.title,
      },
      lastMessage: {
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        isFromTeacher: m.isFromTeacher,
        hasAttachment: !!m.attachmentUrl,
      },
      lastActivityAt: m.createdAt.toISOString(),
      totalCount: 1,
      unreadCount: isUnread ? 1 : 0,
    })
  }

  return Array.from(map.values()).sort((a, b) =>
    a.lastActivityAt < b.lastActivityAt ? 1 : -1
  )
}

/**
 * 取得單一對話的完整往返訊息（依時間正序）。
 */
export async function getPrivateMessageThread(
  lessonId: string,
  userId: string
): Promise<PrivateMessageThreadItem[]> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { chapter: { select: { courseId: true } } },
  })
  if (!lesson) return []
  await requireCourseManageAccess(lesson.chapter.courseId)

  const messages = await prisma.lessonPrivateMessage.findMany({
    where: { lessonId, userId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, image: true } } },
  })

  return messages.map((m) => ({
    id: m.id,
    content: m.content,
    attachmentUrl: m.attachmentUrl,
    attachmentName: m.attachmentName,
    attachmentMimeType: m.attachmentMimeType,
    attachmentSize: m.attachmentSize,
    isFromTeacher: m.isFromTeacher,
    readByTeacher: m.readByTeacher,
    createdAt: m.createdAt.toISOString(),
    user: {
      id: m.user.id,
      name: m.isFromTeacher ? '老師' : m.user.name,
      image: m.isFromTeacher ? null : m.user.image,
    },
  }))
}

/**
 * 將某對話中「學員傳來且老師尚未讀」的訊息標記為已讀。
 */
export async function markPrivateMessageThreadRead(
  lessonId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { chapter: { select: { courseId: true } } },
    })
    if (!lesson) return { success: false, error: '單元不存在' }
    await requireCourseManageAccess(lesson.chapter.courseId)

    await prisma.lessonPrivateMessage.updateMany({
      where: { lessonId, userId, isFromTeacher: false, readByTeacher: false },
      data: { readByTeacher: true },
    })

    return { success: true }
  } catch (error) {
    console.error('標記私訊已讀失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '標記私訊已讀失敗',
    }
  }
}

/**
 * 取得老師可管理範圍內的私訊未讀總數（學員傳來、老師未讀）。
 * 供後台側邊欄「老師私訊」徽章使用。
 */
export async function getUnreadPrivateMessageCountForAdmin(): Promise<number> {
  const user = await requireAdminAuth()

  return prisma.lessonPrivateMessage.count({
    where: {
      isFromTeacher: false,
      readByTeacher: false,
      lesson: { chapter: { course: manageableCourseWhereForUser(user) } },
    },
  })
}
