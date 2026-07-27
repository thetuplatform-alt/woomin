// app/(admin)/admin/subscriptions/[id]/page.tsx
// 訂閱詳情頁：訂戶、方案快照、期款 Order 歷史、consent 證據、gateway 識別碼、
// 代取消、PAYUNi reauth、發票偏好編輯。

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSubscriptionById } from '@/lib/actions/subscriptions-admin'
import { SubscriptionDetailCard } from '@/components/admin/subscriptions/subscription-detail-card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface SubscriptionDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: SubscriptionDetailPageProps) {
  const { id } = await params
  const sub = await getSubscriptionById(id)
  if (!sub) return { title: '訂閱不存在' }
  return { title: `訂閱 · ${sub.course?.title ?? id}` }
}

export default async function SubscriptionDetailPage({
  params,
}: SubscriptionDetailPageProps) {
  const { id } = await params
  const subscription = await getSubscriptionById(id)

  if (!subscription) {
    notFound()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-body hover:text-heading hover:bg-surface"
        >
          <Link href="/admin/subscriptions">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回訂閱列表
          </Link>
        </Button>
      </div>

      <SubscriptionDetailCard subscription={subscription} />
    </div>
  )
}
