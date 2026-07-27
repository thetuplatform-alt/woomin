// lib/contexts/admin-theme-context.tsx
// 管理後台主題 Context
// 管理深色/淺色模式切換，僅影響 admin 區域

'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'

interface AdminThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(undefined)

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('admin-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
    }
  }, [])

  // 把 admin-dark 同步掛到 <body>，讓透過 Portal 渲染到 document.body 的元件
  // （DropdownMenu / Tooltip / Popover / Select / Dialog 等）也能吃到深色變數，
  // 否則它們會渲染在 admin 容器外、退回 :root 的淺色變數而變成白底。
  // 離開後台時於 cleanup 移除，避免影響前台。
  useEffect(() => {
    const { classList } = document.body
    if (theme === 'dark') {
      classList.add('admin-dark')
    } else {
      classList.remove('admin-dark')
    }
    return () => {
      classList.remove('admin-dark')
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('admin-theme', next)
      return next
    })
  }, [])

  return (
    <AdminThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </AdminThemeContext.Provider>
  )
}

export function useAdminTheme(): AdminThemeContextValue {
  const context = useContext(AdminThemeContext)
  if (context === undefined) {
    throw new Error('useAdminTheme must be used within an AdminThemeProvider')
  }
  return context
}
