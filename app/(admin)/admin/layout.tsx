// app/(admin)/admin/layout.tsx
// 後台管理系統 Layout
// 包含側邊欄、頂部導覽和權限檢查

import { redirect } from 'next/navigation'
import { AdminLayoutClient } from '@/components/admin/admin-layout-client'
import { checkNeedsSetup } from '@/lib/actions/setup'
import { requireAdminAuth } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '後台管理',
}

interface AdminLayoutProps {
  children: React.ReactNode
}

async function getAdminLayoutUser() {
  try {
    return await requireAdminAuth()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    // 只有驗證失敗時才查初始化狀態，避免正常後台換頁多等一次資料庫 count。
    const needsSetup = await checkNeedsSetup()
    if (needsSetup) {
      redirect('/admin/setup')
    }

    if (message === '權限不足') {
      redirect('/')
    }
    redirect('/login')
  }
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getAdminLayoutUser()

  return (
    <AdminLayoutClient
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      }}
    >
      {children}
    </AdminLayoutClient>
  )
}
