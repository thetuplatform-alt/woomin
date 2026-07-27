// lib/actions/reviews-admin.ts
// 課程評價 Server Actions（後台管理）

'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { replyToReviewSchema } from '@/lib/validations/review'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import type { AdminReviewData, ReviewStats } from '@/lib/validations/review'

/**
 * 取得課程所有評價（後台，包含隱藏的、舉報資訊）
 */
export async function getReviewsForAdmin(
  courseId: string
): Promise<AdminReviewData[]> {
  await requireCourseManageAccess(courseId)

  const reviews = await prisma.courseReview.findMany({
    where: { courseId },
    select: {
      id: true,
      rating: true,
      content: true,
      isVisible: true,
      helpfulCount: true,
      replyContent: true,
      replyAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      reports: {
        select: {
          reason: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    content: r.content,
    isVisible: r.isVisible,
    helpfulCount: r.helpfulCount,
    isHelpful: false,
    hasReported: false,
    replyContent: r.replyContent,
    replyAt: r.replyAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    user: r.user,
    reportCount: r.reports.length,
    reports: r.reports.map((rp) => ({
      reason: rp.reason,
      createdAt: rp.createdAt.toISOString(),
    })),
  }))
}

/**
 * 取得課程評價統計（後台，含所有評價）
 */
export async function getReviewStatsForAdmin(
  courseId: string
): Promise<ReviewStats> {
  await requireCourseManageAccess(courseId)

  const reviews = await prisma.courseReview.findMany({
    where: { courseId },
    select: { rating: true },
  })

  const reviewCount = reviews.length
  const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let totalRating = 0

  for (const review of reviews) {
    totalRating += review.rating
    distribution[review.rating] = (distribution[review.rating] || 0) + 1
  }

  const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    reviewCount,
    distribution,
  }
}

/**
 * 切換評價可見性
 */
export async function toggleReviewVisibility(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const review = await prisma.courseReview.findUnique({
      where: { id: reviewId },
      select: { isVisible: true, courseId: true },
    })

    if (!review) {
      return { success: false, error: '評價不存在' }
    }
    await requireCourseManageAccess(review.courseId)

    await prisma.courseReview.update({
      where: { id: reviewId },
      data: { isVisible: !review.isVisible },
    })

    await syncCourseRatingAdmin(review.courseId)

    revalidatePath(`/admin/courses/${review.courseId}/reviews`)
    const course = await prisma.course.findUnique({
      where: { id: review.courseId },
      select: { slug: true },
    })
    if (course) {
      revalidatePath(`/courses/${course.slug}`)
    }

    return { success: true }
  } catch (error) {
    console.error('切換評價可見性失敗:', error)
    return { success: false, error: '操作失敗' }
  }
}

/**
 * 更新課程的 enableReviews 設定（評價功能總開關）
 */
export async function updateEnableReviews(
  courseId: string,
  enableReviews: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireCourseManageAccess(courseId)

    await prisma.course.update({
      where: { id: courseId },
      data: { enableReviews },
    })

    // 如果關閉功能，同時關閉顯示並清除 ratingValue/ratingCount
    if (!enableReviews) {
      await prisma.course.update({
        where: { id: courseId },
        data: { showReviews: false, ratingValue: null, ratingCount: null },
      })
    }

    revalidatePath(`/admin/courses/${courseId}/reviews`)
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { slug: true },
    })
    if (course) {
      revalidatePath(`/courses/${course.slug}`)
    }

    return { success: true }
  } catch (error) {
    console.error('更新 enableReviews 失敗:', error)
    return { success: false, error: '操作失敗' }
  }
}

/**
 * 更新課程的 showReviews 設定
 */
export async function updateShowReviews(
  courseId: string,
  showReviews: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireCourseManageAccess(courseId)

    await prisma.course.update({
      where: { id: courseId },
      data: { showReviews },
    })

    if (!showReviews) {
      await prisma.course.update({
        where: { id: courseId },
        data: { ratingValue: null, ratingCount: null },
      })
    } else {
      await syncCourseRatingAdmin(courseId)
    }

    revalidatePath(`/admin/courses/${courseId}/reviews`)
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { slug: true },
    })
    if (course) {
      revalidatePath(`/courses/${course.slug}`)
    }

    return { success: true }
  } catch (error) {
    console.error('更新 showReviews 失敗:', error)
    return { success: false, error: '操作失敗' }
  }
}

/**
 * 回覆評價
 */
export async function replyToReview(input: {
  reviewId: string
  content: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = replyToReviewSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || '輸入格式錯誤' }
    }

    const { reviewId, content } = parsed.data

    const review = await prisma.courseReview.findUnique({
      where: { id: reviewId },
      select: { courseId: true },
    })

    if (!review) {
      return { success: false, error: '評價不存在' }
    }
    await requireCourseManageAccess(review.courseId)

    await prisma.courseReview.update({
      where: { id: reviewId },
      data: { replyContent: content, replyAt: new Date() },
    })

    revalidatePath(`/admin/courses/${review.courseId}/reviews`)
    const course = await prisma.course.findUnique({
      where: { id: review.courseId },
      select: { slug: true },
    })
    if (course) {
      revalidatePath(`/courses/${course.slug}`)
    }

    return { success: true }
  } catch (error) {
    console.error('回覆評價失敗:', error)
    return { success: false, error: '回覆失敗' }
  }
}

/**
 * 更新回覆
 */
export async function updateReplyToReview(input: {
  reviewId: string
  content: string
}): Promise<{ success: boolean; error?: string }> {
  return replyToReview(input) // 邏輯相同：覆寫 replyContent 和 replyAt
}

/**
 * 刪除回覆
 */
export async function deleteReplyToReview(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const review = await prisma.courseReview.findUnique({
      where: { id: reviewId },
      select: { courseId: true },
    })

    if (!review) {
      return { success: false, error: '評價不存在' }
    }
    await requireCourseManageAccess(review.courseId)

    await prisma.courseReview.update({
      where: { id: reviewId },
      data: { replyContent: null, replyAt: null },
    })

    revalidatePath(`/admin/courses/${review.courseId}/reviews`)
    const course = await prisma.course.findUnique({
      where: { id: review.courseId },
      select: { slug: true },
    })
    if (course) {
      revalidatePath(`/courses/${course.slug}`)
    }

    return { success: true }
  } catch (error) {
    console.error('刪除回覆失敗:', error)
    return { success: false, error: '刪除失敗' }
  }
}

/**
 * 同步課程評分（後台用）
 */
async function syncCourseRatingAdmin(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { showReviews: true },
  })

  if (!course?.showReviews) return

  const reviews = await prisma.courseReview.findMany({
    where: { courseId, isVisible: true },
    select: { rating: true },
  })

  const count = reviews.length
  const avg =
    count > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
      : 0

  await prisma.course.update({
    where: { id: courseId },
    data: {
      ratingValue: count > 0 ? avg.toString() : null,
      ratingCount: count > 0 ? count.toString() : null,
    },
  })
}
