// components/main/player/toc-drawer.tsx
'use client'

import React, { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Hash } from 'lucide-react'

interface TOCItem {
  id: string
  text: string
  level: number
}

interface TOCDrawerProps {
  content: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TOCDrawer({ content, open, onOpenChange }: TOCDrawerProps) {
  const [headings, setHeadings] = useState<TOCItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (!content) return

    // 解析 Markdown 標題 (簡單 regex 版本)
    const headingRegex = /^(#{1,3})\s+(.+)$/gm
    const items: TOCItem[] = []
    let match

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length
      const text = match[2].trim()
      // 這裡假設 Slugify 邏輯與你的 Markdown 渲染器一致
      // 大多數渲染器會把標題轉成 ID，例如 "My Heading" -> "my-heading"
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')

      items.push({ id, text, level })
    }

    setHeadings(items)
  }, [content])

  // 監聽滾動以更新目前所在的標題
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-100px 0px -70% 0px' }
    )

    const elements = document.querySelectorAll('h1[id], h2[id], h3[id]')
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [headings, open])

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      // 判斷是否為手機版且有 Sticky 影片
      const isMobile = window.innerWidth < 768
      const videoElement = document.querySelector('section.sticky')
      const videoHeight = videoElement ? videoElement.getBoundingClientRect().height : 0
      
      const offset = isMobile ? videoHeight + 10 : 80 
      const bodyRect = document.body.getBoundingClientRect().top
      const elementRect = element.getBoundingClientRect().top
      const elementPosition = elementRect - bodyRect
      const offsetPosition = elementPosition - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[60vh] rounded-t-[32px] border-t border-white/10 bg-[#121212] p-0 sm:h-[50vh]"
      >
        <div className="mx-auto flex h-1.5 w-12 shrink-0 rounded-full bg-white/20 my-4" />
        
        <SheetHeader className="px-6 pb-2">
          <SheetTitle className="text-white text-lg font-bold flex items-center gap-2">
            <Hash className="h-5 w-5 text-cta" />
            目錄
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto px-6 pb-8 pt-2 custom-scrollbar h-full">
          {headings.length > 0 ? (
            <div className="space-y-1">
              {headings.map((item) => (
                <button
                  key={`${item.id}-${item.level}`}
                  onClick={() => scrollToHeading(item.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 py-3 text-left transition-all",
                    item.level === 1 ? "text-base font-bold" : 
                    item.level === 2 ? "pl-4 text-sm font-semibold" : 
                    "pl-8 text-sm font-medium",
                    activeId === item.id 
                      ? "text-cta" 
                      : "text-white/60 hover:text-white"
                  )}
                >
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    activeId === item.id 
                      ? "bg-cta scale-125" 
                      : "bg-white/10 group-hover:bg-white/30"
                  )} />
                  <span className="flex-1 truncate">{item.text}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-white/30 text-sm">這篇文章沒有標題內容</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
