// components/admin/subscriptions/subscription-filters.tsx
// 訂閱列表篩選：狀態 + 課程（讀寫 searchParams，換條件時重置頁碼）。

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

const statusOptions = [
  { value: 'all', label: '全部狀態' },
  { value: 'PENDING', label: '待付款' },
  { value: 'ACTIVE', label: '生效中' },
  { value: 'PAST_DUE', label: '扣款失敗' },
  { value: 'CANCELED', label: '已取消' },
  { value: 'COMPLETED', label: '已完成' },
]

interface SubscriptionFiltersProps {
  courseOptions: Array<{ id: string; title: string }>
  status?: string
  courseId?: string
}

export function SubscriptionFilters({
  courseOptions,
  status,
  courseId,
}: SubscriptionFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentStatus = status || 'all'
  const currentCourse = courseId || 'all'

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === 'all') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })
      params.delete('page')
      router.push(`/admin/subscriptions?${params.toString()}`)
    },
    [router, searchParams]
  )

  const hasFilters = currentStatus !== 'all' || currentCourse !== 'all'

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      {/* 狀態 */}
      <Select
        value={currentStatus}
        onValueChange={(v) => updateParams({ status: v === 'all' ? null : v })}
      >
        <SelectTrigger className="w-[150px] bg-white border-divider text-heading rounded-lg">
          <SelectValue placeholder="訂閱狀態" />
        </SelectTrigger>
        <SelectContent className="bg-white border-divider">
          {statusOptions.map((option) => (
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

      {/* 課程 */}
      <Select
        value={currentCourse}
        onValueChange={(v) => updateParams({ courseId: v === 'all' ? null : v })}
      >
        <SelectTrigger className="w-[240px] bg-white border-divider text-heading rounded-lg">
          <SelectValue placeholder="全部課程" />
        </SelectTrigger>
        <SelectContent className="bg-white border-divider max-h-[320px]">
          <SelectItem
            value="all"
            className="text-heading focus:bg-surface focus:text-heading"
          >
            全部課程
          </SelectItem>
          {courseOptions.map((course) => (
            <SelectItem
              key={course.id}
              value={course.id}
              className="text-heading focus:bg-surface focus:text-heading"
            >
              {course.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/subscriptions')}
          className="text-body hover:text-heading hover:bg-surface"
        >
          <X className="mr-1 h-4 w-4" />
          清除篩選
        </Button>
      )}
    </div>
  )
}
