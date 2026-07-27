// app/(admin)/admin/courses/[id]/info/page.tsx
// 課程資訊頁面

import { notFound } from 'next/navigation'
import { getCourseById } from '@/lib/actions/courses'
import { getInstructorUsers } from '@/lib/actions/users'
import { requireAdminAuth } from '@/lib/require-admin'
import { CourseDetailsForm } from '@/components/admin/courses/course-details-form'

export const metadata = {
  title: '課程資訊',
}

interface InfoPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function InfoPage({ params }: InfoPageProps) {
  const { id } = await params

  const [actor, course, instructors] = await Promise.all([
    requireAdminAuth(),
    getCourseById(id),
    getInstructorUsers(),
  ])

  if (!course) {
    notFound()
  }

  return (
    <CourseDetailsForm
      course={course}
      instructors={instructors}
      currentUserId={actor.id}
      currentUserRole={actor.role}
    />
  )
}
