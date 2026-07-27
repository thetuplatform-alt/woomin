'use client'

import { useState, useEffect } from 'react'

export function StockTrackerApp() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Animation classes with staggered delays
  const getAnimationClass = (delay: number) => {
    const baseClass = 'transition-all duration-150 ease-out'
    if (!mounted) {
      return `${baseClass} opacity-0 translate-y-3 blur-[2px] scale-95`
    }
    return `${baseClass} opacity-100 translate-y-0 blur-0 scale-100`
  }

  const getAnimationStyle = (delay: number) => ({
    transitionDelay: mounted ? `${delay}ms` : '0ms',
  })

  return (
    <div className="flex h-full w-full flex-col bg-[#05070a] text-white overflow-hidden">
      {/* Top Navigation Bar */}
      <div
        className={getAnimationClass(0)}
        style={getAnimationStyle(0)}
      >
        <div className="sticky top-0 z-50 flex items-center bg-[#05070a]/80 backdrop-blur-md p-4 pb-2 justify-between">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#101522] border border-[#D4AF37]/20">
            <div className="rounded-full size-8 bg-gradient-to-br from-[#D4AF37]/40 to-[#B8860B]/40 flex items-center justify-center">
              <svg className="size-4 text-[#D4AF37]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center">投資組合</h2>
          <div className="flex w-10 items-center justify-end">
            <button className="flex cursor-pointer items-center justify-center rounded-lg h-10 w-10 bg-transparent text-white">
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-20">
        {/* Hero: Total Net Worth */}
        <div
          className={`p-4 ${getAnimationClass(80)}`}
          style={getAnimationStyle(80)}
        >
          <div className="flex flex-col gap-1 rounded-xl p-6 bg-[#101522] border border-[#D4AF37]/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <svg className="size-16 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">總資產淨值</p>
            <p className="bg-gradient-to-r from-[#D4AF37] via-[#F9E29C] to-[#B8860B] bg-clip-text text-transparent tracking-tight text-4xl font-extrabold leading-tight">NT$4,528,600</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center bg-green-500/10 px-2 py-1 rounded text-[#0bda62] text-sm font-bold">
                <svg className="size-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
                +NT$392,800
              </div>
              <p className="text-[#0bda62] text-sm font-medium leading-normal">(+10.2%)</p>
            </div>
          </div>
        </div>

        {/* Segmented Control for Timeframe */}
        <div
          className={`px-4 py-2 ${getAnimationClass(120)}`}
          style={getAnimationStyle(120)}
        >
          <div className="flex h-11 items-center justify-center rounded-xl bg-[#101522] p-1 border border-[#D4AF37]/20">
            {['1D', '1W', '1M', '1Y', 'ALL'].map((period, index) => (
              <label
                key={period}
                className={`flex cursor-pointer h-full grow items-center justify-center rounded-lg px-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  period === '1M'
                    ? 'bg-[#2b5bee] text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span>{period}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Performance Chart */}
        <div
          className={`px-4 py-4 ${getAnimationClass(160)}`}
          style={getAnimationStyle(160)}
        >
          <div className="flex flex-col gap-2 bg-[#101522] rounded-xl p-4 border border-[#D4AF37]/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium">績效表現</p>
                <p className="text-white text-2xl font-bold">2026 年 1 月</p>
              </div>
              <div className="text-right">
                <p className="text-[#0bda62] text-sm font-bold">+11.4%</p>
                <p className="text-gray-500 text-xs">月成長率</p>
              </div>
            </div>
            <div className="flex min-h-[160px] flex-1 flex-col gap-4 py-2">
              <svg
                fill="none"
                height="120"
                preserveAspectRatio="none"
                viewBox="0 0 400 120"
                width="100%"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient gradientUnits="userSpaceOnUse" id="chart_grad" x1="200" x2="200" y1="10" y2="120">
                    <stop stopColor="#2b5bee" stopOpacity="0.3" />
                    <stop offset="1" stopColor="#2b5bee" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 100C40 90 60 20 100 30C140 40 160 80 200 70C240 60 260 10 300 20C340 30 360 90 400 80V120H0V100Z"
                  fill="url(#chart_grad)"
                />
                <path
                  d="M0 100C40 90 60 20 100 30C140 40 160 80 200 70C240 60 260 10 300 20C340 30 360 90 400 80"
                  stroke="#2b5bee"
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              </svg>
              <div className="flex justify-between">
                <p className="text-gray-500 text-[10px] font-bold uppercase">01 Jun</p>
                <p className="text-gray-500 text-[10px] font-bold uppercase">15 Jun</p>
                <p className="text-gray-500 text-[10px] font-bold uppercase">30 Jun</p>
              </div>
            </div>
          </div>
        </div>

        {/* 產業配置 */}
        <div
          className={`px-4 py-4 ${getAnimationClass(200)}`}
          style={getAnimationStyle(200)}
        >
          <h2 className="text-white text-lg font-bold leading-tight tracking-tight mb-4 flex items-center gap-2">
            <svg className="size-5 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z"/>
            </svg>
            產業配置
          </h2>
          <div className="bg-[#101522] rounded-xl p-6 border border-[#D4AF37]/20 flex flex-col items-center gap-6">
            <div className="relative flex items-center justify-center">
              {/* Circular Progress Visual */}
              <svg className="size-48 transform -rotate-90">
                <circle
                  className="text-gray-800"
                  cx="96"
                  cy="96"
                  fill="transparent"
                  r="80"
                  stroke="currentColor"
                  strokeWidth="12"
                />
                <circle
                  className="text-[#2b5bee]"
                  cx="96"
                  cy="96"
                  fill="transparent"
                  r="80"
                  stroke="currentColor"
                  strokeDasharray="502.6"
                  strokeDashoffset="150"
                  strokeWidth="12"
                />
                <circle
                  className="text-[#D4AF37]"
                  cx="96"
                  cy="96"
                  fill="transparent"
                  r="80"
                  stroke="currentColor"
                  strokeDasharray="502.6"
                  strokeDashoffset="400"
                  strokeWidth="12"
                />
                <circle
                  className="text-purple-500"
                  cx="96"
                  cy="96"
                  fill="transparent"
                  r="80"
                  stroke="currentColor"
                  strokeDasharray="502.6"
                  strokeDashoffset="460"
                  strokeWidth="12"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <p className="text-gray-400 text-xs font-medium uppercase">主要產業</p>
                <p className="text-white text-xl font-bold">科技類股</p>
                <p className="text-[#D4AF37] font-bold">42%</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-[#2b5bee]" />
                <p className="text-gray-300 text-xs">科技類</p>
                <p className="text-white text-xs font-bold ml-auto">42%</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-[#D4AF37]" />
                <p className="text-gray-300 text-xs">金融類</p>
                <p className="text-white text-xs font-bold ml-auto">28%</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-purple-500" />
                <p className="text-gray-300 text-xs">能源類</p>
                <p className="text-white text-xs font-bold ml-auto">18%</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-gray-500" />
                <p className="text-gray-300 text-xs">消費類</p>
                <p className="text-white text-xs font-bold ml-auto">12%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Holdings */}
        <div className="px-4 py-4 mb-4">
          <div
            className={`flex items-center justify-between mb-4 ${getAnimationClass(240)}`}
            style={getAnimationStyle(240)}
          >
            <h2 className="text-white text-lg font-bold leading-tight tracking-tight flex items-center gap-2">
              <svg className="size-5 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
              </svg>
              持股明細
            </h2>
            <button className="text-[#2b5bee] text-xs font-bold uppercase tracking-wider">查看全部</button>
          </div>
          <div className="flex flex-col gap-3">
            {/* Stock Row - TSLA */}
            <div
              className={`flex items-center gap-3 bg-[#101522] p-4 rounded-xl border border-[#D4AF37]/20 ${getAnimationClass(280)}`}
              style={getAnimationStyle(280)}
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/5">
                <svg className="size-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
                </svg>
              </div>
              <div className="flex flex-col flex-1">
                <p className="text-white text-sm font-bold">2330</p>
                <p className="text-gray-500 text-[10px] font-medium uppercase">台積電</p>
              </div>
              <div className="w-16 h-8">
                <svg className="w-full h-full" viewBox="0 0 100 40">
                  <path d="M0 35 L20 25 L40 30 L60 10 L80 15 L100 5" fill="none" stroke="#0bda62" strokeWidth="2" />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <p className="text-white text-sm font-bold">NT$985</p>
                <p className="text-[#0bda62] text-[10px] font-bold">+2.4%</p>
              </div>
            </div>

            {/* Stock Row - AAPL */}
            <div
              className={`flex items-center gap-3 bg-[#101522] p-4 rounded-xl border border-[#D4AF37]/20 ${getAnimationClass(320)}`}
              style={getAnimationStyle(320)}
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/5">
                <svg className="size-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <div className="flex flex-col flex-1">
                <p className="text-white text-sm font-bold">2317</p>
                <p className="text-gray-500 text-[10px] font-medium uppercase">鴻海</p>
              </div>
              <div className="w-16 h-8">
                <svg className="w-full h-full" viewBox="0 0 100 40">
                  <path d="M0 30 L25 20 L50 25 L75 15 L100 10" fill="none" stroke="#0bda62" strokeWidth="2" />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <p className="text-white text-sm font-bold">NT$178</p>
                <p className="text-[#0bda62] text-[10px] font-bold">+1.2%</p>
              </div>
            </div>

            {/* Stock Row - NVDA */}
            <div
              className={`flex items-center gap-3 bg-[#101522] p-4 rounded-xl border border-[#D4AF37]/20 ${getAnimationClass(360)}`}
              style={getAnimationStyle(360)}
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/5">
                <svg className="size-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="flex flex-col flex-1">
                <p className="text-white text-sm font-bold">2454</p>
                <p className="text-gray-500 text-[10px] font-medium uppercase">聯發科</p>
              </div>
              <div className="w-16 h-8">
                <svg className="w-full h-full" viewBox="0 0 100 40">
                  <path d="M0 15 L25 20 L50 10 L75 25 L100 20" fill="none" stroke="#ef4444" strokeWidth="2" />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <p className="text-white text-sm font-bold">NT$1,285</p>
                <p className="text-red-500 text-[10px] font-bold">-0.8%</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Navigation Bar (iOS style) */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-[#101522]/95 backdrop-blur-xl border-t border-white/5 pb-6 pt-2 px-4 ${getAnimationClass(400)}`}
        style={getAnimationStyle(400)}
      >
        <div className="flex justify-between items-center">
          <button className="flex flex-col items-center gap-1 text-[#2b5bee]">
            <svg className="size-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-tighter">首頁</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-500">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-tighter">行情</span>
          </button>
          <div className="relative -top-6">
            <button className="size-14 bg-[#2b5bee] rounded-full shadow-lg shadow-[#2b5bee]/40 flex items-center justify-center text-white border-4 border-[#05070a]">
              <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <button className="flex flex-col items-center gap-1 text-gray-500">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-tighter">資產</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-500">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-tighter">更多</span>
          </button>
        </div>
      </div>
    </div>
  )
}
