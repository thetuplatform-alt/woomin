// app/(admin)/admin/courses/[id]/layout.tsx
// 課程編輯器 Layout
// 提供 Tab 導航和 CourseEditorProvider

import { notFound } from 'next/navigation'
import { getCourseById } from '@/lib/actions/courses'
import { getCourseCurriculum } from '@/lib/actions/curriculum'
import { CourseEditorLayoutClient } from './layout-client'

interface CourseEditorLayoutProps {
  children: React.ReactNode
  params: Promise<{
    id: string
  }>
}

export default async function CourseEditorLayout({
  children,
  params,
}: CourseEditorLayoutProps) {
  const { id } = await params

  // 並行獲取課程資料和大綱
  const [course, curriculum] = await Promise.all([
    getCourseById(id),
    getCourseCurriculum(id),
  ])

  // 如果課程不存在，顯示 404
  if (!course) {
    notFound()
  }

  return (
    <CourseEditorLayoutClient
      course={course}
      curriculum={curriculum?.chapters ?? []}
    >
      {children}
    </CourseEditorLayoutClient>
  )
}
