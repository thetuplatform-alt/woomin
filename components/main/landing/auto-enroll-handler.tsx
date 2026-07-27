// components/main/landing/auto-enroll-handler.tsx
// 自動加入免費課程處理器
// 用於登入後自動加入免費課程的場景

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { enrollFreeCourse } from '@/lib/actions/free-course'

interface AutoEnrollHandlerProps {
  courseId: string
  courseSlug: string
}

export function AutoEnrollHandler({
  courseId,
  courseSlug,
}: AutoEnrollHandlerProps) {
  const router = useRouter()
  const hasEnrolled = useRef(false)

  useEffect(() => {
    // 防止重複執行
    if (hasEnrolled.current) return
    hasEnrolled.current = true

    const enroll = async () => {
      const result = await enrollFreeCourse(courseId)

      if (result.success && result.firstLessonId) {
        // 成功：導向第一個單元
        router.replace(`/courses/${courseSlug}/lessons/${result.firstLessonId}`)
      } else {
        // 失敗或沒有單元：清除 URL 參數並刷新
        router.replace(`/courses/${courseSlug}`)
      }
    }

    enroll()
  }, [courseId, courseSlug, router])

  // 不渲染任何 UI
  return null
}
