'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, MailCheck, Plus, Send, Workflow } from 'lucide-react'
import type { listNewsletterAutomations } from '@/lib/actions/newsletter-automations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatCard } from '@/components/admin/stat-card'
import { formatTaipeiDateTime } from '@/components/admin/newsletter/date-format'

type AutomationListData = Awaited<ReturnType<typeof listNewsletterAutomations>>

function formatDelay(delayDays: number, delayHours: number) {
  if (delayDays === 0 && delayHours === 0) return '立即'
  const parts = []
  if (delayDays > 0) parts.push(`${delayDays} 天`)
  if (delayHours > 0) parts.push(`${delayHours} 小時`)
  return parts.join(' ')
}

export function NewsletterAutomationList({
  automations,
  stats,
}: AutomationListData) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-6 flex items-center justify-between border-b bg-background/95 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="text-xl font-bold text-foreground">電子報</h1>
          <p className="text-sm text-muted-foreground">廣播信與購課後自動化跟進。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/newsletters">
              <Send className="h-4 w-4" />
              廣播信
            </Link>
          </Button>
          <Button variant="cta" asChild>
            <Link href="/admin/newsletters/automations/new">
              <Plus className="h-4 w-4" />
              新增流程
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="流程總數" value={stats.automations} icon={Workflow} description="已建立的自動化流程" />
        <StatCard title="啟用中" value={stats.enabled} icon={MailCheck} description="購課後會自動加入" />
        <StatCard title="加入人次" value={stats.enrollments} icon={BookOpen} description="已觸發的學員流程" />
        <StatCard title="已寄出" value={stats.sent} icon={Send} description="automation 成功寄送數" />
      </div>

      {automations.length === 0 ? (
        <Card className="border-dashed bg-white">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Workflow className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-foreground">還沒有自動化流程</h2>
              <p className="mt-1 text-sm text-muted-foreground">建立一組購課後會自動寄出的跟進信。</p>
            </div>
            <Button variant="cta" asChild>
              <Link href="/admin/newsletters/automations/new">
                <Plus className="h-4 w-4" />
                新增流程
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>流程</TableHead>
                <TableHead>綁定課程</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>步驟</TableHead>
                <TableHead>加入人次</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((automation) => (
                <TableRow
                  key={automation.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => router.push(`/admin/newsletters/automations/${automation.id}/edit`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{automation.name}</p>
                      <p className="text-xs text-muted-foreground">最後更新：{formatTaipeiDateTime(automation.updatedAt)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{automation.course.title}</p>
                      <p className="text-xs text-muted-foreground">/courses/{automation.course.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={automation.enabled ? 'default' : 'secondary'}>
                      {automation.enabled ? '啟用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-72 flex-wrap gap-1.5">
                      {automation.steps.map((step, index) => (
                        <Badge key={step.id} variant="outline" className={step.enabled ? 'border-primary/20 bg-primary/10 text-primary' : ''}>
                          {index + 1}. {formatDelay(step.delayDays, step.delayHours)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{automation._count.enrollments.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        router.push(`/admin/newsletters/automations/${automation.id}/edit`)
                      }}
                    >
                      編輯
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
