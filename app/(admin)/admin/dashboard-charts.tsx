'use client'

// app/(admin)/admin/dashboard-charts.tsx
// 儀表板的 recharts 圖表元件，獨立成一個模組，供 page-client.tsx 以 next/dynamic 動態載入。
// 目的：把 recharts（含 d3 依賴，體積龐大）移出 admin route 的初始 JS chunk，
// 首次進儀表板不再被整包圖表程式碼下載/解析阻塞，圖表在背景載入完成後才出現。

import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  LineChart, Line, AreaChart, Area, Bar, ComposedChart,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type {
  DailySales,
  PaymentMethodStats,
  UserGrowthData,
  DailyActiveUsers,
} from '@/lib/actions/analytics'

// ─── 工具函式（圖表專用）───

function formatAmount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}萬`
  return value.toLocaleString()
}

function formatXLabel(dateStr: string): string {
  // hourly: "2026-03-09 14:00" → "14:00"
  if (dateStr.includes(' ')) return dateStr.split(' ')[1]
  // daily/weekly: "2026-03-09" → "03/09"
  return format(new Date(dateStr), 'MM/dd')
}

function formatTooltipDate(dateStr: string): string {
  if (dateStr.includes(' ')) {
    const [d, t] = dateStr.split(' ')
    return `${format(new Date(d), 'yyyy年MM月dd日', { locale: zhTW })} ${t}`
  }
  return format(new Date(dateStr), 'yyyy年MM月dd日', { locale: zhTW })
}

const PIE_COLORS = ['#F5A524', '#525252', '#A3A3A3', '#E5E5E5', '#0A0A0A']

// ─── Tooltip 元件 ───

function SalesTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-divider rounded-xl p-3">
      <p className="text-heading text-sm mb-2 font-medium">{formatTooltipDate(label || '')}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-body text-sm">{entry.name === 'revenue' ? '營收' : '訂單數'}:</span>
          <span className="text-heading font-medium text-sm">
            {entry.name === 'revenue' ? `NT$ ${entry.value.toLocaleString()}` : `${entry.value} 筆`}
          </span>
        </div>
      ))}
    </div>
  )
}

function GrowthTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-divider rounded-xl p-3">
      <p className="text-heading text-sm mb-2 font-medium">{formatTooltipDate(label || '')}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-body text-sm">{entry.name === 'newUsers' ? '新增用戶' : '累計用戶'}:</span>
          <span className="text-heading font-medium text-sm">{entry.value} 人</span>
        </div>
      ))}
    </div>
  )
}

function DAUTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-divider rounded-xl p-3">
      <p className="text-heading text-sm mb-1 font-medium">{formatTooltipDate(label || '')}</p>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-cta" />
        <span className="text-body text-sm">學習人數:</span>
        <span className="text-heading font-medium text-sm">{payload[0].value} 人</span>
      </div>
    </div>
  )
}

// ─── 圖表元件 ───

export function SalesTrendChart({ data }: { data: DailySales[] }) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
          <XAxis dataKey="date" tickFormatter={formatXLabel} stroke="#A3A3A3" fontSize={12} />
          <YAxis yAxisId="revenue" orientation="left" tickFormatter={formatAmount} stroke="#A3A3A3" fontSize={12} />
          <YAxis yAxisId="orders" orientation="right" stroke="#A3A3A3" fontSize={12} />
          <Tooltip content={<SalesTooltip />} />
          <Legend formatter={(v) => <span className="text-body text-sm">{v === 'revenue' ? '營收' : '訂單數'}</span>} />
          <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="revenue" stroke="#F5A524" strokeWidth={2} dot={{ fill: '#F5A524', strokeWidth: 2, r: 3 }} activeDot={{ r: 5, fill: '#F5A524' }} />
          <Line yAxisId="orders" type="monotone" dataKey="orders" name="orders" stroke="#525252" strokeWidth={2} dot={{ fill: '#525252', strokeWidth: 2, r: 3 }} activeDot={{ r: 5, fill: '#525252' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PaymentPieChart({ data }: { data: PaymentMethodStats[] }) {
  const pieChartData = data.map((item) => ({
    method: item.method, label: item.label, count: item.count, percentage: item.percentage,
  }))
  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieChartData} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}
            label={({ payload }) => `${(payload as { percentage: number }).percentage}%`} labelLine={false}>
            {pieChartData.map((_, i) => <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />)}
          </Pie>
          <Tooltip content={({ active, payload: tp }) => {
            if (!active || !tp?.length) return null
            const d = tp[0].payload as PaymentMethodStats
            return (
              <div className="bg-white border border-divider rounded-xl p-3">
                <p className="text-heading font-medium mb-1">{d.label}</p>
                <p className="text-body text-sm">訂單數: <span className="text-heading">{d.count} 筆</span></p>
                <p className="text-body text-sm">佔比: <span className="text-heading">{d.percentage}%</span></p>
              </div>
            )
          }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function UserGrowthChart({ data }: { data: UserGrowthData[] }) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F5A524" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#F5A524" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
          <XAxis dataKey="date" tickFormatter={formatXLabel} stroke="#A3A3A3" fontSize={12} />
          <YAxis yAxisId="cumulative" orientation="left" stroke="#A3A3A3" fontSize={12} />
          <YAxis yAxisId="daily" orientation="right" stroke="#A3A3A3" fontSize={12} />
          <Tooltip content={<GrowthTooltip />} />
          <Area yAxisId="cumulative" type="monotone" dataKey="cumulativeUsers" name="cumulativeUsers" stroke="#F5A524" strokeWidth={2} fill="url(#colorCumulative)" />
          <Bar yAxisId="daily" dataKey="newUsers" name="newUsers" fill="#525252" radius={[2, 2, 0, 0]} barSize={12} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DauChart({ data }: { data: DailyActiveUsers[] }) {
  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorDAU" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F5A524" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#F5A524" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
          <XAxis dataKey="date" tickFormatter={formatXLabel} stroke="#A3A3A3" fontSize={12} />
          <YAxis stroke="#A3A3A3" fontSize={12} />
          <Tooltip content={<DAUTooltip />} />
          <Area type="monotone" dataKey="activeUsers" stroke="#F5A524" strokeWidth={2} fill="url(#colorDAU)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
