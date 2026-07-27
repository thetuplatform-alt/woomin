// components/admin/header.tsx
// 後台頂部列（精簡版）
// 桌面版已不需要頂列（帳號/返回前台/深色切換都移到側邊欄底部）；
// 此元件只在行動版顯示，提供選單按鈕與標題。

'use client'

import { MobileNav } from './mobile-nav'

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string
  }
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <MobileNav userRole={user.role} />
      <span className="text-base font-semibold text-foreground">後台管理</span>
    </header>
  )
}
