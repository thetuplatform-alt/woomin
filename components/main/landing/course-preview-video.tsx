// components/main/landing/course-preview-video.tsx
// 講師承諾影片區塊 — 雙欄佈局：左側大圓角影片 + 右側承諾文案
// 嵌入 InstructorSection 內，強化講師信任感

'use client'

import { Play, Volume2 } from 'lucide-react'
import { useState, useRef } from 'react'
import Image from 'next/image'

interface CoursePreviewVideoProps {
  videoId?: string
}

export function CoursePreviewVideo({
  videoId = '9GCnDe-Td00',
}: CoursePreviewVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
      {/* 左側：大圓角影片 */}
      <div className="lg:w-[55%]">
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-divider">
          <div className="relative aspect-video w-full">
            {!isPlaying ? (
              <button
                onClick={() => setIsPlaying(true)}
                className="group relative block h-full w-full cursor-pointer"
                aria-label="播放課程試看影片"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/youtube-preview.png"
                  alt="課程試看影片縮圖"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 560px"
                />
                {/* 淺色遮罩 — 保持明亮感 */}
                <div className="absolute inset-0 bg-white/10 transition-colors duration-300 group-hover:bg-white/5" />
                {/* 播放按鈕 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316] shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-[#F97316]/30 sm:h-20 sm:w-20">
                    <Play className="ml-1 h-7 w-7 fill-white text-white sm:h-8 sm:w-8" />
                  </div>
                  <span className="rounded-full bg-black/50 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    <Volume2 className="mr-1.5 inline-block h-3 w-3" />
                    點擊播放，聽聽講師怎麼說
                  </span>
                </div>
              </button>
            ) : (
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&start=0`}
                title="課程入門試看影片"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            )}
          </div>
        </div>
      </div>

      {/* 右側：講師承諾文案 */}
      <div className="flex-1 lg:w-[45%]">
        <h3 className="text-xl font-bold leading-snug text-heading sm:text-2xl lg:text-[1.7rem]">
          從零開始，一路到上架變現，
          <br />
          <span className="text-[#F97316]">我都在旁邊。</span>
        </h3>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-body">
          <p>
            這堂課沒有廢話。在接下來的 2.5 小時裡，我會一步步帶你從
            AI 企劃、設計、開發，一路走到實機部署與 App Store 上架。
          </p>
          <p>
            很多線上課程買了遇到問題就無助可問，但這堂課不一樣 ——
            <span className="font-semibold text-heading">
              有任何問題，你隨時可以在專屬社群找到我，甚至與我約 1 on 1。
            </span>
          </p>
          <p>
            我會陪你從零開始，直到看見你的 App 成功出現在 App Store 上。
          </p>
        </div>

        {/* 簽名 */}
        <div className="mt-8 flex items-center gap-4">
          <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-[#F97316]/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fish.png"
              alt="Fish"
              width={48}
              height={48}
              className="h-full w-full object-cover object-[0_-4px]"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-heading">
              Fish（余啟彰）
            </p>
            <p className="text-xs text-caption">
              把複雜工具拆成你能上手的流程
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
