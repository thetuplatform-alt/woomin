'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, BarChart3, Copy, Edit3, Eye, Mail, MoreHorizontal, MousePointerClick, Plus, Send, Users, Workflow, XCircle } from 'lucide-react'
import type { NewsletterAlert, NewsletterCampaign, Coupon } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatCard } from '@/components/admin/stat-card'
import { cancelNewsletter, createNewsletter, duplicateNewsletter } from '@/lib/actions/newsletters'
import type { NewsletterContent } from '@/lib/newsletter/types'
import { formatTaipeiDateTime } from '@/components/admin/newsletter/date-format'

type CampaignRow = NewsletterCampaign & { coupon?: Pick<Coupon, 'code'> | null }
type AlertRow = NewsletterAlert & { campaign?: { name: string } | null }

function statusBadge(status: NewsletterCampaign['status']) {
  const map: Record<string, string> = {
    DRAFT: '草稿',
    SCHEDULED: '排程中',
    QUEUED: '佇列中',
    SENDING: '發送中',
    PAUSED: '已暫停',
    SENT: '已發送',
    PARTIAL_FAILED: '部分失敗',
    FAILED: '失敗',
    CANCELLED: '已取消',
  }
  const className =
    status === 'SENT'
      ? 'border-green-300 bg-green-100 text-green-700'
      : status === 'SENDING'
      ? 'border-primary/20 bg-primary/10 text-primary animate-pulse'
      : status === 'FAILED'
      ? 'border-red-200 bg-red-50 text-red-700'
      : status === 'PARTIAL_FAILED' || status === 'PAUSED'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : ''
  return <Badge className={className} variant={className ? 'outline' : 'secondary'}>{map[status]}</Badge>
}

function formatDate(date: Date | null) {
  return formatTaipeiDateTime(date)
}

function getTimeInfo(campaign: CampaignRow) {
  const queuedAt = campaign.snapshotAt || campaign.scheduledAt || campaign.updatedAt
  const map: Record<string, { label: string; date: Date | null }> = {
    DRAFT: { label: '最後編輯', date: campaign.updatedAt },
    SCHEDULED: { label: '預計發送', date: campaign.scheduledAt },
    QUEUED: { label: '已排入佇列', date: queuedAt },
    SENDING: { label: '開始發送', date: campaign.snapshotAt || campaign.updatedAt },
    PAUSED: { label: '已暫停', date: campaign.updatedAt },
    SENT: { label: '發送完成', date: campaign.updatedAt },
    PARTIAL_FAILED: { label: '部分失敗', date: campaign.updatedAt },
    FAILED: { label: '發送失敗', date: campaign.updatedAt },
    CANCELLED: { label: '已取消', date: campaign.updatedAt },
  }
  return map[campaign.status] || { label: '時間', date: campaign.updatedAt }
}

function canCancel(status: NewsletterCampaign['status']) {
  return ['SCHEDULED', 'QUEUED', 'SENDING', 'PAUSED'].includes(status)
}

function getCampaignTags(campaign: CampaignRow) {
  const content = campaign.contentJson as unknown as Partial<NewsletterContent>
  const tags = Array.isArray(content.meta?.tags)
    ? content.meta.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : []
  if (tags.length) return tags.slice(0, 4)
  return [campaign.type === 'PROMO' ? '促銷' : '一般']
}

