// app/(main)/my-courses/page.tsx
// 我的課程頁面 - 顯示用戶已購買的課程和學習進度

import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getMyCourses, getContinueLearning } from '@/lib/actions/my-courses'
import { ContinueLearningCard } from '@/components/main/my-courses/continue-learning-card'
import { MyCourseGrid } from '@/components/main/my-courses/my-course-grid'
import { EmptyCourses } from '@/components/main/my-courses/empty-courses'

export const metadata: Metadata = {
  title: '我的課程 | 課程平台',
  description: '管理您的學習進度，繼續未完成的課程',
}

export default async function MyCoursesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/my-courses')
  }

  const [courses, continueLearning] = await Promise.all([
    getMyCourses(),
    getContinueLearning(),
  ])

  return (
    <div className="min-h-screen bg-white">
      {/* 頁面標題區 */}
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-heading sm:text-5xl">
            我的課程
          </h1>
          <p className="mt-4 text-lg text-body">
            管理您的學習進度，繼續未完成的課程
          </p>
        </div>
      </section>

      {/* 主要內容區 */}
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        {courses.length === 0 ? (
          <EmptyCourses />
        ) : (
          <div className="space-y-16">
            {/* 繼續學習 Hero Card */}
            {continueLearning && (
              <ContinueLearningCard data={continueLearning} />
            )}

            {/* 課程網格 */}
            <MyCourseGrid courses={courses} />
          </div>
        )}
      </div>
    </div>
  )
}

