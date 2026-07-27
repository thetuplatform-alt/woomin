// components/admin/users/user-filters.tsx
// 用戶篩選元件
// 提供搜尋和篩選功能

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
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

interface UserFiltersProps {
  courses: { id: string; title: string }[]
}

export function UserFilters({ courses }: UserFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // 從 URL 讀取當前篩選值
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const currentHasPurchase = searchParams.get('hasPurchase') ?? 'all'
  const currentCourseId = searchParams.get('courseId') ?? 'all'

  // 更新 URL 參數
  const updateParams = (updates: Record<string, string | null>) => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === 'all') {
          newParams.delete(key)
        } else {
          newParams.set(key, value)
        }
      })

      // 重置頁碼
      newParams.delete('page')

      const queryString = newParams.toString()
      router.push(`/admin/users${queryString ? `?${queryString}` : ''}`)
    })
  }

  // 處理搜尋
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ search: search || null })
  }

  // 處理篩選變更
  const handleFilterChange = (value: string) => {
    updateParams({ hasPurchase: value })
  }

  // 處理課程篩選變更
  const handleCourseChange = (value: string) => {
    updateParams({ courseId: value })
  }

  // 清除所有篩選
  const handleClearFilters = () => {
    setSearch('')
    startTransition(() => {
      router.push('/admin/users')
    })
  }

  const hasFilters =
    search || currentHasPurchase !== 'all' || currentCourseId !== 'all'

  return (
    <div data-tour="users-filters" className="flex flex-col sm:flex-row gap-4">
      {/* 搜尋 */}
      <form onSubmit={handleSearch} className="flex-1 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-caption" />
          <Input
            type="text"
            placeholder="搜尋姓名或 Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-divider text-heading placeholder:text-caption focus:border-cta rounded-lg"
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

      {/* 篩選 */}
      <div className="flex flex-wrap gap-2">
        {/* 課程篩選 */}
        <Select value={currentCourseId} onValueChange={handleCourseChange}>
          <SelectTrigger className="w-52 bg-white border-divider text-heading rounded-lg">
            <SelectValue placeholder="全部課程" />
          </SelectTrigger>
          <SelectContent className="bg-white border-divider max-h-72">
            <SelectItem
              value="all"
              className="text-body focus:bg-surface focus:text-heading"
            >
              全部課程
            </SelectItem>
            {courses.map((course) => (
              <SelectItem
                key={course.id}
                value={course.id}
                className="text-body focus:bg-surface focus:text-heading"
              >
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentHasPurchase}
          onValueChange={handleFilterChange}
        >
          <SelectTrigger className="w-40 bg-white border-divider text-heading rounded-lg">
            <SelectValue placeholder="購買狀態" />
          </SelectTrigger>
          <SelectContent className="bg-white border-divider">
            <SelectItem
              value="all"
              className="text-body focus:bg-surface focus:text-heading"
            >
              全部
            </SelectItem>
            <SelectItem
              value="yes"
              className="text-body focus:bg-surface focus:text-heading"
            >
              有購買課程
            </SelectItem>
            <SelectItem
              value="no"
              className="text-body focus:bg-surface focus:text-heading"
            >
              無購買課程
            </SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearFilters}
            className="text-body hover:text-heading hover:bg-surface"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">清除篩選</span>
          </Button>
        )}
      </div>
    </div>
  )
}
