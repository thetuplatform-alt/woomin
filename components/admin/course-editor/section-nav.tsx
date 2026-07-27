// components/admin/course-editor/section-nav.tsx
// Ghost 風格的左側固定導覽，用於長表單頁面
// 使用 IntersectionObserver 追蹤當前可見區塊

'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface SectionNavItem {
  id: string
  label: string
  icon: LucideIcon
}

interface SectionNavProps {
  items: SectionNavItem[]
  /** 右側可滾動容器的 ref */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

export function SectionNav({ items, scrollContainerRef }: SectionNavProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // 收集所有 section 元素
    const sections = items
      .map((item) => container.querySelector(`[data-section="${item.id}"]`))
      .filter(Boolean) as Element[]

    if (sections.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // 找到最上面的可見 section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          const el = visible[0].target as HTMLElement
          const id = el.getAttribute('data-section')
          if (id) setActiveId(id)
        }
      },
      {
        root: container,
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0,
      }
    )

    sections.forEach((section) => observerRef.current?.observe(section))

    return () => observerRef.current?.disconnect()
  }, [items, scrollContainerRef])

  function handleClick(id: string) {
    const container = scrollContainerRef.current
    if (!container) return

    const section = container.querySelector(`[data-section="${id}"]`) as HTMLElement | null
    if (section) {
      const offsetTop = section.offsetTop - container.offsetTop
      container.scrollTo({ top: offsetTop, behavior: 'smooth' })
    }
  }

  return (
    <nav className="hidden lg:block sticky top-6 w-48 shrink-0 self-start">
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = activeId === item.id
          const Icon = item.icon

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleClick(item.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                  isActive
                    ? 'text-cta bg-cta/5'
                    : 'text-body hover:text-heading hover:bg-surface'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
