// lib/contexts/course-editor-context.tsx
// 課程編輯器 Context
// 管理課程資料、大綱和選中的單元狀態

'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { Course, Lesson } from '@prisma/client'
import type { ChapterWithLessons } from '@/lib/actions/curriculum'

interface CourseEditorContextValue {
  /** 當前課程資料 */
  course: Course | null
  /** 課程大綱（章節與單元） */
  curriculum: ChapterWithLessons[]
  /** 當前選中的單元 ID */
  selectedLessonId: string | null
  /** 當前選中的單元資料 */
  selectedLesson: Lesson | null
  /** 設定選中的單元 */
  setSelectedLessonId: (id: string | null) => void
  /** 更新課程資料 */
  setCourse: (course: Course | null) => void
  /** 更新大綱資料 */
  setCurriculum: (curriculum: ChapterWithLessons[]) => void
  /** 更新單一單元資料 (樂觀更新) */
  updateLessonInCurriculum: (lessonId: string, updates: Partial<Lesson>) => void
  /** 是否有未儲存的變更 */
  isDirty: boolean
  /** 設定 dirty 狀態 */
  setIsDirty: (dirty: boolean) => void
  /** 統計資訊 */
  stats: {
    chapterCount: number
    lessonCount: number
    freeLessonCount: number
    totalDuration: number
  }
}

const CourseEditorContext = createContext<CourseEditorContextValue | undefined>(
  undefined
)

interface CourseEditorProviderProps {
  children: ReactNode
  initialCourse: Course | null
  initialCurriculum: ChapterWithLessons[]
  initialSelectedLessonId?: string | null
}

export function CourseEditorProvider({
  children,
  initialCourse,
  initialCurriculum,
  initialSelectedLessonId = null,
}: CourseEditorProviderProps) {
  const [course, setCourse] = useState<Course | null>(initialCourse)
  const [curriculum, setCurriculum] =
    useState<ChapterWithLessons[]>(initialCurriculum)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialSelectedLessonId
  )
  const [isDirty, setIsDirty] = useState(false)

  // 當 Server Component 重新 render 傳入新資料時（如 router.refresh()），同步 curriculum
  useEffect(() => {
    setCurriculum(initialCurriculum)
  }, [initialCurriculum])

  // 計算選中的單元資料
  const selectedLesson = useMemo(() => {
    if (!selectedLessonId) return null
    for (const chapter of curriculum) {
      const lesson = chapter.lessons.find((l) => l.id === selectedLessonId)
      if (lesson) return lesson
    }
    return null
  }, [curriculum, selectedLessonId])

  // 計算統計資訊
  const stats = useMemo(() => {
    let lessonCount = 0
    let freeLessonCount = 0
    let totalDuration = 0

    for (const chapter of curriculum) {
      for (const lesson of chapter.lessons) {
        lessonCount++
        if (lesson.isFree) freeLessonCount++
        if (lesson.videoDuration) totalDuration += lesson.videoDuration
      }
    }

    return {
      chapterCount: curriculum.length,
      lessonCount,
      freeLessonCount,
      totalDuration,
    }
  }, [curriculum])

  // 樂觀更新單元資料
  const updateLessonInCurriculum = useCallback(
    (lessonId: string, updates: Partial<Lesson>) => {
      setCurriculum((prev) =>
        prev.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((lesson) =>
            lesson.id === lessonId ? { ...lesson, ...updates } : lesson
          ),
        }))
      )
    },
    []
  )

  const value: CourseEditorContextValue = {
    course,
    curriculum,
    selectedLessonId,
    selectedLesson,
    setSelectedLessonId,
    setCourse,
    setCurriculum,
    updateLessonInCurriculum,
    isDirty,
    setIsDirty,
    stats,
  }

  return (
    <CourseEditorContext.Provider value={value}>
      {children}
    </CourseEditorContext.Provider>
  )
}

export function useCourseEditor(): CourseEditorContextValue {
  const context = useContext(CourseEditorContext)
  if (context === undefined) {
    throw new Error(
      'useCourseEditor must be used within a CourseEditorProvider'
    )
  }
  return context
}
