'use client'

// app/(admin)/admin/courses/[id]/analytics/analytics-charts.tsx
// 課程分析頁的 recharts 圖表元件，獨立成模組供 page-client.tsx 以 next/dynamic 動態載入，
// 把 recharts（含 d3 依賴）移出此頁初始 JS chunk，進頁時外殼/統計卡片先呈現、圖表背景載入。

import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type {
  CourseDailySales,
  CoursePaymentStats,
  ProgressDistribution,
  LessonCompletionData,
} from '@/lib/actions/course-analytics'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const PIE_COLORS = ['#F5A524', '#525252', '#A3A3A3', '#D4D4D4', '#E5E5E5']

const BAR_COLORS = [
  '#FECACA', // 尚未開始 - 淺紅
  '#FED7AA', // 1-25%
  '#FEF08A', // 26-50%
  '#BBF7D0', // 51-75%
  '#A5F3FC', // 76-99%
  '#86EFAC', // 已完成 - 綠色
]

export function DailySalesAreaChart({ data }: { data: CourseDailySales[] }) {
  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F5A524" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F5A524" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(new Date(date), 'MM/dd')}
            stroke="#A3A3A3"
            fontSize={12}
          />
          <YAxis
            stroke="#A3A3A3"
            fontSize={12}
            tickFormatter={(value) => (value >= 1000 ? `${value / 1000}k` : value)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length || !label) return null
              return (
                <div className="bg-white border border-divider rounded-lg p-3 shadow-lg">
                  <p className="text-sm font-medium text-heading mb-1">
                    {format(new Date(label as string), 'yyyy/MM/dd', { locale: zhTW })}
                  </p>
                  <p className="text-sm text-body">
                    營收: {formatCurrency(payload[0].value as number)}
                  </p>
                  <p className="text-sm text-body">訂單: {payload[1]?.value || 0} 筆</p>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#F5A524"
            strokeWidth={2}
            fill="url(#colorRevenue)"
          />
          <Line type="monotone" dataKey="orders" stroke="#525252" strokeWidth={2} dot={false} yAxisId={1} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ProgressDistributionBarChart({ data }: { data: ProgressDistribution[] }) {
  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" horizontal />
          <XAxis type="number" stroke="#A3A3A3" fontSize={12} />
          <YAxis type="category" dataKey="range" stroke="#A3A3A3" fontSize={12} width={80} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as ProgressDistribution
              return (
                <div className="bg-white border border-divider rounded-lg p-3 shadow-lg">
                  <p className="text-sm font-medium text-heading mb-1">{d.range}</p>
                  <p className="text-sm text-body">學員數: {d.count} 人</p>
                  <p className="text-sm text-body">佔比: {d.percentage}%</p>
                </div>
              )
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={BAR_COLORS[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LessonCompletionLineChart({ data }: { data: LessonCompletionData[] }) {
  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
          <XAxis
            dataKey="order"
            stroke="#A3A3A3"
            fontSize={12}
            label={{ value: '單元順序', position: 'insideBottom', offset: -5, fill: '#A3A3A3', fontSize: 12 }}
          />
          <YAxis
            stroke="#A3A3A3"
            fontSize={12}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as LessonCompletionData
              return (
                <div className="bg-white border border-divider rounded-lg p-3 shadow-lg max-w-[250px]">
                  <p className="text-xs text-caption mb-1">{d.chapterTitle}</p>
                  <p className="text-sm font-medium text-heading mb-2 truncate">{d.lessonTitle}</p>
                  <p className="text-sm text-body">完成率: {d.completionRate}%</p>
                  <p className="text-sm text-body">
                    {d.completedCount} / {d.totalStudents} 人
                  </p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="completionRate"
            stroke="#F5A524"
            strokeWidth={2}
            dot={{ fill: '#F5A524', strokeWidth: 2, r: 3 }}
            activeDot={{ r: 6, fill: '#F5A524' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PaymentMethodPieChart({ data }: { data: CoursePaymentStats[] }) {
  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.map((stat) => ({
              name: stat.label,
              value: stat.count,
              percentage: stat.percentage,
              revenue: stat.revenue,
            }))}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
            nameKey="name"
            label={({ name, payload }) => `${name} ${(payload as { percentage: number })?.percentage || 0}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as {
                name: string
                value: number
                percentage: number
                revenue: number
              }
              return (
                <div className="bg-white border border-divider rounded-lg p-3 shadow-lg">
                  <p className="text-sm font-medium text-heading mb-1">{d.name}</p>
                  <p className="text-sm text-body">訂單數: {d.value} 筆</p>
                  <p className="text-sm text-body">金額: {formatCurrency(d.revenue)}</p>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
