// components/admin/analytics/user-growth-chart.tsx
// 用戶成長趨勢圖元件
// 顯示每日新增用戶和累計用戶數

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
  Bar,
  ComposedChart,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import type { UserGrowthData } from '@/lib/actions/analytics'

interface UserGrowthChartProps {
  data: UserGrowthData[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  const formattedDate = label
    ? format(new Date(label), 'yyyy年MM月dd日', { locale: zhTW })
    : ''

  return (
    <div className="bg-white border border-divider rounded-xl p-3">
      <p className="text-heading text-sm mb-2 font-medium">{formattedDate}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-body text-sm">
            {entry.name === 'newUsers' ? '新增用戶' : '累計用戶'}:
          </span>
          <span className="text-heading font-medium text-sm">
            {entry.value} 人
          </span>
        </div>
      ))}
    </div>
  )
}

export function UserGrowthChart({ data }: UserGrowthChartProps) {
  if (data.length === 0) {
    return (
      <Card className="bg-white border-divider">
        <CardHeader>
          <CardTitle className="text-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-body" />
            用戶成長趨勢
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-caption">
            暫無用戶數據
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
          <Users className="h-5 w-5 text-body" />
          用戶成長趨勢
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A524" stopOpacity={0.15} />
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
              <YAxis
                yAxisId="cumulative"
                orientation="left"
                stroke="#A3A3A3"
                fontSize={12}
              />
              <YAxis
                yAxisId="daily"
                orientation="right"
                stroke="#A3A3A3"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="cumulative"
                type="monotone"
                dataKey="cumulativeUsers"
                name="cumulativeUsers"
                stroke="#F5A524"
                strokeWidth={2}
                fill="url(#colorCumulative)"
              />
              <Bar
                yAxisId="daily"
                dataKey="newUsers"
                name="newUsers"
                fill="#525252"
                radius={[2, 2, 0, 0]}
                barSize={12}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
