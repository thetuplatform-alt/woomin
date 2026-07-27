// app/(admin)/admin/users/page.tsx
// 用戶列表頁
// 顯示所有用戶，支援角色分頁、搜尋、篩選和分頁

import { Suspense } from 'react'
import Link from 'next/link'
import { getUsers, getManageableCourseOptions } from '@/lib/actions/users'
import { UserTable } from '@/components/admin/users/user-table'
import { UserFilters } from '@/components/admin/users/user-filters'
import { UserPagination } from '@/components/admin/users/user-pagination'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { ExportCsvButton } from '@/components/admin/users/export-csv-button'
import { ImportStudentsDialog } from '@/components/admin/users/import-students-dialog'
import { AddUserDialog } from '@/components/admin/users/add-user-dialog'
import { cn } from '@/lib/utils'
import { requireAdminAuth } from '@/lib/require-admin'

export const metadata = {
  title: '學員管理',
}

interface UsersPageProps {
  searchParams: Promise<{
    search?: string
    hasPurchase?: string
    role?: string
    courseId?: string
    page?: string
  }>
}

const roleTabs = [
  { value: 'ALL', label: '全部' },
  { value: 'USER', label: '學員' },
  { value: 'INSTRUCTOR', label: '講師' },
  { value: 'ADMIN', label: '管理員' },
] as const

// 用戶列表區塊
async function UserListSection({
  search,
  hasPurchase,
  role,
  courseId,
  page,
}: {
  search?: string
  hasPurchase?: string
  role?: string
  courseId?: string
  page?: string
}) {
  // 解析頁碼
  const currentPage = page ? parseInt(page, 10) : 1
  const pageSize = 20

  // 取得用戶列表
  const result = await getUsers({
    search,
    role: role as 'ALL' | 'USER' | 'INSTRUCTOR' | 'ADMIN' | undefined,
    hasPurchase: hasPurchase as 'all' | 'yes' | 'no' | undefined,
    courseId: courseId || undefined,
    page: currentPage,
    pageSize,
  })

  return (
    <>
      {/* 用戶表格 */}
      <div data-tour="users-table">
        <UserTable users={result.users} />
      </div>

      {/* 分頁 */}
      <div className="mt-4">
        <UserPagination
          currentPage={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
        />
      </div>
    </>
  )
}

// 載入中狀態
function UserListSkeleton() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-caption" />
    </div>
  )
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams
  const actor = await requireAdminAuth()
  const isAdmin = actor.role === 'ADMIN'
  const courseOptions = await getManageableCourseOptions()
  // 講師只會看到自己課程的學員，角色分頁對其無意義，一律視為「全部（即自己的學員）」
  const currentRole = !isAdmin
    ? 'ALL'
    : params.role === 'ALL' ||
        params.role === 'INSTRUCTOR' ||
        params.role === 'ADMIN' ||
        params.role === 'USER'
      ? params.role
      : 'ALL'
  const defaultNewRole =
    currentRole === 'INSTRUCTOR' || currentRole === 'ADMIN'
      ? currentRole
      : 'USER'

  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">學員管理</h2>
          <p className="text-body mt-1">
            {isAdmin ? '管理學員、講師與管理員帳號' : '管理已購買你課程的學員'}
          </p>
        </div>
        {isAdmin ? <AddUserDialog defaultRole={defaultNewRole} /> : null}
      </div>

      {/* 工具列：角色分頁、篩選功能、匯入/匯出 同一排 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 角色分頁僅對 ADMIN 顯示；講師只會看到自己課程的學員 */}
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            {roleTabs.map((tab) => {
              const href =
                tab.value === 'ALL'
                  ? '/admin/users'
                  : `/admin/users?role=${tab.value}`
              const active = currentRole === tab.value
              return (
                <Button
                  key={tab.value}
                  asChild
                  variant={active ? 'default' : 'outline'}
                  className={cn(
                    'rounded-lg',
                    active
                      ? 'bg-heading text-white hover:bg-heading'
                      : 'border-divider text-body hover:bg-surface hover:text-heading'
                  )}
                >
                  <Link href={href}>{tab.label}</Link>
                </Button>
              )
            })}
          </div>
        ) : null}

        {/* 搜尋和篩選 */}
        <div className="min-w-[260px] flex-1">
          <UserFilters courses={courseOptions} />
        </div>

        {/* 匯入/匯出 */}
        <div className="flex shrink-0 items-center gap-2">
          <ImportStudentsDialog />
          <ExportCsvButton />
        </div>
      </div>

      {/* 用戶列表 */}
      <Suspense fallback={<UserListSkeleton />}>
        <UserListSection
          search={params.search}
          hasPurchase={params.hasPurchase}
          role={currentRole}
          courseId={params.courseId}
          page={params.page}
        />
      </Suspense>
    </div>
  )
}
