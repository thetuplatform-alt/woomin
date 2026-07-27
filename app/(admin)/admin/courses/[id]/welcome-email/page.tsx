// app/(admin)/admin/courses/[id]/welcome-email/page.tsx
// 課程歡迎信設定頁

import { notFound } from 'next/navigation'
import { getCourseById } from '@/lib/actions/courses'
import { getCourseWelcomeEmailSettings } from '@/lib/actions/course-welcome-email'
import { CourseWelcomeEmailForm } from '@/components/admin/courses/course-welcome-email-form'

export const metadata = {
  title: '課程歡迎信',
}

interface WelcomeEmailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function WelcomeEmailPage({ params }: WelcomeEmailPageProps) {
  const { id } = await params

  const [course, settings] = await Promise.all([
    getCourseById(id),
    getCourseWelcomeEmailSettings(id),
  ])

  if (!course) {
    notFound()
  }

  return (
    <CourseWelcomeEmailForm
      courseId={id}
      courseTitle={course.title}
      courseSlug={course.slug}
      initialSettings={settings}
    />
  )
}
