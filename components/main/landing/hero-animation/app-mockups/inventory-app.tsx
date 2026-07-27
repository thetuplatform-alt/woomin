'use client'

import { useState, useEffect } from 'react'

// Inventory items data
const inventoryItems = [
  { name: '白米 (5公斤)', progress: 85, lastUpdated: '2 天前', emoji: '🍚' },
  { name: '橄欖油 (1公升)', progress: 45, lastUpdated: '5 天前', emoji: '🫒' },
  { name: '蜂蜜罐', progress: 20, lastUpdated: '1 天前', emoji: '🍯' },
]

const medicineItems = [
  { name: '維他命 C', progress: 60, lastUpdated: '3 天前', emoji: '💊' },
  { name: '急救箱', progress: 90, lastUpdated: '7 天前', emoji: '🩹' },
]

// Animation delay helper - distributes animations within 500ms
const getDelay = (index: number) => `${index * 50}ms`

export function InventoryApp() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation on mount
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#f6f7f8] text-[#0d141b]">
      {/* TopAppBar */}
      <div
        className={`sticky top-0 z-20 bg-white/80 backdrop-blur-md transition-all duration-300 ease-out ${
          isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
        style={{ transitionDelay: getDelay(0) }}
      >
        <div className="flex items-center justify-between p-3 pb-1.5">
          <div className="flex size-8 shrink-0 items-center text-[#0d141b]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="flex-1 text-center text-sm font-bold leading-tight tracking-tight text-[#0d141b]">庫存管理</h2>
          <div className="flex w-8 items-center justify-end">
            <button className="flex items-center justify-center text-[#137fec]">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
              </svg>
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="pb-0.5">
          <div className="flex gap-4 border-b border-[#cfdbe7] px-3">
            <a className="flex flex-col items-center justify-center border-b-2 border-[#137fec] pb-2 pt-2.5 text-[#137fec]" href="#">
              <p className="text-xs font-bold leading-normal tracking-wide">全部</p>
            </a>
            <a className="flex flex-col items-center justify-center border-b-2 border-transparent pb-2 pt-2.5 text-[#4c739a]" href="#">
              <p className="text-xs font-bold leading-normal tracking-wide">食品</p>
            </a>
            <a className="flex flex-col items-center justify-center border-b-2 border-transparent pb-2 pt-2.5 text-[#4c739a]" href="#">
              <p className="text-xs font-bold leading-normal tracking-wide">居家</p>
            </a>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-14">
        {/* ActionPanel: Summary */}
        <div
          className={`p-3 transition-all duration-300 ease-out ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
          style={{ transitionDelay: getDelay(1) }}
        >
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-bold leading-tight text-amber-900">5 項物品需要注意</p>
              <p className="text-xs font-normal leading-normal text-amber-800">庫存不足或 7 天內即將到期</p>
            </div>
            <a className="flex items-center gap-1 text-xs font-bold tracking-wide text-amber-900" href="#">
              查看
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>

        {/* Section: Pantry */}
        <div
          className={`flex items-center justify-between px-3 pb-1.5 pt-3 transition-all duration-300 ease-out ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
          style={{ transitionDelay: getDelay(2) }}
        >
          <h2 className="text-base font-bold leading-tight tracking-tight text-[#0d141b]">食品儲藏</h2>
          <span className="text-xs font-medium text-[#4c739a]">12 項物品</span>
        </div>

        {/* Pantry List Items */}
        <div className="flex flex-col">
          {inventoryItems.map((item, index) => (
            <div
              key={item.name}
              className={`flex min-h-[56px] items-center justify-between gap-3 border-b border-slate-100 bg-transparent px-3 py-2 transition-all duration-300 ease-out ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
              style={{ transitionDelay: getDelay(3 + index) }}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-lg">
                  {item.emoji}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="line-clamp-1 text-xs font-semibold leading-normal text-[#0d141b]">{item.name}</p>
                  <p className="text-xs font-normal leading-normal text-[#4c739a]">更新於 {item.lastUpdated}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-[#cfdbe7]">
                    <div
                      className="h-full rounded-full bg-[#137fec] transition-all duration-500 ease-out"
                      style={{ width: isVisible ? `${item.progress}%` : '0%', transitionDelay: getDelay(3 + index) }}
                    />
                  </div>
                  <p className="text-xs font-bold leading-normal text-[#0d141b]">{item.progress}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Section: Medicine Cabinet */}
        <div
          className={`flex items-center justify-between px-3 pb-1.5 pt-5 transition-all duration-300 ease-out ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
          style={{ transitionDelay: getDelay(6) }}
        >
          <h2 className="text-base font-bold leading-tight tracking-tight text-[#0d141b]">藥品櫃</h2>
          <span className="text-xs font-medium text-[#4c739a]">4 項物品</span>
        </div>

        {/* Medicine List Items */}
        <div className="flex flex-col">
          {medicineItems.map((item, index) => (
            <div
              key={item.name}
              className={`flex min-h-[56px] items-center justify-between gap-3 border-b border-slate-100 bg-transparent px-3 py-2 transition-all duration-300 ease-out ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
              style={{ transitionDelay: getDelay(7 + index) }}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-lg">
                  {item.emoji}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="line-clamp-1 text-xs font-semibold leading-normal text-[#0d141b]">{item.name}</p>
                  <p className="text-xs font-normal leading-normal text-[#4c739a]">更新於 {item.lastUpdated}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-[#cfdbe7]">
                    <div
                      className="h-full rounded-full bg-[#137fec] transition-all duration-500 ease-out"
                      style={{ width: isVisible ? `${item.progress}%` : '0%', transitionDelay: getDelay(7 + index) }}
                    />
                  </div>
                  <p className="text-xs font-bold leading-normal text-[#0d141b]">{item.progress}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-slate-200 bg-white/90 px-4 py-2 backdrop-blur-lg transition-all duration-300 ease-out ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
        style={{ transitionDelay: getDelay(9) }}
      >
        <div className="flex flex-col items-center gap-0.5 text-[#137fec]">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z" />
          </svg>
          <span className="text-xs font-bold">庫存</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-[#4c739a]">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
          </svg>
          <span className="text-xs font-bold">提醒</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-[#4c739a]">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
          <span className="text-xs font-bold">清單</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-[#4c739a]">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
          <span className="text-xs font-bold">設定</span>
        </div>
      </div>
    </div>
  )
}
