// components/admin/analytics/chart-card-wrapper.tsx
// 通用圖表卡片包裝元件
// 每張卡片有獨立的時間選擇器，切換時觸發資料重取

'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIME_PERIODS = [
  { label: '最近 24 小時', days: 1 },
  { label: '本週', days: 7 },
  { label: '月', days: 30 },
  { label: '年', days: 365 },
] as const

export type TimePeriodDays = (typeof TIME_PERIODS)[number]['days']

interface ChartCardWrapperProps {
  title: string
  icon?: ReactNode
  defaultDays?: TimePeriodDays
  /** 切換時間時呼叫，回傳新資料 */
  onPeriodChange?: (days: TimePeriodDays) => Promise<void>
  /** 是否顯示時間選擇器（某些卡片不需要，如付款方式） */
  showPeriodSelector?: boolean
  children: ReactNode
  className?: string
}

export function ChartCardWrapper({
  title,
  icon,
  defaultDays = 30,
  onPeriodChange,
  showPeriodSelector = true,
  children,
  className,
}: ChartCardWrapperProps) {
  const [selectedDays, setSelectedDays] = useState<TimePeriodDays>(defaultDays)
  const [isPending, startTransition] = useTransition()

  const handleChange = (days: TimePeriodDays) => {
    if (days === selectedDays || !onPeriodChange) return
    setSelectedDays(days)

    startTransition(async () => {
      await onPeriodChange(days)
    })
  }

  return (
    <Card className={cn('bg-white border-divider rounded-xl', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-heading flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>

        {showPeriodSelector && (
          <div className="flex items-center gap-0.5 rounded-md bg-surface-hover p-0.5">
            {TIME_PERIODS.map((period) => (
              <button
                key={period.days}
                onClick={() => handleChange(period.days)}
                disabled={isPending}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded transition-all',
                  selectedDays === period.days
                    ? 'bg-white text-heading shadow-sm'
                    : 'text-caption hover:text-body',
                  isPending && 'opacity-50 cursor-not-allowed'
                )}
              >
                {period.label}
              </button>
            ))}
            {isPending && (
              <Loader2 className="ml-0.5 h-3 w-3 animate-spin text-caption" />
            )}
          </div>
        )}
      </CardHeader>
      <CardContent
        className={cn('transition-opacity', isPending && 'opacity-50')}
      >
        {children}
      </CardContent>
    </Card>
  )
}
