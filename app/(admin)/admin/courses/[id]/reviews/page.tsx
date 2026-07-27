// app/(admin)/admin/courses/[id]/reviews/page.tsx
// 課程評價管理頁面

import { getReviewsForAdmin, getReviewStatsForAdmin } from '@/lib/actions/reviews-admin'
import { prisma } from '@/lib/prisma'
import { ReviewsAdminClient } from './page-client'

export const metadata = {
  title: '課程評價',
}

interface ReviewsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ReviewsPage({ params }: ReviewsPageProps) {
  const { id: courseId } = await params

  const [reviews, stats, course] = await Promise.all([
    getReviewsForAdmin(courseId),
    getReviewStatsForAdmin(courseId),
    prisma.course.findUnique({
      where: { id: courseId },
      select: { enableReviews: true, showReviews: true },
    }),
  ])

  return (
    <ReviewsAdminClient
      courseId={courseId}
      reviews={reviews}
      stats={stats}
      enableReviews={course?.enableReviews ?? false}
      showReviews={course?.showReviews ?? false}
    />
  )
}
