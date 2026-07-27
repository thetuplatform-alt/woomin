// app/(main)/checkout/failed/page.tsx
// 付款失敗頁面

import { Metadata } from 'next'
import Link from 'next/link'
import { XCircle, RefreshCw, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getPostHogClient } from '@/lib/posthog-server'
import { getPublicSiteSettings } from '@/lib/site-settings-public'

export const metadata: Metadata = {
  title: '付款失敗 | 課程平台',
  description: '付款處理失敗',
}

interface FailedPageProps {
  searchParams: Promise<{
    orderNo?: string
  }>
}

export default async function FailedPage({ searchParams }: FailedPageProps) {
  const { orderNo } = await searchParams
  const { contactEmail } = await getPublicSiteSettings()

  // 查詢訂單資訊
  let order = null
  let course = null

  // 需要驗證身份才能查看訂單詳情，防止 orderNo 枚舉攻擊
  const session = await auth()

  if (orderNo && session?.user?.id) {
    order = await prisma.order.findFirst({
      where: {
        orderNo,
        userId: session.user.id,
      },
      select: {
        id: true,
        orderNo: true,
        amount: true,
        status: true,
        courseId: true,
      },
    })

    if (order?.courseId) {
      course = await prisma.course.findUnique({
        where: { id: order.courseId },
        select: {
          id: true,
          title: true,
          slug: true,
        },
      })

      // PostHog: Track payment failure on server side
      const posthog = await getPostHogClient()
      if (posthog) posthog.capture({
        distinctId: session.user.id,
        event: 'payment_failed',
        properties: {
          order_id: order.id,
          order_no: order.orderNo,
          course_id: order.courseId,
          course_title: course?.title,
          course_slug: course?.slug,
          amount: order.amount,
          currency: 'TWD',
          order_status: order.status,
          failure_reason: order.status === 'FAILED' ? 'transaction_failed' : 'incomplete_payment',
        },
      })
    }
  }

  return (
    <div className="min-h-screen bg-white py-12 sm:py-24">
      <div className="mx-auto px-4 max-w-xl">
        <div>
          <div className="rounded-2xl border border-divider bg-white p-8 sm:p-12 text-center shadow-none">
            {/* 失敗圖示 */}
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-8">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>

            {/* 標題 */}
            <h1 className="text-3xl font-bold tracking-tight text-heading mb-3">
              付款失敗
            </h1>
            <p className="text-body mb-10">
              很抱歉，在處理您的付款請求時發生了問題
            </p>

            {/* 訂單資訊 */}
            {order && (
              <div className="bg-surface rounded-2xl p-6 mb-8 text-left space-y-4 border border-surface-hover">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-caption">訂單編號</span>
                  <span className="text-heading font-mono text-xs font-medium">{order.orderNo}</span>
                </div>
                {course && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-caption">購買商品</span>
                    <span className="text-heading font-medium text-sm">{course.title}</span>
                  </div>
                )}
                <div className="h-px bg-divider my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-caption">訂單狀態</span>
                  <span className="text-red-500 font-bold text-sm">
                    {order.status === 'FAILED' ? '交易失敗' : '未完成付款'}
                  </span>
                </div>
              </div>
            )}

            {/* 可能原因 */}
            <div className="text-left bg-surface rounded-2xl p-6 mb-10 border border-surface-hover">
              <h3 className="text-heading font-semibold text-sm mb-3">常見失敗原因：</h3>
              <ul className="text-sm text-body space-y-2">
                <li className="flex items-start gap-2">
                  <div className="h-1 w-1 rounded-full bg-caption mt-2" />
                  <span>信用卡資訊輸入有誤</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1 w-1 rounded-full bg-caption mt-2" />
                  <span>卡片餘額不足或已過期</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1 w-1 rounded-full bg-caption mt-2" />
                  <span>發卡銀行拒絕此筆交易</span>
                </li>
              </ul>
            </div>

            {/* 操作按鈕 */}
            <div className="space-y-4">
              {course ? (
                <Button
                  asChild
                  className="w-full rounded-full bg-cta hover:bg-cta-hover text-white py-8 text-lg font-bold transition-all"
                >
                  <Link href={`/checkout?courseId=${course.id}`}>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    重新嘗試付款
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  className="w-full rounded-full bg-cta hover:bg-cta-hover text-white py-8 text-lg font-bold"
                >
                  <Link href="/">
                    返回首頁重試
                  </Link>
                </Button>
              )}

              <Button
                asChild
                variant="ghost"
                className="w-full text-body hover:text-heading hover:bg-surface py-6 rounded-full"
              >
                <Link href="/">
                  返回首頁
                </Link>
              </Button>
            </div>

            {/* 客服資訊 */}
            <div className="mt-12 pt-8 border-t border-divider flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-caption text-sm">
                <HelpCircle className="h-4 w-4" />
                <span>遇到付款困難？</span>
              </div>
              <p className="text-sm text-body">
                請來信與我們聯繫：
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-cta font-medium hover:underline ml-1"
                >
                  {contactEmail}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
