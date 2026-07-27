// components/admin/admin-layout-client.tsx
// Admin Layout 的 Client 包裹器
// 提供 SidebarProvider、AdminThemeProvider 和客戶端狀態管理

'use client'

import { type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { SidebarProvider } from '@/lib/contexts/sidebar-context'
import { AdminThemeProvider, useAdminTheme } from '@/lib/contexts/admin-theme-context'
import { Sidebar } from '@/components/admin/sidebar'
import { Header } from '@/components/admin/header'
import { TourProvider, HelpButton, useTour } from '@/components/tour'

const TourOverlay = dynamic(() => import('@/components/tour/tour-overlay').then((mod) => mod.TourOverlay), {
  ssr: false,
})

function LazyTourOverlay() {
  const { isActive } = useTour()

  if (!isActive) return null

  return <TourOverlay />
}

interface AdminLayoutClientProps {
  children: ReactNode
  user: {
    name: string | null | undefined
    email: string | null | undefined
    image: string | null | undefined
    role: string
  }
}

function AdminLayoutInner({ children, user }: AdminLayoutClientProps) {
  const { theme } = useAdminTheme()

  return (
    <SidebarProvider>
      <div className={theme === 'dark' ? 'admin-dark' : ''}>
        {/* 桌面：灰色「桌面」底，側邊欄同色無邊框、白色內容卡片浮在上面 */}
        <div className="fixed inset-0 flex overflow-hidden bg-[var(--admin-shell)] text-foreground">
          {/* 桌面版側邊欄（齊左、無框線） */}
          <Sidebar className="hidden lg:flex" userRole={user.role} user={user} />

          {/* 主內容欄（含新手教學:右上角問號 + 聚光燈導覽） */}
          <TourProvider>
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* 行動版才顯示的精簡頂列（含選單鈕）；桌面隱藏 */}
              <Header user={user} />

              {/* 浮動內容卡片：四周留白、圓角、陰影 */}
              <div className="flex-1 overflow-hidden p-2.5 lg:p-3">
                <main className="h-full overflow-y-auto rounded-2xl border border-border bg-card shadow-sm">
                  {children}
                </main>
              </div>
            </div>

            {/* 常駐問號入口 + 教學覆蓋層 */}
            <HelpButton />
            <LazyTourOverlay />
          </TourProvider>
        </div>
      </div>
    </SidebarProvider>
  )
}

export function AdminLayoutClient({ children, user }: AdminLayoutClientProps) {
  return (
    <AdminThemeProvider>
      <AdminLayoutInner user={user}>{children}</AdminLayoutInner>
    </AdminThemeProvider>
  )
}
