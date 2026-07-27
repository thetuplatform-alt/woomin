// components/admin/analytics/sales-chart.tsx
// 銷售趨勢圖元件
// 使用 Recharts 顯示每日銷售數據

'use client'

import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailySales } from '@/lib/actions/analytics'

interface SalesChartProps {
  data: DailySales[]
}

// 格式化金額
function formatAmount(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}萬`
  }
  return value.toLocaleString()
}

// 自訂 Tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length) {
    return null
  }

  // 格式化日期
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
            {entry.name === 'revenue' ? '營收' : '訂單數'}:
          </span>
          <span className="text-heading font-medium text-sm">
            {entry.name === 'revenue'
              ? `NT$ ${entry.value.toLocaleString()}`
              : `${entry.value} 筆`}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SalesChart({ data }: SalesChartProps) {
  // 如果沒有數據
  if (data.length === 0) {
    return (
      <Card className="bg-white border-divider">
        <CardHeader>
          <CardTitle className="text-heading">銷售趨勢</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-caption">
            暫無銷售數據
          </div>
        </CardContent>
      </Card>
    )
  }

  // 格式化 X 軸日期
  const formatXAxis = (dateStr: string) => {
    return format(new Date(dateStr), 'MM/dd')
  }

  return (
    <Card className="bg-white border-divider">
      <CardHeader>
        <CardTitle className="text-heading">銷售趨勢</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                stroke="#A3A3A3"
                fontSize={12}
              />
              <YAxis
                yAxisId="revenue"
                orientation="left"
                tickFormatter={formatAmount}
                stroke="#A3A3A3"
                fontSize={12}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                stroke="#A3A3A3"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-body text-sm">
                    {value === 'revenue' ? '營收' : '訂單數'}
                  </span>
                )}
              />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                name="revenue"
                stroke="#F5A524"
                strokeWidth={2}
                dot={{ fill: '#F5A524', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#F5A524' }}
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                name="orders"
                stroke="#525252"
                strokeWidth={2}
                dot={{ fill: '#525252', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#525252' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
