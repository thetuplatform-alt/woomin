// components/main/my-courses/my-course-grid.tsx
// 我的課程網格 - 含篩選功能

'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MyCourseCard } from './my-course-card'
import type { MyCourse } from '@/lib/actions/my-courses'

type FilterType = 'all' | 'in-progress' | 'completed'

interface MyCourseGridProps {
  courses: MyCourse[]
}

export function MyCourseGrid({ courses }: MyCourseGridProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  // 計算各分類數量
  const counts = useMemo(() => {
    const inProgress = courses.filter(
      (c) => c.progress.progressPercentage > 0 && !c.isCompleted
    ).length
    const completed = courses.filter((c) => c.isCompleted).length

    return {
      all: courses.length,
      'in-progress': inProgress,
      completed,
    }
  }, [courses])

  // 過濾課程
  const filteredCourses = useMemo(() => {
    switch (filter) {
      case 'in-progress':
        return courses.filter(
          (c) => c.progress.progressPercentage > 0 && !c.isCompleted
        )
      case 'completed':
        return courses.filter((c) => c.isCompleted)
      default:
        return courses
    }
  }, [courses, filter])

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部課程' },
    { key: 'in-progress', label: '學習中' },
    { key: 'completed', label: '已完成' },
  ]

  return (
    <section className="space-y-8">
      {/* 篩選標籤 */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-heading">所有課程</h2>
        <div className="flex flex-wrap gap-2">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                filter === key
                  ? 'bg-heading text-white shadow-lg shadow-black/5'
                  : 'bg-surface-hover text-body hover:bg-divider'
              }`}
            >
              {label}
              <span
                className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                  filter === key ? 'bg-white/20 text-white' : 'bg-black/5 text-caption'
                }`}
              >
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 課程網格 */}
      <AnimatePresence mode="popLayout">
        {filteredCourses.length > 0 ? (
          <motion.div 
            layout
            className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredCourses.map((course, index) => (
              <MyCourseCard key={course.id} course={course} index={index} />
            ))}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center rounded-3xl border border-divider bg-surface py-24 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
               <span className="text-2xl text-caption">∅</span>
            </div>
            <p className="text-lg font-medium text-heading">
              {filter === 'in-progress' && '沒有正在進行中的課程'}
              {filter === 'completed' && '目前還沒有已完成的課程'}
              {filter === 'all' && '目前沒有任何課程'}
            </p>
            <p className="mt-2 text-body">
              去商店看看有沒有感興趣的內容吧
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

