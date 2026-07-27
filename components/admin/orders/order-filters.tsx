// components/admin/orders/order-filters.tsx
// 訂單篩選元件
// 提供狀態、付款方式、日期範圍篩選

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, Download } from 'lucide-react'
import { exportOrdersCsv } from '@/lib/actions/orders'
import { toast } from 'sonner'

// 訂單狀態選項
const statusOptions = [
  { value: 'all', label: '全部狀態' },
  { value: 'PENDING', label: '待付款' },
  { value: 'PAID', label: '已付款' },
  { value: 'FAILED', label: '付款失敗' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'CANCELLED', label: '已取消' },
]

// 付款方式選項
const paymentMethodOptions = [
  { value: 'all', label: '全部方式' },
  { value: 'CREDIT_CARD', label: '信用卡' },
  { value: 'APPLE_PAY', label: 'Apple Pay' },
  { value: 'GOOGLE_PAY', label: 'Google Pay' },
  { value: 'ATM', label: 'ATM 轉帳' },
  { value: 'CVS', label: '超商代碼' },
]

export function OrderFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isExporting, setIsExporting] = useState(false)

  // 取得當前篩選值
  const currentSearch = searchParams.get('search') || ''
  const currentStatus = searchParams.get('status') || 'all'
  const currentPaymentMethod = searchParams.get('paymentMethod') || 'all'
  const currentStartDate = searchParams.get('startDate') || ''
  const currentEndDate = searchParams.get('endDate') || ''

  // 更新 URL 參數
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

      // 重置頁碼
      params.delete('page')

      router.push(`/admin/orders?${params.toString()}`)
    },
    [router, searchParams]
  )

  // 處理搜尋
  const handleSearch = (value: string) => {
    updateParams({ search: value || null })
  }

  // 處理狀態篩選
  const handleStatusChange = (value: string) => {
    updateParams({ status: value === 'all' ? null : value })
  }

  // 處理付款方式篩選
  const handlePaymentMethodChange = (value: string) => {
    updateParams({ paymentMethod: value === 'all' ? null : value })
  }

  // 處理開始日期
  const handleStartDateChange = (value: string) => {
    updateParams({ startDate: value || null })
  }

  // 處理結束日期
  const handleEndDateChange = (value: string) => {
    updateParams({ endDate: value || null })
  }

  // 清除所有篩選
  const clearFilters = () => {
    router.push('/admin/orders')
  }

  // 檢查是否有篩選條件
  const hasFilters =
    currentSearch ||
    currentStatus !== 'all' ||
    currentPaymentMethod !== 'all' ||
    currentStartDate ||
    currentEndDate

  // 匯出 CSV
  const handleExport = async () => {
    try {
      setIsExporting(true)

      const result = await exportOrdersCsv({
        search: currentSearch || undefined,
        status: currentStatus !== 'all' ? (currentStatus as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED') : undefined,
        paymentMethod: currentPaymentMethod !== 'all' ? (currentPaymentMethod as 'CREDIT_CARD' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'ATM' | 'CVS') : undefined,
        startDate: currentStartDate || undefined,
        endDate: currentEndDate || undefined,
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || '匯出失敗')
      }

      // 建立下載連結
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `orders_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('匯出成功')
    } catch (error) {
      console.error('匯出失敗:', error)
      toast.error('匯出失敗，請稍後再試')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 第一行：搜尋和匯出 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-caption" />
          <Input
            placeholder="搜尋訂單編號、Email、課程名稱..."
            defaultValue={currentSearch}
            onChange={(e) => {
              const value = e.target.value
              // 防抖處理
              const timeoutId = setTimeout(() => handleSearch(value), 300)
              return () => clearTimeout(timeoutId)
            }}
            className="pl-10 bg-white border-divider text-heading placeholder:text-caption rounded-lg focus:border-cta focus:ring-cta"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting}
          className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? '匯出中...' : '匯出 CSV'}
        </Button>
      </div>

      {/* 第二行：篩選條件 */}
      <div className="flex flex-wrap items-center gap-4">
        {/* 狀態篩選 */}
        <Select value={currentStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[140px] bg-white border-divider text-heading rounded-lg">
            <SelectValue placeholder="訂單狀態" />
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

        {/* 付款方式篩選 */}
        <Select value={currentPaymentMethod} onValueChange={handlePaymentMethodChange}>
          <SelectTrigger className="w-[140px] bg-white border-divider text-heading rounded-lg">
            <SelectValue placeholder="付款方式" />
          </SelectTrigger>
          <SelectContent className="bg-white border-divider">
            {paymentMethodOptions.map((option) => (
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

        {/* 開始日期 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-body">從</span>
          <Input
            type="date"
            value={currentStartDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="w-[150px] bg-white border-divider text-heading rounded-lg"
          />
        </div>

        {/* 結束日期 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-body">到</span>
          <Input
            type="date"
            value={currentEndDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className="w-[150px] bg-white border-divider text-heading rounded-lg"
          />
        </div>

        {/* 清除篩選 */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-body hover:text-heading hover:bg-surface"
          >
            <X className="mr-1 h-4 w-4" />
            清除篩選
          </Button>
        )}
      </div>
    </div>
  )
}
