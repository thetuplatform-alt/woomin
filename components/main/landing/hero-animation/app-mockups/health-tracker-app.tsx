'use client'

import { useState, useEffect } from 'react'

// Inline SVG icons to replace Material Symbols
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
)

const FlashlightIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M6 14l3 3v5h6v-5l3-3V9H6v5zm2-3h8v2.17l-3 3V20h-2v-3.83l-3-3V11zm3-9h2v3h-2V2zm5.24 2.34l1.41 1.41-2.12 2.12-1.41-1.41 2.12-2.12zM4.22 5.64l2.12 2.12-1.41 1.41-2.12-2.12 1.41-1.41z" />
  </svg>
)

const NutritionIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05l-5 2.18V3.86c0-.57-.35-1.08-.89-1.29l-2.27-.91c-.54-.22-1.14.17-1.14.76v3.51l-2.8-1.12c-.91-.36-1.9.24-1.9 1.2v6.88c0 .64.4 1.22 1 1.43l2.84 1.02v.68l-.63-.25c-.91-.37-1.91.24-1.91 1.2v3.87l4.78 1.9c.54.22 1.14-.17 1.14-.76v-2.56l1.42.57c.91.36 1.9-.24 1.9-1.2v-1.05l-3-1.2v.78l-1.58-.64v-3.87l3 1.2v6.11zM6 5c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm5 8.83v-1.91l-2-.8c-1.52-.61-3.03 1.09-2.29 2.56l1.29 2.57-1.28 2.57c-.74 1.47.77 3.17 2.29 2.56l2-.8v-1.91l-2 .8-.73-1.46 1.73-3.46-1.73-3.46.73-1.46 2 .8z" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
)

const VitalSignsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M19.5 5.5c-1.24-1.24-3.26-1.24-4.5 0l-2 2-2-2c-1.24-1.24-3.26-1.24-4.5 0s-1.24 3.26 0 4.5l6.5 6.5 6.5-6.5c1.24-1.24 1.24-3.26 0-4.5z" />
  </svg>
)

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
  </svg>
)

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
    <path d="M12 15.2c1.78 0 3.2-1.42 3.2-3.2S13.78 8.8 12 8.8 8.8 10.22 8.8 12s1.42 3.2 3.2 3.2zm0-8.4c2.87 0 5.2 2.33 5.2 5.2s-2.33 5.2-5.2 5.2-5.2-2.33-5.2-5.2 2.33-5.2 5.2-5.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z" />
  </svg>
)

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
  </svg>
)

