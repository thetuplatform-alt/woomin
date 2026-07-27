import Link from 'next/link'
import { getNewsletterReport } from '@/lib/actions/newsletters'
import { StatCard } from '@/components/admin/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Eye, Mail, MousePointerClick, ShoppingCart, Users } from 'lucide-react'

export const metadata = {
  title: '電子報成效 | 後台管理',
}

function pct(part: number, total: number) {
  if (!total) return '—'
  return `${Math.round((part / total) * 100)}%`
}

export default async function NewsletterReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const campaign = await getNewsletterReport(id)
  const delivered = campaign.sentCount
  const openRate = pct(campaign.openCount, delivered)
  const clickRate = pct(campaign.clickCount, delivered)
  const ctor = pct(campaign.clickCount, campaign.openCount)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Button variant="ghost" asChild>
            <Link href="/admin/newsletters"><ArrowLeft className="h-4 w-4" />返回列表</Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
            <Badge className={campaign.type === 'PROMO' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-primary/20 bg-primary/10 text-primary'} variant="outline">
              {campaign.type === 'PROMO' ? '促銷' : '一般'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{campaign.subject}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="已寄出" value={delivered.toLocaleString()} icon={<Mail className="h-4 w-4 text-caption" />} description={`失敗 ${campaign.failedCount}，略過 ${campaign.skippedCount}`} />
        <StatCard title="開信率" value={openRate} icon={<Eye className="h-4 w-4 text-caption" />} description="Apple MPP 與 Gmail proxy 可能高估" />
        <StatCard title="點擊率" value={clickRate} icon={<MousePointerClick className="h-4 w-4 text-caption" />} description={`CTOR ${ctor}`} />
        <StatCard title="退訂" value={campaign.unsubCount.toLocaleString()} icon={<Users className="h-4 w-4 text-caption" />} description="依 campaign 歸因" />
      </div>

      {campaign.type === 'PROMO' ? (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="歸因訂單" value={campaign.orders.length} icon={<ShoppingCart className="h-4 w-4 text-caption" />} description="last-touch，預設 7 天窗口" />
          <StatCard title="歸因營收" value={`NT$ ${campaign.orders.reduce((sum, order) => sum + order.amount, 0).toLocaleString()}`} icon={<ShoppingCart className="h-4 w-4 text-caption" />} description="同訂單只計一次" />
          <StatCard title="RPE" value={delivered ? `NT$ ${Math.round(campaign.orders.reduce((sum, order) => sum + order.amount, 0) / delivered)}` : '—'} icon={<ShoppingCart className="h-4 w-4 text-caption" />} description="Revenue per Email" />
        </div>
      ) : null}

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-base">連結點擊分布</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.links.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              啟用追蹤後顯示成效。未啟用追蹤時不顯示假數據。
            </div>
          ) : (
            <div className="space-y-3">
              {campaign.links.map((link) => (
                <div key={link.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-foreground">{link.targetUrl}</p>
                    <p className="font-mono text-sm">{link.clickCount} clicks</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
