// components/main/course-grid.tsx
// 課程列表網格元件
// Design System - 極簡風格

import { CourseCard } from '@/components/main/course-card'
import type { PublishedCourse } from '@/lib/actions/public-courses'

interface CourseGridProps {
  courses: PublishedCourse[]
  showTitle?: boolean
}

export function CourseGrid({ courses, showTitle = true }: CourseGridProps) {
  return (
    <section id="courses" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 區塊標題 */}
        {showTitle && (
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
              精選課程
            </h2>
            <p className="mt-4 text-lg text-body">
              從基礎到進階，系統化學習
            </p>
          </div>
        )}

        {/* 課程網格 */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * 空狀態元件
 * 當沒有課程時顯示
 */
export function CourseGridEmpty() {
  return (
    <section id="courses" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 區塊標題 */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-heading sm:text-4xl">
            精選課程
          </h2>
        </div>

        {/* 空狀態提示 */}
        <div className="flex flex-col items-center justify-center py-20 rounded-[2rem] border-2 border-dashed border-divider bg-surface">
          <div className="mb-6 rounded-full bg-white p-6 shadow-sm">
            <svg
              className="h-12 w-12 text-[#D4D4D4]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-heading">尚無課程</h3>
          <p className="mt-2 text-body">
            精彩課程即將推出，敬請期待！
          </p>
        </div>
      </div>
    </section>
  )
}
