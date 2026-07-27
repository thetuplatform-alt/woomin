import { prisma } from '@/lib/prisma'
import { resolveAppUrl } from '@/lib/app-url'
import {
  getStorageObjectRefFromUrl,
  readLocalStorageObject,
} from '@/lib/storage'
import type { Media, UserRole } from '@prisma/client'

interface SessionUser {
  id?: string | null
  role?: UserRole | string | null
  name?: string | null
  email?: string | null
}

export interface PdfAccessContext {
  media: Media
  lesson: {
    id: string
    title: string
    isFree: boolean
    content: string | null
    chapter: {
      course: {
        id: string
        title: string
        slug: string
      }
    }
  }
  canDownload: boolean
  dynamicWatermarkEnabled: boolean
}

export interface ResolvePdfAccessParams {
  lessonId?: string | null
  mediaId?: string | null
  url?: string | null
  user: SessionUser
}

function normalizeUrlCandidates(url: string) {
  const candidates = new Set([url])

  try {
    const parsed = new URL(url)
    candidates.add(parsed.pathname)
  } catch {
    // Relative URL.
  }

  return [...candidates]
}

function contentReferencesMedia(
  content: string | null,
  media: Media,
  _requestedUrl?: string | null
) {
  if (!content) return false

  // 精準比對：以 media 的唯一 id 為主（cuid，不會誤判）
  if (content.includes(`mediaId: ${media.id}`) || content.includes(`id: ${media.id}`)) {
    return true
  }

  // L43：只用「伺服器端的 media 自身識別」（其 url / filename 內含唯一 storage key）做比對，
  // 不再採用「使用者傳入的 requestedUrl」作為比對來源，避免攻擊者以可控字串騙過歸屬判定，
  // 取得不屬於該單元的 PDF。同時要求候選字串足夠具體（長度 >= 12）以避免過短字串誤命中。
  const candidates = [media.url, media.filename, ...normalizeUrlCandidates(media.url)]
    .filter((c): c is string => Boolean(c) && c.length >= 12)

  return candidates.some((candidate) => content.includes(candidate))
}

async function findPdfMedia(mediaId?: string | null, url?: string | null) {
  if (mediaId) {
    return prisma.media.findFirst({
      where: {
        id: mediaId,
        type: 'ATTACHMENT',
        mimeType: 'application/pdf',
      },
    })
  }

  if (!url) return null

  const candidates = normalizeUrlCandidates(url)

  return prisma.media.findFirst({
    where: {
      type: 'ATTACHMENT',
      mimeType: 'application/pdf',
      OR: [
        ...candidates.map((candidate) => ({ url: candidate })),
        ...candidates.map((candidate) => ({ filename: candidate })),
      ],
    },
    orderBy: { createdAt: 'desc' },
  })
}

async function findLessonForMedia(media: Media, lessonId?: string | null) {
  if (lessonId) {
    return prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        isFree: true,
        content: true,
        chapter: {
          select: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
    })
  }

  if (media.sourceType === 'LESSON_CONTENT' && media.sourceId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: media.sourceId },
      select: {
        id: true,
        title: true,
        isFree: true,
        content: true,
        chapter: {
          select: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
    })

    if (lesson) return lesson
  }

  return prisma.lesson.findFirst({
    where: {
      content: {
        contains: media.url,
      },
    },
    select: {
      id: true,
      title: true,
      isFree: true,
      content: true,
      chapter: {
        select: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      },
    },
  })
}

async function userHasCourseAccess(userId: string, courseId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    select: {
      revokedAt: true,
      expiresAt: true,
    },
  })

  return Boolean(
    purchase &&
      !purchase.revokedAt &&
      (!purchase.expiresAt || purchase.expiresAt > new Date())
  )
}

export async function resolvePdfAccess({
  lessonId,
  mediaId,
  url,
  user,
}: ResolvePdfAccessParams): Promise<
  | { success: true; context: PdfAccessContext }
  | { success: false; status: number; error: string }
> {
  if (!user.id) {
    return { success: false, status: 401, error: '請先登入後再閱讀 PDF 講義' }
  }

  const media = await findPdfMedia(mediaId, url)
  if (!media) {
    return {
      success: false,
      status: 404,
      error: '找不到受保護的 PDF 檔案，請重新上傳講義或聯繫管理員。',
    }
  }

  const lesson = await findLessonForMedia(media, lessonId)
  if (!lesson) {
    return {
      success: false,
      status: 404,
      error: '找不到這份 PDF 對應的課程單元。',
    }
  }

  const isLinkedToLesson =
    (media.sourceType === 'LESSON_CONTENT' && media.sourceId === lesson.id) ||
    contentReferencesMedia(lesson.content, media, url)

  if (!isLinkedToLesson) {
    return {
      success: false,
      status: 403,
      error: '這份 PDF 不屬於目前課程單元。',
    }
  }

  const isStaff = user.role === 'ADMIN' || user.role === 'EDITOR'
  const hasAccess =
    isStaff ||
    lesson.isFree ||
    await userHasCourseAccess(user.id, lesson.chapter.course.id)

  if (!hasAccess) {
    return {
      success: false,
      status: 403,
      error: '你尚未取得這門課程的觀看權限。',
    }
  }

  return {
    success: true,
    context: {
      media,
      lesson,
      canDownload: media.allowDownload,
      dynamicWatermarkEnabled: media.dynamicWatermarkEnabled,
    },
  }
}

export async function readPdfMediaBuffer(media: Media) {
  const storageRef = await getStorageObjectRefFromUrl(media.url)

  if (storageRef?.driver === 'local') {
    const result = await readLocalStorageObject(storageRef.key)
    if (result.success && result.buffer) return result.buffer
    throw new Error(result.error || '無法讀取本地 PDF 檔案')
  }

  const appUrl = await resolveAppUrl()
  const sourceUrl = media.url.startsWith('http')
    ? media.url
    : new URL(media.url, appUrl).toString()
  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error(`無法讀取 PDF 檔案 (HTTP ${response.status})`)
  }

  return Buffer.from(await response.arrayBuffer())
}