export function HealthTrackerApp() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger animations on mount
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden font-sans">
      {/* Camera Viewport Background - CSS gradient to simulate salad */}
      <div
        className={`absolute inset-0 transition-all duration-300 ease-out ${
          mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        }`}
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 50% 45%, rgba(144, 238, 144, 0.9) 0%, transparent 70%),
            radial-gradient(ellipse 30% 20% at 30% 35%, rgba(255, 99, 71, 0.7) 0%, transparent 60%),
            radial-gradient(ellipse 25% 15% at 65% 55%, rgba(255, 215, 0, 0.6) 0%, transparent 55%),
            radial-gradient(ellipse 20% 12% at 45% 60%, rgba(255, 255, 255, 0.8) 0%, transparent 50%),
            radial-gradient(ellipse 35% 25% at 70% 40%, rgba(34, 139, 34, 0.8) 0%, transparent 60%),
            radial-gradient(ellipse 80% 80% at 50% 50%, rgba(139, 90, 43, 0.4) 0%, transparent 80%),
            linear-gradient(180deg, #5d4037 0%, #3e2723 100%)
          `,
        }}
      />

      {/* Top Navigation Overlay */}
      <div
        className={`absolute top-0 left-0 w-full p-4 pt-10 transition-all duration-300 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
        style={{
          transitionDelay: '80ms',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        }}
      >
        <div className="flex items-center justify-between">
          <button className="flex h-10 w-10 items-center justify-center rounded-full text-white backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <CloseIcon />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-bold leading-tight tracking-tight text-white">AI 食物掃描器</h2>
            <p className="text-xs font-medium uppercase tracking-widest text-white/80">健康同步已啟用</p>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full text-white backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <FlashlightIcon />
          </button>
        </div>
      </div>

      {/* Center Scanning Guide */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Circular Frame */}
          <div
            className={`flex h-72 w-72 items-center justify-center rounded-full border-2 border-white/40 transition-all duration-300 ease-out ${
              mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
            style={{
              transitionDelay: '150ms',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.3), 0 0 20px rgba(25,230,94,0.4)',
            }}
          >
            {/* Inner pulse ring */}
            <div
              className={`absolute inset-0 rounded-full border transition-opacity duration-300 ${
                mounted ? 'opacity-100 animate-pulse' : 'opacity-0'
              }`}
              style={{
                borderColor: 'rgba(25,230,94,0.4)',
                transitionDelay: '200ms',
              }}
            />
          </div>

          {/* Floating AI Tag - Right */}
          <div
            className={`absolute top-10 -right-24 transition-all duration-300 ease-out ${
              mounted ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 translate-x-4 translate-y-2'
            }`}
            style={{ transitionDelay: '250ms' }}
          >
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-white shadow-2xl backdrop-blur-xl"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderLeft: '4px solid #19e65e',
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(25,230,94,0.2)', color: '#19e65e' }}>
                <NutritionIcon />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-bold leading-tight">藜麥沙拉碗</p>
                <p className="text-[11px] font-bold" style={{ color: '#19e65e' }}>約 420 大卡 - 18g 蛋白質</p>
              </div>
            </div>
            {/* Indicator Line */}
            <div
              className="absolute -left-12 top-1/2 h-[1px] w-12"
              style={{ background: 'linear-gradient(to right, transparent, rgba(25,230,94,0.6))' }}
            />
          </div>

          {/* Secondary Tag - Left */}
          <div
            className={`absolute bottom-12 -left-32 transition-all duration-300 ease-out ${
              mounted ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 -translate-x-4 translate-y-2'
            }`}
            style={{ transitionDelay: '320ms' }}
          >
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-white/90 shadow-xl backdrop-blur-xl"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <CheckCircleIcon />
              <p className="text-xs font-medium">偵測到新鮮食材</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 w-full px-6 pb-10 transition-all duration-300 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{
          transitionDelay: '380ms',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.4), transparent)',
        }}
      >
        {/* Daily Progress Integration */}
        <div
          className="mb-8 rounded-2xl p-4 backdrop-blur-2xl"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ color: '#19e65e' }}>
                <VitalSignsIcon />
              </span>
              <p className="text-sm font-semibold tracking-tight text-white">每日進度</p>
            </div>
            <p className="text-xs font-medium text-white/60">1,420 / 2,100 大卡</p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: '68%', background: '#19e65e' }} />
          </div>
        </div>

        {/* Main Mode Selector */}
        <div className="mb-6 px-4 py-3">
          <div
            className="flex h-11 flex-1 items-center justify-center rounded-xl p-1 backdrop-blur-2xl"
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <label className="flex h-full grow cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white px-2 text-sm font-semibold leading-normal text-[#0e1b12] transition-all">
              <span className="truncate">AI 掃描</span>
            </label>
            <label className="flex h-full grow cursor-pointer items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-semibold leading-normal text-white/60 transition-all">
              <span className="truncate">手動輸入</span>
            </label>
          </div>
        </div>

        {/* Shutter Controls */}
        <div className="flex items-center justify-between px-4">
          <button
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white backdrop-blur-xl transition-transform active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <ImageIcon />
          </button>
          <div className="relative flex items-center justify-center">
            {/* Shutter Button Outer Ring */}
            <div className="absolute h-24 w-24 rounded-full border-2 border-white/30" />
            <button
              className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-black transition-transform active:scale-90"
              style={{
                background: '#19e65e',
                boxShadow: '0 0 30px rgba(25,230,94,0.4)',
              }}
            >
              <CameraIcon />
            </button>
          </div>
          <button
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white backdrop-blur-xl transition-transform active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <HistoryIcon />
          </button>
        </div>
        <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
          將食物置中即可自動記錄
        </p>
      </div>
    </div>
  )
}
