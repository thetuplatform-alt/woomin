// components/admin/users/user-pagination.tsx
// 用戶分頁元件

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface UserPaginationProps {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
}

export function UserPagination({
  currentPage,
  totalPages,
  total,
  pageSize,
}: UserPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // 計算顯示範圍
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  // 換頁
  const goToPage = (page: number) => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams.toString())

      if (page > 1) {
        newParams.set('page', page.toString())
      } else {
        newParams.delete('page')
      }

      const queryString = newParams.toString()
      router.push(`/admin/users${queryString ? `?${queryString}` : ''}`)
    })
  }

  // 如果只有一頁，不顯示分頁
  if (totalPages <= 1) {
    return (
      <div className="text-sm text-body">
        共 {total} 位學員
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-body">
        顯示 {startItem} - {endItem} 筆，共 {total} 位學員
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

        <div className="flex items-center gap-1">
          {/* 頁碼按鈕 */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              // 顯示第一頁、最後一頁、當前頁及其前後一頁
              return (
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1
              )
            })
            .reduce((acc: (number | 'ellipsis')[], page, index, arr) => {
              // 加入省略號
              if (index > 0) {
                const prevPage = arr[index - 1]
                if (typeof prevPage === 'number' && page - prevPage > 1) {
                  acc.push('ellipsis')
                }
              }
              acc.push(page)
              return acc
            }, [])
            .map((item, index) => {
              if (item === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-caption"
                  >
                    ...
                  </span>
                )
              }

              return (
                <Button
                  key={item}
                  variant={currentPage === item ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => goToPage(item)}
                  disabled={isPending}
                  className={
                    currentPage === item
                      ? 'bg-cta hover:bg-cta-hover text-white rounded-lg'
                      : 'border-divider text-body hover:bg-surface hover:text-heading rounded-lg'
                  }
                >
                  {item}
                </Button>
              )
            })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages || isPending}
          className="border-divider text-body hover:bg-surface hover:text-heading disabled:opacity-50 rounded-lg"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              下一頁
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
