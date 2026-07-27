// components/admin/courses/course-filters.tsx
// 課程搜尋和篩選元件

'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2 } from 'lucide-react'
import {
  courseStatusOptions,
  courseVisibilityOptions,
} from '@/lib/course-options'

// 加入「全部」選項
const statusFilterOptions = [
  { value: 'ALL', label: '全部狀態' },
  ...courseStatusOptions,
]

const visibilityFilterOptions = [
  { value: 'ALL', label: '全部可見性' },
  ...courseVisibilityOptions,
]

export function CourseFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // 初始化搜尋值
  const [searchValue, setSearchValue] = useState(
    searchParams.get('search') ?? ''
  )
  const currentStatus = searchParams.get('status') ?? 'ALL'
  const currentVisibility = searchParams.get('salesVisibility') ?? 'ALL'

  // 更新 URL 參數
  const updateFilters = useCallback(
    (params: {
      search?: string
      status?: string
      salesVisibility?: string
      page?: string
    }) => {
      startTransition(() => {
        const newParams = new URLSearchParams(searchParams.toString())

        // 更新搜尋
        if (params.search !== undefined) {
          if (params.search) {
            newParams.set('search', params.search)
          } else {
            newParams.delete('search')
          }
          // 搜尋變更時重置頁碼
          newParams.delete('page')
        }

        // 更新可見性篩選
        if (params.salesVisibility !== undefined) {
          if (params.salesVisibility && params.salesVisibility !== 'ALL') {
            newParams.set('salesVisibility', params.salesVisibility)
          } else {
            newParams.delete('salesVisibility')
          }
          newParams.delete('page')
        }

        // 更新狀態篩選
        if (params.status !== undefined) {
          if (params.status && params.status !== 'ALL') {
            newParams.set('status', params.status)
          } else {
            newParams.delete('status')
          }
          // 狀態變更時重置頁碼
          newParams.delete('page')
        }

        // 更新頁碼
        if (params.page !== undefined) {
          if (params.page && params.page !== '1') {
            newParams.set('page', params.page)
          } else {
            newParams.delete('page')
          }
        }

        const queryString = newParams.toString()
        router.push(`/admin/courses${queryString ? `?${queryString}` : ''}`)
      })
    },
    [router, searchParams]
  )

  // 處理搜尋提交
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: searchValue })
  }

  // 處理狀態篩選變更
  const handleStatusChange = (value: string) => {
    updateFilters({ status: value })
  }

  const handleVisibilityChange = (value: string) => {
    updateFilters({ salesVisibility: value })
  }

  // 清除所有篩選
  const handleClearFilters = () => {
    setSearchValue('')
    startTransition(() => {
      router.push('/admin/courses')
    })
  }

  // 檢查是否有任何篩選條件
  const hasFilters =
    searchParams.get('search') ||
    searchParams.get('status') ||
    searchParams.get('salesVisibility')

  return (
    <div data-tour="course-filters" className="flex flex-col sm:flex-row gap-4">
      {/* 搜尋欄 */}
      <form onSubmit={handleSearch} className="flex-1 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-caption" />
          <Input
            type="text"
            placeholder="搜尋課程標題..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 bg-white border-divider text-heading placeholder:text-caption rounded-lg"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={isPending}
          className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            '搜尋'
          )}
        </Button>
      </form>

      {/* 狀態篩選 */}
      <div className="flex gap-2">
        <Select value={currentStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[140px] bg-white border-divider text-heading rounded-lg">
            <SelectValue placeholder="選擇狀態" />
          </SelectTrigger>
          <SelectContent className="bg-white border-divider rounded-lg">
            {statusFilterOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-heading focus:bg-surface focus:text-heading"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentVisibility}
          onValueChange={handleVisibilityChange}
        >
          <SelectTrigger className="w-[150px] bg-white border-divider text-heading rounded-lg">
            <SelectValue placeholder="選擇可見性" />
          </SelectTrigger>
          <SelectContent className="bg-white border-divider rounded-lg">
            {visibilityFilterOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-heading focus:bg-surface focus:text-heading"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 清除篩選按鈕 */}
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClearFilters}
            className="text-body hover:text-heading hover:bg-surface rounded-lg"
            title="清除篩選"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
