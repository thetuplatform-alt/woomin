// components/main/landing/testimonial-section.tsx
// 學員見證區塊
// 雙排無限滾動瀑布流 + 實體課照片

'use client'

import { Star, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface Testimonial {
  id: string
  content: string
  image?: string
  imageAlt?: string
  type: 'survey' | 'interview'
}

// 第一排：訪談 2 張 + 問卷 2 張
const topRow: Testimonial[] = [
  {
    id: 'interview-1',
    content:
      '我有一個想做的 App 點子已經超過半年了，今天終於成功把這個專屬的 iPhone App 做出來！說真的，能有這樣的成果，我覺得這堂課的定價真的太便宜了！',
    type: 'interview',
    image: '/實機畫面1.png',
    imageAlt: '學員實機展示自己開發的 iPhone App',
  },
  {
    id: 'interview-2',
    content:
      '在這堂課的收穫不只是學到一項技能，對我來說更像是實現了自己的想法！我完全不用花費大量時間去死記硬背程式碼，就真的只是把自己的想法告訴 AI，省下了我獨自盲目摸索的時間，這真的超棒！',
    type: 'interview',
    image: '/實機畫面2.png',
    imageAlt: '學員展示用 AI 輔助開發的 App 筆記功能',
  },
  {
    id: '#013',
    content:
      '中文系畢業，對程式碼完全是外星語。但課程用說故事的方式帶入每個概念，讓我這個純文科腦也能跟上，最後真的做出了一個閱讀筆記 App。',
    type: 'survey',
  },
  {
    id: '#001',
    content:
      '真的屌到不行，我腦海中半年的想像，只花不到半天就落地實現了！以前覺得做 App 是工程師的事，現在覺得是任何人的事。',
    type: 'survey',
  },
]

// 第二排：訪談 2 張 + 問卷 2 張
const bottomRow: Testimonial[] = [
  {
    id: 'interview-3',
    content:
      '這堂課最棒的地方，不只是看著講師怎麼解決單一問題，而是帶著我們從頭到尾、完整經歷了一遍真實開發的過程。搭配上課程中分享的眾多實用工具，對學習非常有幫助！',
    type: 'interview',
    image: '/實際訪談1.png',
    imageAlt: '學員實際訪談現場照片',
  },
  {
    id: 'interview-4',
    content:
      '就是真的是一步一步實際操作就可以生出來，感謝打破這個有點被神化（？）的一件事情。然後 AntiGravity 真的好強！',
    type: 'interview',
  },
  {
    id: '#007',
    content:
      '很適合 Vibe Coding 入門，讓不懂程式的人也能輕鬆理解。整個流程拆解得很清楚，跟著走就對了，不用擔心會迷路。',
    type: 'survey',
  },
  {
    id: '#002',
    content:
      '程式小白能夠做出解決問題的 App，簡直奇蹟。之前連 HTML 都沒碰過，現在居然可以把東西裝到自己手機上，感謝 Fish！',
    type: 'survey',
  },
]

function GoogleFormsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
        fill="#7248B9"
      />
      <path d="M14 2V8H20L14 2Z" fill="#B39ADC" />
      <circle cx="9" cy="11.5" r="1" fill="white" />
      <circle cx="9" cy="14.5" r="1" fill="white" />
      <circle cx="9" cy="17.5" r="1" fill="white" />
      <rect x="11.5" y="11" width="5" height="1" rx="0.5" fill="white" />
      <rect x="11.5" y="14" width="5" height="1" rx="0.5" fill="white" />
      <rect x="11.5" y="17" width="5" height="1" rx="0.5" fill="white" />
    </svg>
  )
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const isInterview = testimonial.type === 'interview'

  return (
    <div className={`relative w-[280px] sm:w-[340px] shrink-0 flex flex-col rounded-2xl border border-divider bg-white p-4 sm:p-5 transition-all hover:border-cta/40 hover:shadow-lg hover:shadow-cta/5 overflow-visible ${testimonial.image ? 'pb-14 sm:pb-16' : ''}`}>
      {/* 上方：星星 */}
      <div className="flex items-center mb-4">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className="h-3.5 w-3.5 fill-cta text-cta"
            />
          ))}
        </div>
      </div>

      {/* 內容 */}
      <p className="flex-1 text-sm leading-relaxed text-body">
        {testimonial.content}
      </p>

      {/* 懸浮圖片 — 偏移右下角（訪談卡片） */}
      {testimonial.image && (
        <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 w-[120px] sm:w-[160px] rounded-xl overflow-hidden shadow-lg ring-2 ring-white pointer-events-none select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={testimonial.image}
            alt={testimonial.imageAlt || '學員作品'}
            width={320}
            height={240}
            className="w-full h-auto object-cover"
          />
        </div>
      )}

      {/* 右上角標籤 */}
      {isInterview ? (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 pointer-events-none select-none">
          <p className="text-[10px] text-caption whitespace-nowrap">
            線下 Workspace 學員真實回饋
          </p>
        </div>
      ) : (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 pointer-events-none select-none">
          <GoogleFormsIcon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
      )}
    </div>
  )
}

function ScrollingRow({
  items,
  duration = 50,
}: {
  items: Testimonial[]
  duration?: number
}) {
  const duplicated = [...items, ...items, ...items]

  return (
    <div className="relative py-6">
      {/* 左右漸層遮罩 */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden sm:block w-32 bg-linear-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden sm:block w-32 bg-linear-to-l from-surface to-transparent" />

      <div
        className="flex gap-6 sm:gap-10 w-max animate-marquee"
        style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
      >
        {duplicated.map((testimonial, index) => (
          <TestimonialCard
            key={`${testimonial.id}-${index}`}
            testimonial={testimonial}
          />
        ))}
      </div>
    </div>
  )
}

interface TestimonialSectionProps {
  courseId?: string
}

export function TestimonialSection({ courseId }: TestimonialSectionProps) {
  return (
    <section className="bg-surface py-10 sm:py-14 lg:py-24 overflow-x-clip">
      {/* 標題 */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            Student Feedback
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-2xl font-bold text-heading sm:text-3xl lg:text-4xl"
          >
            他們跟你一樣，從零開始
          </motion.h2>
        </div>
      </div>

      {/* 雙排無限滾動 */}
      <div className="mt-6 sm:mt-10 space-y-2 sm:space-y-4">
        <ScrollingRow items={topRow} duration={50} />
        <ScrollingRow items={bottomRow} duration={55} />
      </div>

      {/* CTA + 實體課照片 */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {courseId && (
          <div className="mt-6 text-center">
            <Link
              href={`/checkout?courseId=${courseId}`}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-cta hover:text-cta-hover transition-colors"
            >
              加入 500+ 學員的行列
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* 實體課照片 */}
        <div className="mt-6 sm:mt-8 grid gap-3 sm:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/class-photo-1.jpg"
              alt="iOS Vibe Coding 實體課程現場 - 學員實作 AI 開發"
              width={800}
              height={600}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/class-photo-2.jpg"
              alt="iOS Vibe Coding 課程教學現場 - 講師 Fish 指導學員"
              width={800}
              height={600}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-caption">
          所有回饋皆來自課後匿名問卷與實際訪談的真實回饋
        </p>
      </div>
    </section>
  )
}
