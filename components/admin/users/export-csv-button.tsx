// components/admin/users/export-csv-button.tsx
// 匯出學員列表 CSV 按鈕
// 根據當前篩選條件匯出，並顯示篩選狀態提示

'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, Filter } from 'lucide-react'
import { exportUsersCSV } from '@/lib/actions/users'

export function ExportCsvButton() {
  const searchParams = useSearchParams()
  const [isExporting, setIsExporting] = useState(false)

  const search = searchParams.get('search') ?? undefined
  const role =
    (searchParams.get('role') as 'ALL' | 'USER' | 'INSTRUCTOR' | 'ADMIN') ??
    'ALL'
  const hasPurchase =
    (searchParams.get('hasPurchase') as 'all' | 'yes' | 'no') ?? undefined
  const courseId = searchParams.get('courseId') ?? undefined

  // 計算生效中的篩選條件數量
  let activeFilterCount = 0
  if (search) activeFilterCount++
  if (role && role !== 'ALL') activeFilterCount++
  if (hasPurchase && hasPurchase !== 'all') activeFilterCount++
  if (courseId) activeFilterCount++

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const csv = await exportUsersCSV({ search, hasPurchase, role, courseId })

      // 加 BOM 讓 Excel 正確辨識 UTF-8
      const bom = '\uFEFF'
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const today = new Date().toISOString().split('T')[0]
      const a = document.createElement('a')
      a.href = url
      a.download = `學員列表_${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('匯出 CSV 失敗:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {activeFilterCount > 0 && (
        <span className="flex items-center gap-1 text-xs text-cta font-medium">
          <Filter className="h-3 w-3" />
          套用 {activeFilterCount} 項篩選條件
        </span>
      )}
      <Button
        data-tour="users-export-btn"
        variant="outline"
        onClick={handleExport}
        disabled={isExporting}
        className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
      >
        {isExporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        匯出 CSV
      </Button>
    </div>
  )
}
