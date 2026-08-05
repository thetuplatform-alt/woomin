// lib/actions/lesson.ts
// 課程單元前台 Server Actions
// 提供單元內容取得、存取權限檢查、相鄰單元取得

'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getEffectiveLessonVideo } from '@/lib/video-source'
import { isPurchaseActive } from '@/lib/purchase/is-active'
import { encodeToolOrigin, buildToolEmbedSrc } from '@/lib/tool-embed'
import { signToolAccessToken } from '@/lib/tool-embed-token'

/**
 * 單元狀態類型
 */
export type LessonStatusType = 'PUBLISHED' | 'COMING_SOON'

/**
 * 單元內容資料型別
 */
export interface LessonContent {
  id: string
  title: string
  content: string | null
  videoProvider: 'youtube' | 'cloudflare' | 'vimeo' | 'bunny' | null
  videoSourceId: string | null
  videoUrl: string | null
  videoThumbnail: string | null
  videoId: string | null
  videoDuration: number | null
  subtitleUrl: string | null
  subtitleLang: string | null
  subtitleLabel: string | null
  // 注意：不可以放原始 toolUrl——這個型別會整包當 prop 傳給 client component
  // （PlayerLayout），序列化進 RSC/hydration payload 後，原始網址會直接以明文出現在
  // 頁面資料裡，不需要解 base64url 就能取得，讓 wrapper page／sandbox 的保護失去意義。
  // 只傳伺服器端算好、本身就有存取權驗證的代理網址。
  toolEmbedSrc: string | null
  toolWrapperHref: string | null
  toolTitle: string | null
  isFree: boolean
  order: number
  // 製作中設定
  status: LessonStatusType
  comingSoonTitle: string | null
  comingSoonDescription: string | null
  comingSoonImage: string | null
  comingSoonDate: Date | null
  chapter: {
    id: string
    title: string
    order: number
    course: {
      id: string
      title: string
      slug: string
    }
  }
}

/**
 * 課程大綱資料型別（用於側邊欄）
 */
export interface CourseCurriculumForPlayer {
  id: string
  title: string
  slug: string
  chapters: {
    id: string
    title: string
    order: number
    lessons: {
      id: string
      title: string
      videoDuration: number | null
      isFree: boolean
      order: number
      status: LessonStatusType
    }[]
  }[]
}

/**
 * 相鄰單元資料型別
 */
export interface AdjacentLessons {
  previous: {
    id: string
    title: string
  } | null
  next: {
    id: string
    title: string
  } | null
}

/**
 * 取得單元內容
 */
export async function getLessonContent(
  lessonId: string
): Promise<LessonContent | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
            },
          },
        },
      },
    },
  })

  // 課程不存在或未發佈（草稿狀態不允許存取）
  if (!lesson || lesson.chapter.course.status === 'DRAFT') {
    return null
  }

  // 檢查存取權限，未授權時不回傳 videoId（防止洩漏付費影片 ID）
  const session = await auth()
  let hasAccess = lesson.isFree
  if (!hasAccess && session?.user?.id) {
    const purchase = await prisma.purchase.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: lesson.chapter.course.id,
        },
      },
      select: { revokedAt: true, expiresAt: true },
    })
    hasAccess = isPurchaseActive(purchase)
  }

  const effectiveVideo = getEffectiveLessonVideo(lesson)

  // 只在伺服器端算好代理網址／wrapper 網址，不要把原始 toolUrl 傳給 client component。
  // 代理網址裡的 accessToken 是現場簽發、綁定這次已確認過的存取權限（見
  // lib/tool-embed-token.ts）——不能用 cookie 頂替，sandboxed iframe 是 opaque
  // origin，會被 Chrome 的第三方 cookie 封鎖擋掉，只有烤進網址本身才不受影響。
  let toolEmbedSrc: string | null = null
  let toolWrapperHref: string | null = null
  if (hasAccess && lesson.toolUrl) {
    const accessToken = signToolAccessToken(lesson.id, session?.user?.id)
    toolEmbedSrc = buildToolEmbedSrc(lesson.id, lesson.toolUrl, accessToken)
    try {
      toolWrapperHref = `/lesson-tool/${lesson.id}/${encodeToolOrigin(new URL(lesson.toolUrl).origin)}`
    } catch {
      toolWrapperHref = null
    }
  }

  return {
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    videoProvider: hasAccess ? effectiveVideo.videoProvider : null,
    videoSourceId: hasAccess ? effectiveVideo.videoSourceId : null,
    videoUrl: hasAccess ? effectiveVideo.videoUrl : null,
    videoThumbnail: hasAccess ? effectiveVideo.videoThumbnail : null,
    videoId: hasAccess ? effectiveVideo.legacyVideoId : null,
    videoDuration: effectiveVideo.videoDuration,
    subtitleUrl: hasAccess ? lesson.subtitleUrl : null,
    subtitleLang: hasAccess ? lesson.subtitleLang : null,
    subtitleLabel: hasAccess ? lesson.subtitleLabel : null,
    toolEmbedSrc,
    toolWrapperHref,
    toolTitle: hasAccess ? lesson.toolTitle : null,
    isFree: lesson.isFree,
    order: lesson.order,
    // 製作中設定
    status: lesson.status as LessonStatusType,
    comingSoonTitle: lesson.comingSoonTitle,
    comingSoonDescription: lesson.comingSoonDescription,
    comingSoonImage: lesson.comingSoonImage,
    comingSoonDate: lesson.comingSoonDate,
    chapter: {
      id: lesson.chapter.id,
      title: lesson.chapter.title,
      order: lesson.chapter.order,
      course: {
        id: lesson.chapter.course.id,
        title: lesson.chapter.course.title,
        slug: lesson.chapter.course.slug,
      },
    },
  }
}

