// components/main/my-courses/continue-learning-card.tsx
// 繼續學習 Hero Card - 突出顯示最近觀觀的課程

'use client'

import Link from 'next/link'
import { PlayCircle, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { ContinueLearningData } from '@/lib/actions/my-courses'

interface ContinueLearningCardProps {
  data: ContinueLearningData
}

export function ContinueLearningCard({ data }: ContinueLearningCardProps) {
  const { course, lesson, progress } = data

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold text-heading">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cta/10">
            <PlayCircle className="h-5 w-5 text-cta" />
          </span>
          繼續學習
        </h2>
      </div>

      <Card className="overflow-hidden border-divider bg-white transition-all duration-300 hover:border-cta/30 hover:shadow-xl hover:shadow-cta/5">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row">
            {/* 封面圖片 */}
            <div className="relative aspect-video w-full overflow-hidden md:aspect-auto md:w-80 lg:w-[400px]">
              {course.coverImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={course.coverImage}
                  alt={course.title}
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface-hover">
                  <PlayCircle className="h-12 w-12 text-caption" />
                </div>
              )}
            </div>

            {/* 課程資訊 */}
            <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-surface-hover px-2 py-1 text-xs font-medium text-body">
                      最近觀看
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-heading sm:text-3xl">
                    {course.title}
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-body">目前進度</span>
                      <span className="font-bold text-cta">{progress.progressPercentage}%</span>
                    </div>
                    <Progress
                      value={progress.progressPercentage}
                      className="h-2 bg-surface-hover"
                      indicatorClassName="bg-cta"
                    />
                    <p className="text-xs text-caption">
                      已完成 {progress.completedLessons} / {progress.totalLessons} 單元
                    </p>
                  </div>

                  <div className="rounded-xl bg-surface p-4 border border-surface-hover">
                    <p className="text-xs font-medium uppercase tracking-wider text-caption">章節內容</p>
                    <p className="mt-1 font-semibold text-heading line-clamp-1">
                      {lesson.chapterTitle}: {lesson.title}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
                <Button
                  asChild
                  className="w-full rounded-full bg-cta px-8 py-6 text-base font-semibold text-white transition-all hover:bg-cta-hover hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
                >
                  <Link href={`/courses/${course.slug}/lessons/${lesson.id}`}>
                    繼續上課
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                
                <Link 
                  href={`/courses/${course.slug}`}
                  className="text-sm font-medium text-body transition-colors hover:text-heading"
                >
                  查看所有章節
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  )
}

