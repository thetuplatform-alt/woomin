// components/main/my-subscriptions/my-subscriptions-client.tsx
// 「我的訂閱」主客戶端元件：清單、空狀態，並在取消/更新後刷新頁面資料。

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { RefreshCw, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubscriptionCard } from './subscription-card'
import type { MySubscription } from '@/lib/actions/subscriptions'

interface MySubscriptionsClientProps {
  subscriptions: MySubscription[]
  contactEmail: string
}

export function MySubscriptionsClient({
  subscriptions,
  contactEmail,
}: MySubscriptionsClientProps) {
  const router = useRouter()

  // 取消 / 更新發票後，重新拉取 server 資料
  const handleChanged = () => {
    router.refresh()
  }

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-divider bg-surface/30 py-20 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
          <RefreshCw className="h-7 w-7 text-caption" />
        </div>
        <h2 className="text-xl font-bold text-heading">尚無任何訂閱</h2>
        <p className="mt-2 max-w-sm text-body">
          您目前沒有進行中的課程訂閱。瀏覽課程並選擇訂閱方案，即可在此管理扣款與發票。
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link href="/courses">
            <BookOpen className="mr-2 h-4 w-4" />
            瀏覽課程
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {subscriptions.map((sub, index) => (
        <motion.div
          key={sub.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.06 }}
        >
          <SubscriptionCard
            subscription={sub}
            contactEmail={contactEmail}
            onChanged={handleChanged}
          />
        </motion.div>
      ))}
    </div>
  )
}
