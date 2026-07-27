'use client'

import { useState, useEffect } from 'react'

// Resource card data
const resourceCards = [
  {
    id: 1,
    title: 'SaaS 與 AI 的未來',
    summary: 'AI 摘要指出，垂直型 SaaS 平台正在整合 LLM 來自動化利基工作流程...',
    tags: ['#saas', '#ai', '#科技'],
  },
  {
    id: 2,
    title: '大規模設計系統',
    summary: '領先企業如何在數百個產品中維持一致性...',
    tags: ['#設計', '#系統'],
  },
  {
    id: 3,
    title: 'ML 管線最佳實踐',
    summary: '建構穩健的生產環境機器學習管線的關鍵見解...',
    tags: ['#ml', '#工程'],
  },
  {
    id: 4,
    title: 'p5.js 創意程式設計',
    summary: '生成式藝術與創意程式設計基礎入門...',
    tags: ['#創意', '#程式'],
  },
]

const filterTags = ['全部', '閱讀', '設計', 'AI & ML', '工具']

// Glass card style object
const glassCardStyle: React.CSSProperties = {
  background: 'rgba(35, 54, 72, 0.4)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
}

export function KnowledgeHubApp() {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    // Small delay to ensure the component is mounted before triggering animation
    const timer = setTimeout(() => {
      setIsAnimating(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#101922] font-sans text-white">
      {/* Top Navigation Bar */}
      <header
        className="sticky top-0 z-50 bg-[#101922]/80 backdrop-blur-md"
        style={{
          opacity: isAnimating ? 1 : 0,
          transform: isAnimating ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
          transitionDelay: '0ms',
        }}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#278cf1]/20">
            <svg className="h-6 w-6 text-[#278cf1]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
            </svg>
          </div>
          <h1 className="ml-3 flex-1 text-lg font-bold leading-tight tracking-tight text-white">
            資源庫
          </h1>
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 transition-colors hover:bg-slate-800">
              <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z" />
              </svg>
            </button>
            {/* Avatar - using gradient instead of external image */}
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#278cf1] to-[#1a5fb4] ring-2 ring-[#278cf1]/30" />
          </div>
        </div>

        {/* Search Bar */}
        <div
          className="px-4 py-2"
          style={{
            opacity: isAnimating ? 1 : 0,
            transform: isAnimating ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
            transitionDelay: '50ms',
          }}
        >
          <label className="flex w-full flex-col">
            <div className="flex h-11 w-full items-stretch rounded-xl border border-slate-700 bg-slate-800/50">
              <div className="flex items-center justify-center pl-4 text-[#91adca]">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              </div>
              <input
                className="min-w-0 flex-1 border-none bg-transparent px-3 text-sm font-normal text-white placeholder:text-[#91adca] focus:outline-none focus:ring-0"
                placeholder="搜尋 AI 摘要資源"
                readOnly
              />
            </div>
          </label>
        </div>

        {/* Chips / Filter */}
        <div
          className="flex gap-2 overflow-x-auto px-4 py-3"
          style={{
            opacity: isAnimating ? 1 : 0,
            transform: isAnimating ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
            transitionDelay: '100ms',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {filterTags.map((tag, index) => (
            <div
              key={tag}
              className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-4 ${
                index === 0
                  ? 'bg-[#278cf1] shadow-lg shadow-[#278cf1]/20'
                  : 'bg-slate-800'
              }`}
            >
              <p
                className={`text-xs ${
                  index === 0 ? 'font-semibold text-white' : 'font-medium text-slate-300'
                }`}
              >
                {tag}
              </p>
            </div>
          ))}
        </div>
      </header>

      {/* Main Content: Masonry Grid */}
      <main className="flex-1 overflow-auto p-4">
        <div
          style={{
            columnCount: 2,
            columnGap: '0.75rem',
          }}
        >
          {resourceCards.map((card, index) => (
            <div
              key={card.id}
              className="flex flex-col overflow-hidden rounded-xl border-l-4 border-l-[#278cf1]/60 p-3"
              style={{
                ...glassCardStyle,
                breakInside: 'avoid',
                marginBottom: '0.75rem',
                opacity: isAnimating ? 1 : 0,
                transform: isAnimating ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.95)',
                transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
                transitionDelay: `${150 + index * 50}ms`,
              }}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800">
                  <svg className="h-3 w-3 text-[#278cf1]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                </div>
                <svg className="h-4 w-4 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-sm font-bold leading-tight text-white">{card.title}</h3>
              <p
                className="mb-3 text-[11px] leading-relaxed text-[#91adca]"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {card.summary}
              </p>
              <div className="mt-auto flex flex-wrap gap-1">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#278cf1]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#278cf1]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Action Button */}
      <div
        className="absolute bottom-16 right-3 z-50"
        style={{
          opacity: isAnimating ? 1 : 0,
          transform: isAnimating ? 'scale(1)' : 'scale(0.5)',
          transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
          transitionDelay: '400ms',
        }}
      >
        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[#278cf1] text-white shadow-xl shadow-[#278cf1]/30 transition-transform active:scale-95">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
      </div>

      {/* Bottom Navigation Bar (iOS Style) */}
      <nav
        className="z-40 flex items-center justify-between border-t border-white/10 px-6 py-2"
        style={{
          ...glassCardStyle,
          opacity: isAnimating ? 1 : 0,
          transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
          transitionDelay: '350ms',
        }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <svg className="h-5 w-5 text-[#278cf1]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" />
          </svg>
          <span className="text-[10px] font-bold text-[#278cf1]">格狀</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-slate-500">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z" />
          </svg>
          <span className="text-[10px]">探索</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-slate-500">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
          <span className="text-[10px]">動態</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-slate-500">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
          <span className="text-[10px]">設定</span>
        </div>
      </nav>
    </div>
  )
}
