// app/(admin)/admin/users/[id]/page.tsx
// 學員詳情頁
// 顯示學員資訊、購買記錄和學習進度

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getUserById, getUserProgress } from '@/lib/actions/users'
import { UserInfoCard } from '@/components/admin/users/user-info-card'
import { UserPurchases } from '@/components/admin/users/user-purchases'
import { UserProgress } from '@/components/admin/users/user-progress'
import { GrantAccessDialog } from '@/components/admin/users/grant-access-dialog'
import { PromoteRoleDialog } from '@/components/admin/users/promote-role-dialog'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '學員詳情',
}

interface UserDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params

  // 取得當前用戶
  const session = await auth()
  const isAdmin = session?.user?.role === 'ADMIN'

  // 取得學員詳情
  const user = await getUserById(id)

  if (!user) {
    notFound()
  }

  // 取得學習進度
  const progress = await getUserProgress(id)

  // 取得最後活動時間（從學習進度中取得最新的 lastWatchAt）
  const lastActiveAt = progress.length > 0
    ? progress.reduce((latest, p) => {
        if (!p.lastWatchAt) return latest
        if (!latest) return p.lastWatchAt
        return p.lastWatchAt > latest ? p.lastWatchAt : latest
      }, null as Date | null)
    : null

  // 已擁有的課程 ID
  const existingCourseIds = user.purchases.map((p) => p.courseId)

  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-body hover:text-heading hover:bg-surface"
          >
            <Link href="/admin/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-bold text-heading">學員詳情</h2>
            <p className="text-body mt-1">
              查看學員資訊及管理課程權限
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <PromoteRoleDialog
              userId={id}
              userName={user.name}
              currentRole={user.role}
            />
          )}
          <GrantAccessDialog
            userId={id}
            userName={user.name}
            existingCourseIds={existingCourseIds}
          />
        </div>
      </div>

      {/* 內容區域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：用戶資訊 */}
        <div className="lg:col-span-1">
          <UserInfoCard
            user={user}
            purchaseCount={user.purchases.length}
            lastActiveAt={lastActiveAt}
          />
        </div>

        {/* 右側：購買記錄和學習進度 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 購買記錄 */}
          <UserPurchases userId={id} purchases={user.purchases} />

          {/* 學習進度 */}
          <UserProgress progress={progress} />
        </div>
      </div>
    </div>
  )
}
