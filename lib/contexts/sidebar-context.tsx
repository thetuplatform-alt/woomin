// lib/contexts/sidebar-context.tsx
// Sidebar 狀態管理 Context
// 管理 sidebar 的折疊/展開狀態

'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'

interface SidebarContextValue {
  /** Sidebar 是否處於折疊狀態 */
  isCollapsed: boolean
  /** 設定折疊狀態 */
  setCollapsed: (value: boolean) => void
  /** 切換折疊狀態 */
  toggleCollapse: () => void
  /** Sidebar 是否處於 hover 展開狀態 (overlay 模式) */
  isHoverExpanded: boolean
  /** 設定 hover 展開狀態 */
  setHoverExpanded: (value: boolean) => void
  /** 是否處於課程編輯模式 (自動折疊 sidebar) */
  isInCourseEditor: boolean
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

interface SidebarProviderProps {
  children: ReactNode
}

/**
 * 檢查路由是否為課程編輯模式
 * 課程編輯模式路由: /admin/courses/[id]/**
 * 但不包括: /admin/courses (列表頁) 和 /admin/courses/new (新增頁)
 */
function isInCourseEditorRoute(pathname: string): boolean {
  // 匹配 /admin/courses/[id] 及其子路由
  // 排除 /admin/courses 和 /admin/courses/new
  const courseEditorPattern = /^\/admin\/courses\/(?!new$)[^/]+/
  return courseEditorPattern.test(pathname)
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHoverExpanded, setHoverExpanded] = useState(false)

  // 檢查是否處於課程編輯模式
  const isInCourseEditor = isInCourseEditorRoute(pathname)

  // 當路由變更時，自動調整折疊狀態
  useEffect(() => {
    if (isInCourseEditor) {
      // 進入課程編輯模式時自動折疊
      setIsCollapsed(true)
    } else {
      // 離開課程編輯模式時自動展開
      setIsCollapsed(false)
    }
    // 路由變更時重置 hover 狀態
    setHoverExpanded(false)
  }, [isInCourseEditor])

  const setCollapsed = useCallback((value: boolean) => {
    setIsCollapsed(value)
  }, [])

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  const value: SidebarContextValue = {
    isCollapsed,
    setCollapsed,
    toggleCollapse,
    isHoverExpanded,
    setHoverExpanded,
    isInCourseEditor,
  }

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
