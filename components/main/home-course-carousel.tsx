'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Layers,
  Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { calculatePrice, formatPrice } from '@/lib/utils/price'
import type { PublishedCourse } from '@/lib/actions/public-courses'
import { cn } from '@/lib/utils'

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return minutes > 0 ? `${hours} 小時 ${minutes} 分鐘` : `${hours} 小時`
  }
  return `${minutes} 分鐘`
}

export function HomeCourseCarousel({ courses }: { courses: PublishedCourse[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [loadedCoverIds, setLoadedCoverIds] = useState<Set<string>>(
    () => new Set()
  )
  const [failedCoverIds, setFailedCoverIds] = useState<Set<string>>(
    () => new Set()
  )
  const activeCourse = courses[activeIndex]
  const hasMultiple = courses.length > 1
  const shouldShowCover =
    Boolean(activeCourse?.coverImage) &&
    Boolean(activeCourse?.id) &&
    !failedCoverIds.has(activeCourse.id)
  const isCoverLoaded = Boolean(activeCourse?.id) && loadedCoverIds.has(activeCourse.id)

  const price = useMemo(() => {
    if (!activeCourse) return null
    return calculatePrice({
      originalPrice: activeCourse.price,
      salePrice: activeCourse.salePrice,
      saleEndAt: activeCourse.saleEndAt,
      saleLabel: activeCourse.saleLabel,
      saleCycleEnabled: activeCourse.saleCycleEnabled,
      saleCycleDays: activeCourse.saleCycleDays,
    })
  }, [activeCourse])

  useEffect(() => {
    if (!hasMultiple) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % courses.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [courses.length, hasMultiple])

  if (!activeCourse || !price) {
    return null
  }

  const goPrevious = () => {
    setActiveIndex((current) => (current - 1 + courses.length) % courses.length)
  }

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % courses.length)
  }

  return (
    <section className="border-b border-divider bg-white py-10 sm:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-h-[420px] items-center gap-10 lg:grid-cols-[1fr_520px]">
          <div className="max-w-2xl">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-heading px-3 py-1 text-xs font-bold tracking-wide text-white">
                精選課程
              </span>
              {price.isOnSale && (
                <span className="rounded-full bg-cta/10 px-3 py-1 text-xs font-bold text-cta">
                  {price.saleLabel}
                </span>
              )}
            </div>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-heading sm:text-5xl lg:text-6xl">
              {activeCourse.title}
            </h1>

            {(activeCourse.subtitle || activeCourse.description) && (
              <p className="mt-5 line-clamp-3 text-lg leading-8 text-body">
                {activeCourse.subtitle || activeCourse.description}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-4 text-sm font-medium text-caption">
              <span className="inline-flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {activeCourse.chapterCount} 章節
              </span>
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {activeCourse.lessonCount} 單元
              </span>
              {activeCourse.totalDuration > 0 && (
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatDuration(activeCourse.totalDuration)}
                </span>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-heading px-6 text-white hover:bg-heading/90"
              >
                <Link href={`/courses/${activeCourse.slug}`}>
                  <Play className="mr-2 h-4 w-4 fill-current" />
                  開始學習
                </Link>
              </Button>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-cta">
                  {formatPrice(price.finalPrice)}
                </span>
                {price.isOnSale && (
                  <span className="text-sm text-caption line-through">
                    {formatPrice(activeCourse.price)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <Link
              href={`/courses/${activeCourse.slug}`}
              className="group block overflow-hidden rounded-lg border border-divider bg-surface shadow-sm transition hover:border-cta/40 hover:shadow-xl hover:shadow-cta/5"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-hover">
                <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-surface">
                  <BookOpen className="h-16 w-16 text-caption/40" />
                </div>
                {shouldShowCover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${activeCourse.id}-${activeCourse.coverImage}`}
                    src={activeCourse.coverImage || ''}
                    alt={activeCourse.title}
                    className={cn(
                      'relative h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]',
                      isCoverLoaded ? 'opacity-100' : 'opacity-0'
                    )}
                    onLoad={() => {
                      setLoadedCoverIds((current) => {
                        const next = new Set(current)
                        next.add(activeCourse.id)
                        return next
                      })
                    }}
                    onError={() => {
                      setFailedCoverIds((current) => {
                        const next = new Set(current)
                        next.add(activeCourse.id)
                        return next
                      })
                    }}
                  />
                ) : null}
              </div>
            </Link>

            {hasMultiple && (
              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  {courses.map((course, index) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={cn(
                        'h-2.5 rounded-full transition-all',
                        index === activeIndex
                          ? 'w-8 bg-cta'
                          : 'w-2.5 bg-divider hover:bg-caption/50'
                      )}
                      aria-label={`切換到 ${course.title}`}
                    />
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={goPrevious}
                    className="h-10 w-10 rounded-full border-divider"
                    aria-label="上一門課"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={goNext}
                    className="h-10 w-10 rounded-full border-divider"
                    aria-label="下一門課"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
