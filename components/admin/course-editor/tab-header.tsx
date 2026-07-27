// components/admin/course-editor/tab-header.tsx
// 課程編輯器的 Tab 導航標題
// Tab: 課程資訊、定價與促銷、邀請、課程內容、作業/測驗、留言、私訊、評價、分析

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  FileText,
  LayoutList,
  BarChart3,
  ArrowLeft,
  MessageCircle,
  Mail,
  Tag,
  Star,
  ClipboardCheck,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TabHeaderProps {
  courseId: string
  courseTitle: string
}

const tabs = [
  {
    id: 'info',
    label: '課程資訊',
    icon: FileText,
    href: (courseId: string) => `/admin/courses/${courseId}/info`,
  },
  {
    id: 'pricing',
    label: '定價與促銷',
    icon: Tag,
    href: (courseId: string) => `/admin/courses/${courseId}/pricing`,
  },
  {
    id: 'invites',
    label: '邀請',
    icon: KeyRound,
    href: (courseId: string) => `/admin/courses/${courseId}/invites`,
  },
  {
    id: 'content',
    label: '課程內容',
    icon: LayoutList,
    href: (courseId: string) => `/admin/courses/${courseId}/content`,
  },
  {
    id: 'assignments',
    label: '作業 / 測驗',
    icon: ClipboardCheck,
    href: (courseId: string) => `/admin/courses/${courseId}/assignments`,
  },
  {
    id: 'comments',
    label: '留言',
    icon: MessageCircle,
    href: (courseId: string) => `/admin/courses/${courseId}/comments`,
  },
  {
    id: 'messages',
    label: '私訊',
    icon: Mail,
    href: (courseId: string) => `/admin/courses/${courseId}/messages`,
  },
  {
    id: 'reviews',
    label: '評價',
    icon: Star,
    href: (courseId: string) => `/admin/courses/${courseId}/reviews`,
  },
  {
    id: 'analytics',
    label: '分析',
    icon: BarChart3,
    href: (courseId: string) => `/admin/courses/${courseId}/analytics`,
  },
]

export function TabHeader({ courseId, courseTitle }: TabHeaderProps) {
  const pathname = usePathname()

  // 根據路徑判斷當前 tab
  // welcome-email 屬於課程資訊的子頁面
  const getCurrentTab = () => {
    if (pathname.includes('/pricing')) return 'pricing'
    if (pathname.includes('/invites')) return 'invites'
    if (pathname.includes('/content')) return 'content'
    if (pathname.includes('/assignments')) return 'assignments'
    if (pathname.includes('/messages')) return 'messages'
    if (pathname.includes('/comments')) return 'comments'
    if (pathname.includes('/reviews')) return 'reviews'
    if (pathname.includes('/analytics')) return 'analytics'
    // info 和 welcome-email 都歸為 info tab
    return 'info'
  }

  const currentTab = getCurrentTab()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-divider bg-white px-4">
      {/* 左側：返回按鈕和課程標題 */}
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface"
        >
          <Link href="/admin/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-heading truncate max-w-[200px]">
            {courseTitle}
          </p>
        </div>
      </div>

      {/* 中間：Tab 導航 */}
      <nav className="flex items-center gap-1">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id
          const Icon = tab.icon

          return (
            <Link
              key={tab.id}
              href={tab.href(courseId)}
              className={cn(
                'relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-lg',
                isActive
                  ? 'text-cta'
                  : 'text-body hover:text-heading hover:bg-surface'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{tab.label}</span>
              {/* Active 指示器 */}
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-cta rounded-full" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* 右側：預留空間 */}
      <div className="w-[120px]" />
    </header>
  )
}
