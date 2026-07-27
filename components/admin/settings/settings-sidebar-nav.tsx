'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Settings,
  Layout,
  Mail,
  BarChart3,
  Sparkles,
  Shield,
  HardDrive,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SettingsSection {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const sections: SettingsSection[] = [
  { id: 'basic', label: '站點設定', icon: Settings },
  { id: 'media', label: '影音設定', icon: HardDrive },
  { id: 'analytics', label: '分析追蹤', icon: BarChart3 },
  { id: 'layout', label: '版面設定', icon: Layout },
  { id: 'email', label: 'Email 設定', icon: Mail },
  { id: 'social-login', label: '登入方式', icon: Shield },
  { id: 'ai', label: 'AI 設定', icon: Sparkles },
]

interface SettingsSidebarNavProps {
  variant?: 'vertical' | 'horizontal'
}

export function SettingsSidebarNav({
  variant = 'vertical',
}: SettingsSidebarNavProps) {
  const [activeSection, setActiveSection] = useState('basic')
  const activeButtonRef = useRef<HTMLButtonElement>(null)

  const handleClick = useCallback((id: string) => {
    const element = document.getElementById(`section-${id}`)
    if (!element) {
      return
    }

    const scrollContainer = element.closest('main') ?? element.closest('[class*="overflow-y-auto"]')
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const scrollTop = scrollContainer.scrollTop + (elementRect.top - containerRect.top)
      scrollContainer.scrollTo({ top: scrollTop, behavior: 'smooth' })
      return
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    if (variant === 'horizontal' && activeButtonRef.current) {
      activeButtonRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeSection, variant])

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const visibleSections = new Map<string, number>()

    sections.forEach((section) => {
      const element = document.getElementById(`section-${section.id}`)
      if (!element) {
        return
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              visibleSections.set(section.id, entry.boundingClientRect.top)
            } else {
              visibleSections.delete(section.id)
            }

            if (visibleSections.size === 0) {
              return
            }

            let topmostId = ''
            let minTop = Infinity

            visibleSections.forEach((top, id) => {
              if (top < minTop) {
                minTop = top
                topmostId = id
              }
            })

            if (topmostId) {
              setActiveSection(topmostId)
            }
          })
        },
        {
          rootMargin: '-80px 0px -60% 0px',
          threshold: 0,
        }
      )

      observer.observe(element)
      observers.push(observer)
    })

    return () => {
      observers.forEach((observer) => observer.disconnect())
    }
  }, [])

  if (variant === 'horizontal') {
    return (
      <nav className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
        {sections.map((section) => {
          const isActive = activeSection === section.id

          return (
            <button
              key={section.id}
              ref={isActive ? activeButtonRef : undefined}
              onClick={() => handleClick(section.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-secondary text-foreground font-semibold'
                  : 'bg-secondary/50 text-muted-foreground/80 hover:text-foreground'
              )}
            >
              <section.icon className="h-3.5 w-3.5" />
              {section.label}
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="space-y-1">
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-caption">
        設定分類
      </p>
      {sections.map((section) => {
        const isActive = activeSection === section.id

        return (
          <button
            key={section.id}
            onClick={() => handleClick(section.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
              isActive
                ? 'bg-secondary text-foreground font-semibold'
                : 'text-muted-foreground/80 hover:bg-secondary/60 hover:text-foreground'
            )}
          >
            <section.icon className="h-4 w-4" />
            {section.label}
          </button>
        )
      })}
    </nav>
  )
}