export function NewsletterList({
  campaigns,
  stats,
  alerts,
}: {
  campaigns: CampaignRow[]
  stats: { _sum: { sentCount: number | null; openCount: number | null; clickCount: number | null }; _count: number }
  alerts: AlertRow[]
}) {
  const router = useRouter()
  const sent = stats._sum.sentCount || 0
  const openRate = sent ? `${Math.round(((stats._sum.openCount || 0) / sent) * 100)}%` : '—'
  const clickRate = sent ? `${Math.round(((stats._sum.clickCount || 0) / sent) * 100)}%` : '—'

  async function handleCreate() {
    const result = await createNewsletter({})
    if (result.success && result.data) {
      router.push(`/admin/newsletters/${result.data.id}/edit`)
    } else {
      alert(result.error)
    }
  }

  async function handleDuplicate(id: string) {
    const result = await duplicateNewsletter(id)
    if (result.success && result.data) router.push(`/admin/newsletters/${result.data.id}/edit`)
    else alert(result.error)
  }

  async function handleCancel(campaign: CampaignRow) {
    const message = campaign.status === 'SENDING'
      ? '確定要取消發送？已經寄出的 email 無法收回，但會停止後續尚未寄出的收件人。'
      : '確定要取消這封電子報的發送？'
    if (!window.confirm(message)) return

    const result = await cancelNewsletter(campaign.id)
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-6 flex items-center justify-between border-b bg-background/95 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="text-xl font-bold text-foreground">電子報</h1>
          <p className="text-sm text-muted-foreground">撰寫、分眾、排程與追蹤你的學員溝通。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/newsletters/automations">
              <Workflow className="h-4 w-4" />
              自動化流程
            </Link>
          </Button>
          <Button variant="cta" onClick={handleCreate}>
            <Send className="h-4 w-4" />
            新增電子報
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="活動總數" value={stats._count} icon={Mail} description="草稿、排程與已發送" />
        <StatCard title="已送出封數" value={sent.toLocaleString()} icon={Send} description="不含測試信" />
        <StatCard title="平均開信率" value={openRate} icon={Users} description="Apple MPP 可能高估" />
        <StatCard title="平均點擊率" value={clickRate} icon={MousePointerClick} description="以追蹤連結計算" />
      </div>

      {alerts.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              電子報送達率與發送告警
            </div>
            <div className="grid gap-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-md border border-amber-200 bg-white/70 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{alert.title}</p>
                    <Badge variant={alert.type === 'ERROR' ? 'destructive' : 'outline'}>{alert.type}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{alert.message}</p>
                  {alert.campaign?.name ? <p className="mt-1 text-xs text-amber-800">Campaign：{alert.campaign.name}</p> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {campaigns.length === 0 ? (
        <Card className="border-dashed bg-white">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Mail className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-foreground">還沒有電子報</h2>
              <p className="mt-1 text-sm text-muted-foreground">寫一封信，和你的學員保持聯繫。</p>
            </div>
            <div className="flex gap-2">
              <Button variant="cta" onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                撰寫電子報
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>主旨</TableHead>
                <TableHead>標籤</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>受眾</TableHead>
                <TableHead>成效</TableHead>
                <TableHead>時間</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const timeInfo = getTimeInfo(campaign)
                return (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/admin/newsletters/${campaign.id}/edit`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={campaign.type === 'PROMO' ? 'h-10 w-1 rounded-full bg-cta' : 'h-10 w-1 rounded-full bg-primary'} />
                        <div>
                          <p className="max-w-md truncate font-medium text-foreground">{campaign.subject || '未命名主旨'}</p>
                          <p className="max-w-md truncate text-xs text-muted-foreground">內部名稱：{campaign.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-48 flex-wrap gap-1.5">
                        {getCampaignTags(campaign).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className={tag === '促銷' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-primary/20 bg-primary/10 text-primary'}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(campaign.status)}</TableCell>
                    <TableCell className="font-mono text-sm">{campaign.totalRecipients.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1" title="開信">
                          <Eye className="h-4 w-4" />
                          {campaign.openCount}
                        </span>
                        <span className="inline-flex items-center gap-1" title="點擊">
                          <MousePointerClick className="h-4 w-4" />
                          {campaign.clickCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <p className="font-medium text-foreground">{timeInfo.label}</p>
                        <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{formatDate(timeInfo.date)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()} aria-label="更多操作">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenuItem onClick={() => router.push(`/admin/newsletters/${campaign.id}/edit`)}>
                            <Edit3 className="h-4 w-4" />
                            編輯
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(campaign.id)}>
                            <Copy className="h-4 w-4" />
                            複製為新信
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/admin/newsletters/${campaign.id}/report`)}>
                            <BarChart3 className="h-4 w-4" />
                            查看成效
                          </DropdownMenuItem>
                          {canCancel(campaign.status) ? (
                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleCancel(campaign)}>
                              <XCircle className="h-4 w-4" />
                              取消發送
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
