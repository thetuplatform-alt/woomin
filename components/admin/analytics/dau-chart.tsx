// components/admin/analytics/dau-chart.tsx
// 每日活躍學習用戶圖表
// 顯示每日有觀看影片的不重複用戶數

'use client'

import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import type { DailyActiveUsers } from '@/lib/actions/analytics'

interface DAUChartProps {
  data: DailyActiveUsers[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  const formattedDate = label
    ? format(new Date(label), 'yyyy年MM月dd日', { locale: zhTW })
    : ''

  return (
    <div className="bg-white border border-divider rounded-xl p-3">
      <p className="text-heading text-sm mb-1 font-medium">{formattedDate}</p>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-cta" />
        <span className="text-body text-sm">學習人數:</span>
        <span className="text-heading font-medium text-sm">
          {payload[0].value} 人
        </span>
      </div>
    </div>
  )
}

export function DAUChart({ data }: DAUChartProps) {
  if (data.length === 0) {
    return (
      <Card className="bg-white border-divider">
        <CardHeader>
          <CardTitle className="text-heading flex items-center gap-2">
            <Activity className="h-5 w-5 text-body" />
            每日學習人數
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] text-caption">
            暫無學習活動數據
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatXAxis = (dateStr: string) => format(new Date(dateStr), 'MM/dd')

  return (
    <Card className="bg-white border-divider">
      <CardHeader>
        <CardTitle className="text-heading flex items-center gap-2">
          <Activity className="h-5 w-5 text-body" />
          每日學習人數
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorDAU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A524" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F5A524" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                stroke="#A3A3A3"
                fontSize={12}
              />
              <YAxis stroke="#A3A3A3" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="activeUsers"
                stroke="#F5A524"
                strokeWidth={2}
                fill="url(#colorDAU)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
