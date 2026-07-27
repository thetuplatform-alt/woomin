// app/(admin)/admin/comments/page.tsx
// 課程留言頁面：一覽所有課程/章節/單元的群組留言
// （老師私訊已獨立至 /admin/messages）

import {
  getAllLessonCommentsForAdmin,
  getCommentManageableCourses,
} from '@/lib/actions/lesson-comments-admin'
import { AllCommentsTable } from '@/components/admin/comments/all-comments-table'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '課程留言',
}

interface AdminCommentsPageProps {
  searchParams: Promise<{ courseId?: string }>
}

function serializeComment(c: {
  id: string
  content: string
  isAnonymous: boolean
  createdAt: Date
  deletedAt: Date | null
  user: { id: string; name: string | null; email: string; image: string | null }
  lesson: {
    id: string
    title: string
    chapter: {
      id: string
      title: string
      course: { id: string; title: string; slug: string }
    }
  }
}) {
  return {
    id: c.id,
    content: c.content,
    isAnonymous: c.isAnonymous,
    createdAt: c.createdAt.toISOString(),
    deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
    user: c.user,
    lesson: c.lesson,
  }
}

export default async function AdminCommentsPage({ searchParams }: AdminCommentsPageProps) {
  const params = await searchParams
  const courseId = params.courseId || undefined
  const [page, courses] = await Promise.all([
    getAllLessonCommentsForAdmin(undefined, courseId),
    getCommentManageableCourses(),
  ])

  return (
    <div className="space-y-8 p-6">
      <AllCommentsTable
        initialComments={page.comments.map(serializeComment)}
        initialNextCursor={page.nextCursor}
        initialTotalCount={page.totalCount}
        courses={courses}
        selectedCourseId={courseId ?? 'ALL'}
      />
    </div>
  )
}
