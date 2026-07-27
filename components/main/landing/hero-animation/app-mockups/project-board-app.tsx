'use client'

import { useState, useEffect } from 'react'

// Material icon SVG components
const GridViewIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z" />
  </svg>
)

const SearchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
)

const AutoplayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
  </svg>
)

const DragIndicatorIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
)

const AddIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
)

const DashboardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  </svg>
)

const AnalyticsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
  </svg>
)

const GroupsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58A2.01 2.01 0 0 0 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0 0 20 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z" />
  </svg>
)

const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
)

export function ProjectBoardApp() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Animation delay increments (total ~500ms)
  const delays = {
    header: 0,
    tabs: 50,
    sectionHeader: 100,
    card1: 150,
    card2: 250,
    completedSection: 350,
    fab: 400,
    nav: 450,
  }

  const getAnimationClass = (delay: number) => {
    if (!mounted) {
      return 'opacity-0 translate-y-4'
    }
    return 'opacity-100 translate-y-0'
  }

  const getAnimationStyle = (delay: number) => ({
    transitionProperty: 'opacity, transform',
    transitionDuration: '300ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDelay: `${delay}ms`,
  })

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#101922] text-slate-100">
      {/* TopAppBar */}
      <header
        className={`flex items-center justify-between border-b border-slate-800 bg-[#101922] p-4 pb-2 ${getAnimationClass(delays.header)}`}
        style={getAnimationStyle(delays.header)}
      >
        <div className="flex size-12 shrink-0 items-center justify-start">
          <span className="text-slate-400">
            <GridViewIcon />
          </span>
        </div>
        <h2 className="flex-1 text-center text-lg font-bold leading-tight tracking-[-0.015em]">
          專案看板
        </h2>
        <div className="flex w-12 items-center justify-end">
          <button className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-slate-800">
            <span className="text-slate-400">
              <SearchIcon />
            </span>
          </button>
        </div>
      </header>

      {/* Tabs / Column Nav */}
      <div
        className={`bg-[#101922] ${getAnimationClass(delays.tabs)}`}
        style={getAnimationStyle(delays.tabs)}
      >
        <div className="flex border-b border-slate-800 px-4">
          <a
            className="flex flex-1 flex-col items-center justify-center border-b-[3px] border-[#137fec] pb-[13px] pt-4 text-[#137fec]"
            href="#"
          >
            <p className="text-sm font-bold leading-normal tracking-[0.015em]">進行中</p>
          </a>
          <a
            className="flex flex-1 flex-col items-center justify-center border-b-[3px] border-transparent pb-[13px] pt-4 text-slate-400"
            href="#"
          >
            <p className="text-sm font-bold leading-normal tracking-[0.015em]">已完成</p>
          </a>
        </div>
      </div>

      {/* Kanban Board Area */}
      <main className="flex-1 space-y-6 overflow-y-auto bg-[#101922] p-4">
        {/* In Progress Column Section */}
        <section className="space-y-4">
          <div
            className={`flex items-center justify-between px-1 ${getAnimationClass(delays.sectionHeader)}`}
            style={getAnimationStyle(delays.sectionHeader)}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              進行中任務 (2)
            </h3>
            <span className="text-[#137fec]">
              <AutoplayIcon />
            </span>
          </div>

          {/* Card 1: Standard Active */}
          <div
            className={`${getAnimationClass(delays.card1)}`}
            style={getAnimationStyle(delays.card1)}
          >
            <div className="flex flex-col items-stretch justify-start overflow-hidden rounded-xl border border-slate-800 bg-[#192633] shadow-sm">
              {/* Image placeholder - gradient background */}
              <div
                className="aspect-[21/9] w-full bg-gradient-to-br from-[#137fec]/30 via-[#192633] to-[#0a1628]"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, rgba(19,127,236,0.3) 0%, rgba(25,38,51,1) 50%, rgba(10,22,40,1) 100%)',
                }}
              >
                <div className="flex h-full items-center justify-center">
                  <div className="flex gap-2">
                    <div className="h-8 w-12 rounded bg-slate-700/50" />
                    <div className="h-8 w-16 rounded bg-[#137fec]/30" />
                    <div className="h-8 w-10 rounded bg-slate-600/50" />
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-lg font-bold leading-tight tracking-tight">
                    資安稽核專案
                  </p>
                  <span className="rounded-full bg-[#137fec]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#137fec]">
                    優先
                  </span>
                </div>
                {/* ProgressBar Component */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-400">進度</p>
                    <p className="text-sm font-bold text-[#137fec]">65%</p>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-[#137fec]"
                      style={{
                        width: '65%',
                        boxShadow: '0 0 8px rgba(19,127,236,0.5)',
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border-l-2 border-[#137fec] bg-slate-800/50 p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-500">
                    客戶回饋
                  </p>
                  <p className="line-clamp-2 text-xs italic leading-relaxed text-slate-300">
                    「貓咪真可愛，初步掃描結果良好，正在進入網路階段。團隊反應非常迅速。」
                  </p>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {/* Avatar placeholders */}
                    <div className="size-6 overflow-hidden rounded-full border-2 border-[#192633] bg-gradient-to-br from-blue-400 to-blue-600" />
                    <div className="size-6 overflow-hidden rounded-full border-2 border-[#192633] bg-gradient-to-br from-purple-400 to-purple-600" />
                  </div>
                  <button className="flex items-center gap-1 text-sm font-semibold text-[#137fec]">
                    <span className="truncate">查看詳情</span>
                    <ChevronRightIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Dragged State Visual (Lifted) */}
          <div
            className={`-rotate-1 scale-[1.02] transform transition-transform duration-300 ${getAnimationClass(delays.card2)}`}
            style={{
              ...getAnimationStyle(delays.card2),
              boxShadow:
                '0 20px 25px -5px rgba(19, 127, 236, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div className="relative flex flex-col items-stretch justify-start overflow-hidden rounded-xl border-2 border-[#137fec] bg-[#1f2e3d]">
              {/* Glow effect for dragged card */}
              <div className="pointer-events-none absolute inset-0 bg-[#137fec]/5" />
              <div className="flex w-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-lg font-bold leading-tight tracking-tight">AI 整合專案</p>
                  <span className="text-[#137fec]">
                    <DragIndicatorIcon />
                  </span>
                </div>
                {/* Progress content */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-400">進度</p>
                    <p className="text-sm font-bold text-[#137fec]">40%</p>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-[#137fec]"
                      style={{
                        width: '40%',
                        boxShadow: '0 0 8px rgba(19,127,236,0.5)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Completed Column Section (Preview) */}
        <section
          className={`space-y-4 opacity-60 ${getAnimationClass(delays.completedSection)}`}
          style={getAnimationStyle(delays.completedSection)}
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              已完成 (3)
            </h3>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#192633]/50 p-4">
            <p className="text-sm text-slate-500 line-through">資料庫遷移</p>
          </div>
        </section>
      </main>

      {/* Bottom Action Button (Floating Style) */}
      <div
        className={`absolute bottom-20 right-4 ${getAnimationClass(delays.fab)}`}
        style={getAnimationStyle(delays.fab)}
      >
        <button
          className="flex size-14 items-center justify-center rounded-full bg-[#137fec] text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ boxShadow: '0 10px 25px rgba(19, 127, 236, 0.4)' }}
        >
          <AddIcon />
        </button>
      </div>

      {/* Navigation Placeholder (iOS Home Indicator Area) */}
      <nav
        className={`flex h-16 w-full items-center justify-around border-t border-slate-800 bg-[#111a22] pb-2 ${getAnimationClass(delays.nav)}`}
        style={getAnimationStyle(delays.nav)}
      >
        <button className="flex flex-col items-center gap-1 text-[#137fec]">
          <DashboardIcon />
          <span className="text-[10px] font-bold">看板</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <AnalyticsIcon />
          <span className="text-[10px] font-medium">統計</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <GroupsIcon />
          <span className="text-[10px] font-medium">團隊</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <SettingsIcon />
          <span className="text-[10px] font-medium">設定</span>
        </button>
      </nav>
    </div>
  )
}
