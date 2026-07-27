// components/main/landing/curriculum-preview.tsx
// 課程大綱預覽 — 從 course.chapters 動態生成
// 手機版：預設顯示 3 個，可展開
// 點擊「查看完整課程內容」會滾動到此區域並展開所有章節單元

'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  ArrowRight,
  ChevronDown,
  PlayCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CourseDetail } from '@/lib/actions/public-courses'

interface CurriculumPreviewProps {
  course: CourseDetail
}

export function CurriculumPreview({ course }: CurriculumPreviewProps) {
  const [expanded, setExpanded] = useState(false)
  const [showLessons, setShowLessons] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  const handleShowLessons = useCallback(() => {
    setExpanded(true)
    setShowLessons(true)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const chapters = course.chapters

  if (chapters.length === 0) return null

  return (
    <section className="bg-surface py-10 sm:py-14 lg:py-24" id="curriculum" ref={sectionRef}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 標題系統 */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-full bg-heading px-4 py-1.5 text-[10px] font-bold tracking-[0.2em] text-white uppercase"
          >
            Curriculum
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-2xl font-bold tracking-tight text-heading sm:text-3xl lg:text-5xl"
          >
            課程大綱
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-3 text-base text-body"
          >
            共 {chapters.length} 個章節，{course.lessonCount} 個單元
          </motion.p>
        </div>

        {/* 章節卡片 */}
        <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter, index) => (
            <motion.div
              key={chapter.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className={`group relative flex flex-col min-w-0 ${
                !expanded && index >= 3 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              {/* 裝飾編號 — 手機版隱藏 */}
              <div className="hidden sm:block text-5xl lg:text-6xl font-black text-divider -translate-y-1 transition-colors group-hover:text-cta/20">
                {String(index + 1).padStart(2, '0')}
              </div>

              <div className="sm:-mt-6 flex-1 rounded-2xl border border-divider bg-white p-5 sm:p-6 lg:p-8 transition-all hover:border-cta/40">
                <div className="flex items-center gap-3">
                  <span className="sm:hidden text-sm font-black text-divider">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-heading group-hover:bg-cta group-hover:text-white transition-colors">
                    <BookOpen className="h-4 w-4" />
                  </div>
                </div>

                <h3 className="mt-4 text-base font-bold text-heading">
                  {chapter.title}
                </h3>
                <p className="mt-1 text-sm text-caption">
                  {chapter.lessons.length} 個單元
                </p>

                {/* 展開的單元列表 */}
                <AnimatePresence>
                  {showLessons && chapter.lessons.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 border-t border-divider pt-4">
                        <ul className="space-y-1.5">
                          {chapter.lessons.map((lesson, lessonIdx) => (
                            <motion.li
                              key={lesson.id}
                              initial={{ opacity: 0, x: -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.3,
                                delay: lessonIdx * 0.05,
                                ease: [0.25, 0.1, 0.25, 1],
                              }}
                              className="flex items-center gap-2 text-sm text-body"
                            >
                              <PlayCircle className="h-3.5 w-3.5 shrink-0 text-[#D4D4D4]" />
                              <span className="truncate">{lesson.title}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 展開按鈕 — 手機版才顯示（未展開時） */}
        {!expanded && chapters.length > 3 && (
          <div className="mt-4 text-center sm:hidden">
            <button
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-cta hover:text-cta-hover transition-colors"
            >
              查看完整大綱
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 底部 CTA */}
        <div className="mt-6 sm:mt-10 text-center">
          {!showLessons ? (
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-divider px-8 py-6 text-base font-medium text-heading hover:bg-white"
              onClick={handleShowLessons}
            >
              查看完整課程內容
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-divider px-8 py-6 text-base font-medium text-heading hover:bg-white"
              onClick={() => setShowLessons(false)}
            >
              收合課程內容
              <ChevronDown className="ml-2 h-5 w-5 rotate-180" />
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
