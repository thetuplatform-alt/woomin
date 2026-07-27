// app/(admin)/admin/courses/[id]/invites/page.tsx
// 課程邀請連結管理頁。

import { notFound } from 'next/navigation'
import { getCourseById } from '@/lib/actions/courses'
import { listCourseInvites } from '@/lib/actions/course-invites'
import { CourseInvitesPanel } from '@/components/admin/courses/course-invites-panel'

export const metadata = {
  title: '邀請連結',
}

interface InvitesPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function InvitesPage({ params }: InvitesPageProps) {
  const { id } = await params
  const [course, inviteResult] = await Promise.all([
    getCourseById(id),
    listCourseInvites(id),
  ])

  if (!course) {
    notFound()
  }

  return (
    <CourseInvitesPanel
      courseId={course.id}
      courseTitle={course.title}
      courseSlug={course.slug}
      invites={inviteResult.invites ?? []}
    />
  )
}
