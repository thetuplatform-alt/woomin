// app/(admin)/admin/courses/page.tsx
// 課程列表頁
// 顯示所有課程，支援搜尋、篩選和分頁

import { Suspense } from 'react'
import Link from 'next/link'
import { getCourses } from '@/lib/actions/courses'
import { CourseTable } from '@/components/admin/courses/course-table'
import { CourseFilters } from '@/components/admin/courses/course-filters'
import { CoursePagination } from '@/components/admin/courses/course-pagination'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import type { CourseStatus, CourseVisibility } from '@prisma/client'

export const metadata = {
  title: '課程管理',
}

interface CoursesPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    salesVisibility?: string
    page?: string
  }>
}

// 課程列表區塊
async function CourseListSection({
  search,
  status,
  salesVisibility,
  page,
}: {
  search?: string
  status?: string
  salesVisibility?: string
  page?: string
}) {
  // 解析頁碼
  const currentPage = page ? parseInt(page, 10) : 1
  const pageSize = 10

  // 取得課程列表
  const result = await getCourses({
    search,
    status: status as CourseStatus | 'ALL' | undefined,
    salesVisibility:
      salesVisibility as CourseVisibility | 'ALL' | undefined,
    page: currentPage,
    pageSize,
  })

  return (
    <>
      {/* 課程表格 */}
      <CourseTable courses={result.courses} />

      {/* 分頁 */}
      <div className="mt-4">
        <CoursePagination
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
function CourseListSkeleton() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
    </div>
  )
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const params = await searchParams

  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">課程管理</h2>
          <p className="text-body mt-1">
            管理您的所有課程內容
          </p>
        </div>
        <Button
          asChild
          data-tour="new-course-btn"
          className="bg-cta hover:bg-cta-hover text-white rounded-full"
        >
          <Link href="/admin/courses/new">
            <Plus className="mr-2 h-4 w-4" />
            新增課程
          </Link>
        </Button>
      </div>

      {/* 搜尋和篩選 */}
      <CourseFilters />

      {/* 課程列表 */}
      <Suspense fallback={<CourseListSkeleton />}>
        <CourseListSection
          search={params.search}
          status={params.status}
          salesVisibility={params.salesVisibility}
          page={params.page}
        />
      </Suspense>
    </div>
  )
}
