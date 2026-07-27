// components/admin/analytics/conversion-funnel-chart.tsx
// 轉換漏斗圖元件
// 以整合式列表呈現各階段的人數與轉換率

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter } from 'lucide-react'
import type { FunnelStep } from '@/lib/actions/analytics'

interface ConversionFunnelChartProps {
  data: FunnelStep[]
}

const FUNNEL_COLORS = [
  '#F5A524',
  '#E09000',
  '#525252',
  '#A3A3A3',
]

export function ConversionFunnelChart({ data }: ConversionFunnelChartProps) {
  if (data.length === 0) {
    return (
      <Card className="bg-white border-divider">
        <CardHeader>
          <CardTitle className="text-heading flex items-center gap-2">
            <Filter className="h-5 w-5 text-body" />
            轉換漏斗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-caption">
            暫無轉換數據
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxCount = data[0]?.count || 1

  return (
    <Card className="bg-white border-divider">
      <CardHeader>
        <CardTitle className="text-heading flex items-center gap-2">
          <Filter className="h-5 w-5 text-body" />
          轉換漏斗
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 表頭 */}
        <div className="flex items-center gap-3 mb-3 px-1 text-xs text-caption">
          <span className="w-20 shrink-0">步驟</span>
          <span className="flex-1" />
          <span className="w-16 text-right shrink-0">人數</span>
          <span className="w-20 text-right shrink-0">步進轉換</span>
          <span className="w-20 text-right shrink-0">整體轉換</span>
        </div>

        {/* 漏斗列表 */}
        <div className="space-y-3">
          {data.map((step, index) => {
            const barWidth = maxCount > 0 ? (step.count / maxCount) * 100 : 0

            return (
              <div key={step.name}>
                {/* 步驟名稱行 + 數據 */}
                <div className="flex items-center gap-3">
                  {/* 色點 + 名稱 */}
                  <div className="flex items-center gap-2 w-20 shrink-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length] }}
                    />
                    <span className="text-heading text-sm truncate">{step.name}</span>
                  </div>

                  {/* 橫條 */}
                  <div className="flex-1 h-8 bg-surface rounded-md overflow-hidden border border-[#F0F0F0]">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{
                        width: barWidth > 0 ? `${Math.max(barWidth, 2)}%` : '0%',
                        backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
                        opacity: 0.85,
                      }}
                    />
                  </div>

                  {/* 人數 */}
                  <span className="text-heading text-sm font-medium w-16 text-right shrink-0">
                    {step.count.toLocaleString()}
                  </span>

                  {/* 步進轉換率 */}
                  <span className="text-heading text-sm font-medium w-20 text-right shrink-0">
                    {step.conversionRate}%
                  </span>

                  {/* 整體轉換率 */}
                  <span className="text-caption text-sm w-20 text-right shrink-0">
                    {step.overallConversionRate}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 說明 */}
        <p className="mt-4 text-xs text-caption">
          步進轉換：相對上一步的轉換率 ／ 整體轉換：相對第一步的轉換率
        </p>
      </CardContent>
    </Card>
  )
}
