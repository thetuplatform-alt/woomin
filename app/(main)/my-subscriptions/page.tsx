// app/(main)/my-subscriptions/page.tsx
// 「我的訂閱」頁面（AC-54~AC-58）
// 需登入；逐狀態顯示訂閱卡片、期款歷史、取消與發票偏好管理。

import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getMySubscriptions } from '@/lib/actions/subscriptions'
import { MySubscriptionsClient } from '@/components/main/my-subscriptions/my-subscriptions-client'

export const metadata: Metadata = {
  title: '我的訂閱 | 課程平台',
  description: '管理您的課程訂閱、扣款與發票資訊',
}

export default async function MySubscriptionsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/my-subscriptions')
  }

  const { subscriptions, contactEmail } = await getMySubscriptions()

  return (
    <div className="min-h-screen bg-white">
      {/* 頁面標題區 */}
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-heading sm:text-5xl">
            我的訂閱
          </h1>
          <p className="mt-4 text-lg text-body">
            管理您的課程訂閱、扣款狀態與發票資訊
          </p>
        </div>
      </section>

      {/* 主要內容區 */}
      <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        <MySubscriptionsClient
          subscriptions={subscriptions}
          contactEmail={contactEmail}
        />
      </div>
    </div>
  )
}
