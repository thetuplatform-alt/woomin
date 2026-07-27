// components/main/landing/free-course-cta.tsx
// 免費課程 CTA 按鈕組件
// Design System - 處理免費課程的加入邏輯

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowRight } from 'lucide-react'
import { enrollFreeCourse } from '@/lib/actions/free-course'

interface FreeCourseCTAProps {
  courseId: string
  courseSlug: string
  isLoggedIn: boolean
  className?: string
  size?: 'default' | 'lg'
}

export function FreeCourseCTA({
  courseId,
  courseSlug,
  isLoggedIn,
  className,
  size = 'lg',
}: FreeCourseCTAProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleEnroll = () => {
    setError(null)

    if (!isLoggedIn) {
      // 未登入：導向登入頁，帶上 enroll 參數
      const callbackUrl = `/courses/${courseSlug}?enroll=true`
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
      return
    }

    // 已登入：直接加入課程
    startTransition(async () => {
      const result = await enrollFreeCourse(courseId)

      if (result.success && result.firstLessonId) {
        // 成功：導向第一個單元
        router.push(`/courses/${courseSlug}/lessons/${result.firstLessonId}`)
      } else if (result.success) {
        // 成功但沒有單元：導向課程頁
        router.push(`/courses/${courseSlug}`)
        router.refresh()
      } else if (result.error) {
        setError(result.error)
      }
    })
  }

  const buttonClasses =
    size === 'lg'
      ? 'py-6 rounded-full bg-cta px-8! text-base font-semibold text-white transition-colors hover:bg-cta-hover'
      : 'rounded-full bg-cta px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-cta-hover'

  return (
    <div className={className}>
      <Button
        onClick={handleEnroll}
        disabled={isPending}
        size={size}
        className={buttonClasses}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加入中...
          </>
        ) : (
          <>
            免費加入課程
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
