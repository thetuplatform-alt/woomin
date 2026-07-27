// app/(admin)/admin/instructors/page.tsx
// 講師管理頁
// 顯示所有管理員與講師，支援角色切換；右上可用 email 即時搜尋新增講師/管理員
// 僅 ADMIN 可存取

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAdminUsers } from '@/lib/actions/users'
import { AdminTable } from '@/components/admin/users/admin-table'
import { AddTeamMemberDialog } from '@/components/admin/users/add-team-member-dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Shield, AlertTriangle } from 'lucide-react'

export const metadata = {
  title: '講師管理',
}

export default async function InstructorsPage() {
  // 取得當前用戶
  const session = await auth()

  // 只有 ADMIN 可以存取此頁面
  if (session?.user?.role !== 'ADMIN') {
    redirect('/admin/users')
  }

  // 取得管理員與講師列表
  const admins = await getAdminUsers()

  // 計算統計
  const adminCount = admins.filter((a) => a.role === 'ADMIN').length
  const instructorCount = admins.filter(
    (a) => a.role === 'INSTRUCTOR' || a.role === 'EDITOR'
  ).length

  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">講師管理</h2>
          <p className="text-body mt-1">管理講師與管理員權限</p>
        </div>
        <AddTeamMemberDialog />
      </div>

      {/* 統計卡片 */}
      <div data-tour="instructors-stats" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-white border-divider rounded-xl">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center">
                <Shield className="h-6 w-6 text-cta" />
              </div>
              <div>
                <p className="text-2xl font-bold text-heading">{adminCount}</p>
                <p className="text-sm text-body">管理員</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-divider rounded-xl">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center">
                <Shield className="h-6 w-6 text-body" />
              </div>
              <div>
                <p className="text-2xl font-bold text-heading">{instructorCount}</p>
                <p className="text-sm text-body">講師</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 警告提示 */}
      <Card data-tour="instructors-warnings" className="bg-amber-50 border-amber-200 rounded-xl">
        <CardContent>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-700">注意事項</p>
              <ul className="text-sm text-amber-700 mt-1 space-y-1 list-disc list-inside">
                <li>系統必須保留至少一位管理員</li>
                <li>您無法修改自己的角色</li>
                <li>將管理員降級為學員將移除其管理權限</li>
                <li>角色變更會立即生效</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 管理員與講師列表 */}
      <Card data-tour="instructors-table" className="bg-white border-divider rounded-xl">
        <CardHeader>
          <CardTitle className="text-heading">權限管理</CardTitle>
          <CardDescription className="text-body">
            管理所有具有管理權限的用戶
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminTable admins={admins} currentUserId={session.user.id as string} />
        </CardContent>
      </Card>
    </div>
  )
}
