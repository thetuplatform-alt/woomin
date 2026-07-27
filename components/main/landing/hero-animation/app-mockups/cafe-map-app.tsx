'use client'

import { useState, useEffect } from 'react'

export function CafeMapApp() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger animations on mount
    setMounted(true)
  }, [])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden text-white">
      {/* Map Background with CSS gradient simulating map */}
      <div
        className={`absolute inset-0 z-0 transition-all duration-300 ease-out ${
          mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        }`}
        style={{ transitionDelay: '0ms' }}
      >
        {/* Base map gradient */}
        <div className="h-full w-full bg-gradient-to-br from-[#1a2e35] via-[#101f22] to-[#0d1a1c]">
          {/* Grid lines simulating map streets */}
          <div className="absolute inset-0">
            {/* Horizontal streets */}
            <div className="absolute left-0 top-[20%] h-[1px] w-full bg-[#2a4a52]/40" />
            <div className="absolute left-0 top-[35%] h-[2px] w-full bg-[#2a4a52]/60" />
            <div className="absolute left-0 top-[55%] h-[1px] w-full bg-[#2a4a52]/30" />
            <div className="absolute left-0 top-[75%] h-[1px] w-full bg-[#2a4a52]/50" />

            {/* Vertical streets */}
            <div className="absolute left-[15%] top-0 h-full w-[1px] bg-[#2a4a52]/30" />
            <div className="absolute left-[30%] top-0 h-full w-[2px] bg-[#2a4a52]/50" />
            <div className="absolute left-[50%] top-0 h-full w-[1px] bg-[#2a4a52]/40" />
            <div className="absolute left-[70%] top-0 h-full w-[1px] bg-[#2a4a52]/35" />
            <div className="absolute left-[85%] top-0 h-full w-[2px] bg-[#2a4a52]/45" />

            {/* Building blocks */}
            <div className="absolute left-[5%] top-[5%] h-[12%] w-[20%] rounded bg-[#1e363d]/60" />
            <div className="absolute left-[35%] top-[8%] h-[10%] w-[25%] rounded bg-[#1e363d]/50" />
            <div className="absolute left-[65%] top-[3%] h-[15%] w-[18%] rounded bg-[#1e363d]/55" />
            <div className="absolute left-[8%] top-[40%] h-[10%] w-[15%] rounded bg-[#1e363d]/45" />
            <div className="absolute left-[75%] top-[42%] h-[12%] w-[20%] rounded bg-[#1e363d]/50" />
            <div className="absolute left-[10%] top-[60%] h-[8%] w-[12%] rounded bg-[#1e363d]/40" />
            <div className="absolute left-[55%] top-[58%] h-[14%] w-[22%] rounded bg-[#1e363d]/55" />
          </div>
        </div>

        {/* Search Bar Floating */}
        <div
          className={`absolute left-0 top-8 z-20 w-full px-3 transition-all duration-200 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
          style={{ transitionDelay: '60ms' }}
        >
          <div className="flex h-9 w-full items-stretch rounded-xl shadow-2xl"
            style={{
              background: 'rgba(16, 31, 34, 0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="flex items-center justify-center pl-3 text-[#9db4b9]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl border-none bg-transparent pl-2 pr-3 text-xs font-normal leading-normal text-white placeholder:text-[#9db4b9] focus:border-none focus:outline-none focus:ring-0"
              placeholder="搜尋專注好去處..."
              readOnly
            />
          </div>
        </div>

        {/* Map Pin with bounce animation */}
        <div
          className={`absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 transition-all ease-out ${
            mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          }`}
          style={{
            transitionDuration: '250ms',
            transitionDelay: '150ms',
            transitionTimingFunction: mounted ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'ease-out',
          }}
        >
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-[#13c8ec]/40 blur-md" />
            <div className="relative rounded-full border-2 border-white bg-[#13c8ec] p-1.5 shadow-lg">
              <svg className="h-3 w-3 text-[#101f22]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 21V19H4V13C4 11.0667 4.58333 9.38333 5.75 7.95C6.91667 6.51667 8.33333 5.58333 10 5.15V4C10 3.45 10.1958 2.97917 10.5875 2.5875C10.9792 2.19583 11.45 2 12 2C12.55 2 13.0208 2.19583 13.4125 2.5875C13.8042 2.97917 14 3.45 14 4V5.15C15.6667 5.58333 17.0833 6.51667 18.25 7.95C19.4167 9.38333 20 11.0667 20 13V19H22V21H2ZM12 12C12.55 12 13.0208 11.8042 13.4125 11.4125C13.8042 11.0208 14 10.55 14 10C14 9.45 13.8042 8.97917 13.4125 8.5875C13.0208 8.19583 12.55 8 12 8C11.45 8 10.9792 8.19583 10.5875 8.5875C10.1958 8.97917 10 9.45 10 10C10 10.55 10.1958 11.0208 10.5875 11.4125C10.9792 11.8042 11.45 12 12 12Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Secondary map pins */}
        <div
          className={`absolute left-[25%] top-[30%] transition-all duration-200 ease-out ${
            mounted ? 'opacity-60 scale-100' : 'opacity-0 scale-0'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="h-2.5 w-2.5 rounded-full bg-[#13c8ec]/70 shadow-md" />
        </div>
        <div
          className={`absolute left-[70%] top-[35%] transition-all duration-200 ease-out ${
            mounted ? 'opacity-50 scale-100' : 'opacity-0 scale-0'
          }`}
          style={{ transitionDelay: '220ms' }}
        >
          <div className="h-2 w-2 rounded-full bg-white/50 shadow-md" />
        </div>
      </div>

      {/* Detail Overlay (Bottom Sheet) */}
      <div
        className={`relative z-10 mx-auto mt-auto w-full transition-all duration-200 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDelay: '280ms' }}
      >
        <div
          className="overflow-hidden rounded-t-[1.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          style={{
            background: 'rgba(16, 31, 34, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Bottom Sheet Handle */}
          <div className="flex w-full items-center justify-center py-2">
            <div className="h-1 w-8 rounded-full bg-white/20" />
          </div>

          {/* Header Image/Gallery - CSS gradient instead of image */}
          <div className="px-3 pb-1.5">
            <div
              className="flex min-h-[100px] flex-col justify-end overflow-hidden rounded-xl"
              style={{
                background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%),
                             linear-gradient(135deg, #2d4a52 0%, #1a363d 50%, #101f22 100%)`,
              }}
            >
              {/* Decorative interior elements */}
              <div className="absolute inset-0 overflow-hidden rounded-xl">
                <div className="absolute left-[10%] top-[20%] h-8 w-12 rounded bg-[#3d5a62]/30" />
                <div className="absolute right-[15%] top-[15%] h-6 w-8 rounded bg-[#3d5a62]/25" />
                <div className="absolute bottom-[40%] left-[40%] h-4 w-20 rounded bg-[#4a6870]/20" />
              </div>
              <div className="flex justify-center gap-1 p-2.5">
                <div className="h-1 w-1 rounded-full bg-white" />
                <div className="h-1 w-1 rounded-full bg-white/40" />
                <div className="h-1 w-1 rounded-full bg-white/40" />
                <div className="h-1 w-1 rounded-full bg-white/40" />
              </div>
            </div>
          </div>

          {/* Content Body */}
          <div className="px-4 pb-4 pt-2">
            <div className="mb-1.5 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-white">貓咪真可愛咖啡廳</h2>
                <p className="mt-0.5 text-[10px] text-white/60">台北市大安區忠孝東路四段 101 號</p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-0.5 text-[#13c8ec]">
                  <span className="text-xs font-bold">4.5</span>
                  <span className="text-[8px] text-white/40">/ 5</span>
                </div>
                <p className="text-[8px] font-semibold uppercase tracking-wider text-white/40">座位</p>
              </div>
            </div>

            {/* Tags / Chips */}
            <div className="flex flex-wrap gap-1.5 py-2">
              <div className="flex h-5 items-center justify-center gap-x-1 rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2">
                <div className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
                <p className="text-[8px] font-semibold uppercase tracking-wide text-emerald-400">營業中</p>
              </div>
              <div className="flex h-5 items-center justify-center gap-x-1 rounded-md border border-[#13c8ec]/30 bg-[#13c8ec]/20 px-2">
                <svg className="h-2.5 w-2.5 text-[#13c8ec]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 21H5C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H19C19.55 3 20.0208 3.19583 20.4125 3.5875C20.8042 3.97917 21 4.45 21 5V11H19V5H5V19H11V21ZM18 23V20H15V18H18V15H20V18H23V20H20V23H18Z" />
                </svg>
                <p className="text-[8px] font-semibold uppercase tracking-wide text-[#13c8ec]">插座</p>
              </div>
              <div className="flex h-5 items-center justify-center gap-x-1 rounded-md border border-white/10 bg-white/10 px-2">
                <svg className="h-2.5 w-2.5 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M1 9L3.4 13.4L7.8 14L4.4 17.3L5.1 21.7L1 19.6V9ZM23 9V19.6L18.9 21.7L19.6 17.3L16.2 14L20.6 13.4L23 9ZM12 2L16.5 6.5L12 11L7.5 6.5L12 2Z" />
                </svg>
                <p className="text-[8px] font-semibold uppercase tracking-wide text-white/70">WiFi</p>
              </div>
            </div>

            {/* Availability Visualization */}
            <div className="mt-2 rounded-lg border border-white/5 bg-white/5 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium text-white/80">目前座位</span>
                <span className="text-[10px] font-bold text-[#13c8ec]">已滿 85%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#13c8ec]" style={{ width: '85%' }} />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[9px] text-white/40">
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 17H13V11H11V17ZM12 9C12.2833 9 12.5208 8.90417 12.7125 8.7125C12.9042 8.52083 13 8.28333 13 8C13 7.71667 12.9042 7.47917 12.7125 7.2875C12.5208 7.09583 12.2833 7 12 7C11.7167 7 11.4792 7.09583 11.2875 7.2875C11.0958 7.47917 11 7.71667 11 8C11 8.28333 11.0958 8.52083 11.2875 8.7125C11.4792 8.90417 11.7167 9 12 9ZM12 22C10.6167 22 9.31667 21.7375 8.1 21.2125C6.88333 20.6875 5.825 19.975 4.925 19.075C4.025 18.175 3.3125 17.1167 2.7875 15.9C2.2625 14.6833 2 13.3833 2 12C2 10.6167 2.2625 9.31667 2.7875 8.1C3.3125 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.3125 8.1 2.7875C9.31667 2.2625 10.6167 2 12 2C13.3833 2 14.6833 2.2625 15.9 2.7875C17.1167 3.3125 18.175 4.025 19.075 4.925C19.975 5.825 20.6875 6.88333 21.2125 8.1C21.7375 9.31667 22 10.6167 22 12C22 13.3833 21.7375 14.6833 21.2125 15.9C20.6875 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6875 15.9 21.2125C14.6833 21.7375 13.3833 22 12 22Z" />
                </svg>
                可能找到單人座位。
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-3 flex gap-2">
              <button className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#13c8ec] font-bold text-[#101f22] shadow-lg shadow-[#13c8ec]/20 transition-transform active:scale-95">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.00002 21V11.4L4.55002 12.4L3.45002 10.8L12 5L20.55 10.8L19.45 12.4L18 11.4V21H6.00002ZM12 8.25L8.00002 11.15V19H11V14H13V19H16V11.15L12 8.25ZM12 14Z" />
                </svg>
                <span className="text-[10px]">導航</span>
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white transition-transform active:scale-95">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Zoom Controls */}
      <div
        className={`absolute right-2 top-1/3 z-10 flex -translate-y-1/2 flex-col gap-1.5 transition-all duration-200 ease-out ${
          mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        }`}
        style={{ transitionDelay: '400ms' }}
      >
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white shadow-xl"
          style={{
            background: 'rgba(16, 31, 34, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white shadow-xl"
          style={{
            background: 'rgba(16, 31, 34, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg border border-[#13c8ec]/20 text-[#13c8ec] shadow-xl"
          style={{
            background: 'rgba(16, 31, 34, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
