'use client'

import Link from 'next/link'
import { ExternalLink, Pencil, Plus, Wrench } from 'lucide-react'
import type { AdminToolListItem, ToolFormOptions } from '@/lib/actions/admin-tools'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const lifecycleLabels = {
  DRAFT: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  PUBLISHED: { label: '已發布', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  DISABLED: { label: '已停用', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  ARCHIVED: { label: '已封存', className: 'border-slate-300 bg-slate-100 text-slate-600' },
} as const

const typeLabels = {
  WEB_APP: 'Web App',
  SKILL: 'Skill',
  AI_TOOL: 'AI Tool',
  SAAS: 'SaaS',
} as const

const pricingLabels = {
  FREE: '免費',
  PAID: '付費',
  INCLUDED: '方案內含',
  COMING_SOON: '即將推出',
} as const

interface ToolListProps {
  tools: AdminToolListItem[]
  options: ToolFormOptions
  filters: { search?: string; seriesId?: string; type?: string; lifecycle?: string }
}
export function ToolList({ tools, options, filters }: ToolListProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tool Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理 BestAppStore 的 App、Web App、Skill 與 AI Tool 資料。
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/tools/new"><Plus className="mr-2 h-4 w-4" />新增 Tool</Link>
        </Button>
      </div>

      <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-5" method="get">
        <input
          className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
          defaultValue={filters.search}
          name="search"
          placeholder="搜尋名稱或 slug"
        />
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={filters.seriesId || ''} name="seriesId">
          <option value="">全部系列</option>
          {options.series.map((series) => <option key={series.id} value={series.id}>{series.name}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={filters.type || ''} name="type">
          <option value="">全部類型</option>
          <option value="WEB_APP">Web App</option>
          <option value="SKILL">Skill</option>
          <option value="AI_TOOL">AI Tool</option>
          <option value="SAAS">SaaS</option>
        </select>
        <div className="flex gap-2">
          <select className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" defaultValue={filters.lifecycle || ''} name="lifecycle">
            <option value="">全部狀態</option>
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已發布</option>
            <option value="DISABLED">已停用</option>
            <option value="ARCHIVED">已封存</option>
          </select>
          <Button type="submit" variant="outline">篩選</Button>
        </div>
      </form>

      {tools.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border p-12 text-center">
          <Wrench className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">沒有符合條件的 Tool</h2>
          <p className="mt-2 text-sm text-muted-foreground">新增第一個 Tool，或調整目前的篩選條件。</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工具</TableHead>
                <TableHead>系列／分類</TableHead>
                <TableHead>類型／Runtime</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>Featured／排序</TableHead>
                <TableHead>價格／權限</TableHead>
                <TableHead>更新</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((tool) => {
                const lifecycle = lifecycleLabels[tool.lifecycle]
                return (
                  <TableRow key={tool.id}>
                    <TableCell>
                      <div className="flex min-w-52 items-center gap-3">
                        {tool.thumbnail && (/^https:\/\//.test(tool.thumbnail) || tool.thumbnail.startsWith('/')) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" className="h-12 w-16 rounded-md border object-cover" src={tool.thumbnail} />
                        ) : (
                          <div className="flex h-12 w-16 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">artwork</div>
                        )}
                        <div>
                          <p className="font-medium">{tool.name}</p>
                          <p className="text-xs text-muted-foreground">{tool.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><p>{tool.series.name}</p><p className="text-xs text-muted-foreground">{tool.category}</p></TableCell>
                    <TableCell><p>{typeLabels[tool.type]}</p><p className="text-xs text-muted-foreground">{tool.runtimeType}</p></TableCell>
                    <TableCell><Badge className={lifecycle.className} variant="outline">{lifecycle.label}</Badge></TableCell>
                    <TableCell>
                      <p>{tool.isFeatured ? `Featured #${tool.featuredOrder ?? '—'}` : '—'}</p>
                      <p className="text-xs text-muted-foreground">工具 #{tool.displayOrder}</p>
                    </TableCell>
                    <TableCell>
                      <p>{pricingLabels[tool.pricingType]}{tool.price != null ? ` ${tool.price}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{tool.requiredEntitlement?.code ?? '無 entitlement'}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(tool.updatedAt).toLocaleDateString('zh-TW')}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {tool.lifecycle === 'PUBLISHED' && (
                          <Button asChild size="icon" variant="ghost">
                            <Link href={`/lumi-series/${tool.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                        )}
                        <Button asChild size="icon" variant="ghost">
                          <Link href={`/admin/tools/${tool.id}`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
