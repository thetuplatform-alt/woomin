// components/admin/subscriptions/subscription-pagination.tsx
// 訂閱列表分頁（保留 status / courseId 等其他篩選參數）。

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface SubscriptionPaginationProps {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
}

export function SubscriptionPagination({
  currentPage,
  totalPages,
  total,
  pageSize,
}: SubscriptionPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  const goToPage = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (page > 1) {
        params.set('page', page.toString())
      } else {
        params.delete('page')
      }
      const qs = params.toString()
      router.push(`/admin/subscriptions${qs ? `?${qs}` : ''}`)
    })
  }

  if (totalPages <= 1) {
    return <div className="text-sm text-body">共 {total} 筆訂閱</div>
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-body">
        顯示 {startItem} - {endItem} 筆，共 {total} 筆訂閱
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1 || isPending}
          className="border-divider text-body hover:bg-surface hover:text-heading disabled:opacity-50 rounded-lg"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一頁
            </>
          )}
        </Button>
        <span className="text-sm text-body px-2">
          第 {currentPage} / {totalPages} 頁
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages || isPending}
          className="border-divider text-body hover:bg-surface hover:text-heading disabled:opacity-50 rounded-lg"
        >
          下一頁
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
