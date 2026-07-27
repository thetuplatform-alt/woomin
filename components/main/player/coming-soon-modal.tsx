// components/main/player/coming-soon-modal.tsx
// 製作中單元 Modal
// Design System - 無法關閉的 Modal，提示使用者內容正在製作中

'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Clock, ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AdjacentLessons } from '@/lib/actions/lesson'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ComingSoonModalProps {
  title: string
  description: string | null
  image: string | null
  expectedDate: Date | null
  adjacentLessons: AdjacentLessons
  courseSlug: string
}

export function ComingSoonModal({
  title,
  description,
  image,
  expectedDate,
  adjacentLessons,
  courseSlug,
}: ComingSoonModalProps) {
  const router = useRouter()

  // Format date for display
  const formattedDate = expectedDate
    ? format(new Date(expectedDate), 'yyyy 年 M 月 d 日', { locale: zhTW })
    : null

  // 是否為最後一個單元（沒有下一個單元）
  const isLastLesson = !adjacentLessons.next

  // Navigation handlers
  const handlePrevious = () => {
    if (adjacentLessons.previous) {
      router.push(`/courses/${courseSlug}/lessons/${adjacentLessons.previous.id}`)
    }
  }

  const handleNext = () => {
    if (adjacentLessons.next) {
      router.push(`/courses/${courseSlug}/lessons/${adjacentLessons.next.id}`)
    }
  }

  const handleCloseCourse = () => {
    router.push(`/courses/${courseSlug}`)
  }

  return (
    <>
      {/* Fixed Backdrop - Cannot be dismissed */}
      <div className="fixed inset-0 z-[100] bg-black/60" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed left-1/2 top-1/2 z-[101] w-[90%] max-w-lg -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative overflow-hidden rounded-2xl bg-white border border-divider">
          {/* Preview Image */}
          {image && (
            <div className="relative aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={title}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}

          {/* Content */}
          <div className="p-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-cta/10 px-4 py-1.5 text-sm font-semibold text-cta">
              <Clock className="h-4 w-4" />
              製作中
            </div>

            {/* Title */}
            <h2 className="mt-4 text-2xl font-bold text-heading">
              {title}
            </h2>

            {/* Expected Date */}
            {formattedDate && (
              <p className="mt-2 text-sm text-body">
                預計上線時間：{formattedDate}
              </p>
            )}

            {/* Description */}
            {description && (
              <p className="mt-4 text-body leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {adjacentLessons.previous && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="flex-1 rounded-full border-divider px-6 py-5 hover:bg-surface"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  回到上一單元
                </Button>
              )}

              {adjacentLessons.next ? (
                <Button
                  onClick={handleNext}
                  className="flex-1 rounded-full bg-cta px-6 py-5 text-white hover:bg-cta-hover"
                >
                  前往下一單元
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : isLastLesson && (
                <Button
                  onClick={handleCloseCourse}
                  className="flex-1 rounded-full bg-cta px-6 py-5 text-white hover:bg-cta-hover"
                >
                  <X className="mr-2 h-4 w-4" />
                  關閉課程
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
