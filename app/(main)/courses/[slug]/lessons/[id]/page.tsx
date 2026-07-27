// app/(main)/courses/[slug]/lessons/[id]/page.tsx
// 課程單元播放頁面
// Server Component - 處理權限檢查和資料取得

import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getLessonContent,
  checkLessonAccess,
  getAdjacentLessons,
  getCourseCurriculumForPlayer,
  getUserCourseProgress,
} from '@/lib/actions/lesson'
import { checkQuizBlockStatus } from '@/lib/actions/quiz'
import { getCourseProgress } from '@/lib/actions/progress'
import { getUserReview } from '@/lib/actions/reviews'
import { PlayerLayout } from '@/components/main/player/player-layout'
import type { VideoWatermarkPayload } from '@/lib/video-watermark'

// 強制動態渲染
export const dynamic = 'force-dynamic'

interface LessonPageProps {
  params: Promise<{
    slug: string
    id: string
  }>
}

// 動態產生 Metadata
export async function generateMetadata({
  params,
}: LessonPageProps): Promise<Metadata> {
  const { id } = await params
  const lesson = await getLessonContent(id)

  if (!lesson) {
    return {
      title: '找不到單元',
    }
  }

  return {
    title: `${lesson.title} | ${lesson.chapter.course.title}`,
    description: `${lesson.chapter.course.title} - ${lesson.chapter.title} - ${lesson.title}`,
  }
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { slug, id } = await params
  const session = await auth()

  // 取得單元內容
  const lesson = await getLessonContent(id)

  // 單元不存在
  if (!lesson) {
    notFound()
  }

  // 確認 slug 與課程相符
  if (lesson.chapter.course.slug !== slug) {
    notFound()
  }

  // 檢查存取權限
  const accessStatus = await checkLessonAccess(id)

  switch (accessStatus) {
    case 'not_found':
      notFound()
      break

    case 'not_logged_in':
      // 未登入，重導向到登入頁
      redirect(`/auth/signin?callbackUrl=/courses/${slug}/lessons/${id}`)
      break

    case 'not_purchased':
      // 未購買，重導向到課程銷售頁
      redirect(`/courses/${slug}`)
      break

    case 'expired':
      // 已過期，重導向到銷售頁並帶 flag，讓銷售頁顯示續購提示
      redirect(`/courses/${slug}?expired=1`)
      break

    case 'free':
    case 'granted':
      // 有權限，繼續顯示
      break
  }

  // 取得相鄰單元、課程大綱、已完成單元、課程進度和評價狀態
  const courseId = lesson.chapter.course.id
  const [adjacentLessons, curriculum, completedLessons, courseProgress, userReview, courseSettings] =
    await Promise.all([
      getAdjacentLessons(id),
      getCourseCurriculumForPlayer(courseId),
      getUserCourseProgress(courseId),
      getCourseProgress(courseId),
      getUserReview(courseId),
      import('@/lib/prisma').then(({ prisma }) =>
        prisma.course.findUnique({
          where: { id: courseId },
          select: {
            enableReviews: true,
            title: true,
            videoWatermarkSetting: true,
          },
        })
      ),
    ])

  // 課程大綱應該存在
  if (!curriculum) {
    notFound()
  }

  // 計算被測驗阻擋的單元 ID（用於大綱鎖定顯示）
  const blockedLessonIds: string[] = []
  if (session?.user?.id && curriculum) {
    const allLessons = curriculum.chapters.flatMap((ch) => ch.lessons)
    for (let i = 0; i < allLessons.length; i++) {
      const lesson = allLessons[i]
      const blockStatus = await checkQuizBlockStatus(lesson.id, session.user.id)
      if (blockStatus.blocked) {
        // 這個單元的測驗未通過，阻擋之後的所有單元
        for (let j = i + 1; j < allLessons.length; j++) {
          blockedLessonIds.push(allLessons[j].id)
        }
        break
      }
    }
  }

  const watermark: VideoWatermarkPayload | undefined = courseSettings
    ? {
        enabled: courseSettings.videoWatermarkSetting?.enabled ?? false,
        viewerEmail: session?.user?.email ?? null,
        courseTitle: courseSettings.title,
        showEmail: courseSettings.videoWatermarkSetting?.showEmail ?? true,
        showCourseTitle:
          courseSettings.videoWatermarkSetting?.showCourseTitle ?? true,
        showTimestamp:
          courseSettings.videoWatermarkSetting?.showTimestamp ?? true,
        emailDisplayMode:
          courseSettings.videoWatermarkSetting?.emailDisplayMode ?? 'FULL',
        opacityPercent:
          courseSettings.videoWatermarkSetting?.opacityPercent ?? 18,
        textSize: courseSettings.videoWatermarkSetting?.textSize ?? 'MD',
        movementMode:
          courseSettings.videoWatermarkSetting?.movementMode ?? 'STANDARD',
        moveIntervalSec:
          courseSettings.videoWatermarkSetting?.moveIntervalSec ?? 12,
        tamperPauseEnabled:
          courseSettings.videoWatermarkSetting?.tamperPauseEnabled ?? true,
      }
    : undefined

  return (
    <PlayerLayout
      lesson={lesson}
      adjacentLessons={adjacentLessons}
      curriculum={curriculum}
      completedLessons={completedLessons}
      courseSlug={slug}
      courseProgress={courseProgress}
      courseId={courseId}
      hasReview={!!userReview}
      showReviews={courseSettings?.enableReviews ?? false}
      watermark={watermark}
      blockedLessonIds={blockedLessonIds}
    />
  )
}
