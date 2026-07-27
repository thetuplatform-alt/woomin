// app/(admin)/admin/courses/[id]/assignments/page.tsx
// 課程作業 / 測驗管理頁面 — 列出所有單元的作業提交與測驗作答結果

import { prisma } from '@/lib/prisma'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import { redirect } from 'next/navigation'
import { AssignmentsPageClient } from './page-client'

export const metadata = {
  title: '作業 / 測驗管理',
}

interface AssignmentsPageProps {
  params: Promise<{ id: string }>
}

export default async function AssignmentsPage({ params }: AssignmentsPageProps) {
  const { id: courseId } = await params
  await requireCourseManageAccess(courseId)

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
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
              order: true,
              assignment: {
                select: {
                  id: true,
                  title: true,
                  gradingType: true,
                  _count: {
                    select: { submissions: { where: { status: { not: 'DRAFT' } } } },
                  },
                },
              },
              quiz: {
                select: {
                  id: true,
                  _count: { select: { attempts: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!course) {
    redirect('/admin/courses')
  }

  return <AssignmentsPageClient course={course} />
}
