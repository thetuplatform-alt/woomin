// components/main/player/chapter-sidebar.tsx
// 章節側邊欄元件
// 抽屜式側邊欄，顯示章節和單元列表，包含完成狀態和進度百分比

'use client'

import React from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CurriculumList } from './curriculum-list'
import { Progress } from '@/components/ui/progress'
import type { CourseCurriculumForPlayer } from '@/lib/actions/lesson'
import type { CourseProgressStats } from '@/lib/validations/progress'

interface ChapterSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  curriculum: CourseCurriculumForPlayer
  currentLessonId: string
  completedLessons: string[]
  courseSlug: string
  courseProgress?: CourseProgressStats
  onToggleComplete?: (lessonId: string, completed: boolean) => void
}

export function ChapterSidebar({
  open,
  onOpenChange,
  curriculum,
  currentLessonId,
  completedLessons,
  courseSlug,
  courseProgress,
  onToggleComplete,
}: ChapterSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full z-[999] border-r border-gray-100 bg-white p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-gray-50 p-6">
          <SheetTitle className="text-left text-xl font-extrabold text-heading">
            {curriculum.title}
          </SheetTitle>

          {/* 整體進度 */}
          {courseProgress && courseProgress.totalLessons > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">目前學習進度</span>
                <span className="flex items-center gap-1.5 font-bold text-cta">
                  <CheckCircle2 className="h-4 w-4" />
                  {courseProgress.completedLessons} / {courseProgress.totalLessons}
                </span>
              </div>
              <Progress
                value={courseProgress.progressPercentage}
                className="h-2 bg-gray-50 [&>div]:bg-cta"
              />
            </div>
          )}
        </SheetHeader>

        <div className="h-[calc(100vh-180px)] overflow-hidden">
          <CurriculumList
            curriculum={curriculum}
            currentLessonId={currentLessonId}
            completedLessons={completedLessons}
            courseSlug={courseSlug}
            courseProgress={courseProgress}
            onItemClick={() => onOpenChange(false)}
            onToggleComplete={onToggleComplete}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