/**
 * 取得課程大綱（用於播放器側邊欄）
 */
export async function getCourseCurriculumForPlayer(
  courseId: string
): Promise<CourseCurriculumForPlayer | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      chapters: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          order: true,
          lessons: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              videoDuration: true,
              isFree: true,
              order: true,
              status: true,
            },
          },
        },
      },
    },
  })

  // 課程不存在或為草稿狀態
  if (!course || course.status === 'DRAFT') {
    return null
  }

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    chapters: course.chapters.map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.map((lesson) => ({
        ...lesson,
        status: lesson.status as LessonStatusType,
      })),
    })),
  }
}

/**
 * 檢查用戶是否有權限存取單元
 * @returns 'granted' | 'free' | 'not_purchased' | 'not_logged_in' | 'not_found'
 */
export async function checkLessonAccess(
  lessonId: string
): Promise<'granted' | 'free' | 'not_purchased' | 'expired' | 'not_logged_in' | 'not_found'> {
  // 取得單元資訊
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          course: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
  })

  // 單元不存在或課程為草稿狀態
  if (!lesson || lesson.chapter.course.status === 'DRAFT') {
    return 'not_found'
  }

  // 如果是免費試看單元，直接允許存取
  if (lesson.isFree) {
    return 'free'
  }

  // 檢查用戶是否登入
  const session = await auth()
  if (!session?.user?.id) {
    return 'not_logged_in'
  }

  // 檢查用戶是否已購買課程
  const purchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: lesson.chapter.course.id,
      },
    },
  })

  // 存取權有效性收斂至單一事實來源 isPurchaseActive()
  if (isPurchaseActive(purchase)) {
    return 'granted'
  }

  // 無效再細分回傳碼：未撤銷但 expiresAt 已過 → expired；其餘（不存在/撤銷）→ not_purchased
  if (purchase && !purchase.revokedAt && purchase.expiresAt) {
    return 'expired'
  }
  return 'not_purchased'
}

/**
 * 取得上一個/下一個單元
 */
export async function getAdjacentLessons(
  lessonId: string
): Promise<AdjacentLessons> {
  // 取得當前單元資訊
  const currentLesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          course: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  if (!currentLesson) {
    return { previous: null, next: null }
  }

  const courseId = currentLesson.chapter.course.id

  // 取得課程所有單元（按章節順序和單元順序排列）
  const allLessons = await prisma.lesson.findMany({
    where: {
      chapter: {
        courseId,
      },
    },
    include: {
      chapter: {
        select: {
          order: true,
        },
      },
    },
    orderBy: [
      {
        chapter: {
          order: 'asc',
        },
      },
      {
        order: 'asc',
      },
    ],
  })

  // 找到當前單元在列表中的位置
  const currentIndex = allLessons.findIndex(
    (lesson) => lesson.id === lessonId
  )

  // 取得上一個和下一個單元
  const previousLesson =
    currentIndex > 0
      ? {
          id: allLessons[currentIndex - 1].id,
          title: allLessons[currentIndex - 1].title,
        }
      : null

  const nextLesson =
    currentIndex < allLessons.length - 1
      ? {
          id: allLessons[currentIndex + 1].id,
          title: allLessons[currentIndex + 1].title,
        }
      : null

  return {
    previous: previousLesson,
    next: nextLesson,
  }
}

/**
 * 取得用戶在課程中的進度（已完成的單元列表）
 */
export async function getUserCourseProgress(
  courseId: string
): Promise<string[]> {
  const session = await auth()

  if (!session?.user?.id) {
    return []
  }

  const progress = await prisma.lessonProgress.findMany({
    where: {
      userId: session.user.id,
      completed: true,
      lesson: {
        chapter: {
          courseId,
        },
      },
    },
    select: {
      lessonId: true,
    },
  })

  return progress.map((p) => p.lessonId)
}
