// app/(admin)/admin/courses/[id]/layout-client.tsx
// 課程編輯器 Layout 的 Client 包裹器
// 提供 CourseEditorProvider 和 Tab Header

'use client'

import { type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Course } from '@prisma/client'
import type { ChapterWithLessons } from '@/lib/actions/curriculum'
import { CourseEditorProvider } from '@/lib/contexts/course-editor-context'
import { TabHeader } from '@/components/admin/course-editor/tab-header'

interface CourseEditorLayoutClientProps {
  children: ReactNode
  course: Course
  curriculum: ChapterWithLessons[]
}

export function CourseEditorLayoutClient({
  children,
  course,
  curriculum,
}: CourseEditorLayoutClientProps) {
  const searchParams = useSearchParams()
  const lessonId = searchParams.get('lesson')

  return (
    <CourseEditorProvider
      initialCourse={course}
      initialCurriculum={curriculum}
      initialSelectedLessonId={lessonId}
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* Tab Header */}
        <TabHeader courseId={course.id} courseTitle={course.title} />

        {/* 頁面內容 */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </CourseEditorProvider>
  )
}
