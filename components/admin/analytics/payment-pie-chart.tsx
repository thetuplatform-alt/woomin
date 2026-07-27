// components/admin/analytics/payment-pie-chart.tsx
// 付款方式圓餅圖元件
// 使用 Recharts 顯示付款方式分布

'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard } from 'lucide-react'
import type { PaymentMethodStats } from '@/lib/actions/analytics'

interface PaymentPieChartProps {
  data: PaymentMethodStats[]
}

// 顏色配置
const COLORS = [
  '#F5A524', // 強調色
  '#525252', // 文字次色
  '#A3A3A3', // 文字輔助
  '#E5E5E5', // 邊框主色
  '#0A0A0A', // 文字主色
]

// 自訂 Tooltip
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: PaymentMethodStats }>
}) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const data = payload[0].payload

  return (
    <div className="bg-white border border-divider rounded-xl p-3">
      <p className="text-heading font-medium mb-1">{data.label}</p>
      <p className="text-body text-sm">
        訂單數: <span className="text-heading">{data.count} 筆</span>
      </p>
      <p className="text-body text-sm">
        佔比: <span className="text-heading">{data.percentage}%</span>
      </p>
    </div>
  )
}

// 自訂 Legend
function CustomLegend({
  payload,
}: {
  payload?: Array<{
    value: string
    color: string
    payload?: PaymentMethodStats
  }>
}) {
  if (!payload) return null

  return (
    <ul className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry, index) => {
        const data = entry.payload
        if (!data) return null

        return (
          <li key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-body text-sm">
              {data.label}
            </span>
            <span className="text-caption text-sm">
              ({data.percentage}%)
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function PaymentPieChart({ data }: PaymentPieChartProps) {
  if (data.length === 0) {
    return (
      <Card className="bg-white border-divider">
        <CardHeader>
          <CardTitle className="text-heading flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-body" />
            付款方式分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[250px] text-caption">
            暫無付款數據
          </div>
        </CardContent>
      </Card>
    )
  }

  // 轉換資料格式以符合 Recharts 的類型要求
  const chartData = data.map((item) => ({
    method: item.method,
    label: item.label,
    count: item.count,
    percentage: item.percentage,
  }))

  return (
    <Card className="bg-white border-divider">
      <CardHeader>
        <CardTitle className="text-heading flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-body" />
          付款方式分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                label={({ payload }) => `${(payload as { percentage: number }).percentage}%`}
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 詳細列表 */}
        <div className="mt-6 space-y-2">
          {data.map((item, index) => (
            <div
              key={item.method}
              className="flex items-center justify-between p-3 rounded-xl bg-surface border border-divider"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-heading text-sm">{item.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-body text-sm">
                  {item.count} 筆
                </span>
                <span className="text-heading text-sm font-medium w-16 text-right">
                  {item.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
