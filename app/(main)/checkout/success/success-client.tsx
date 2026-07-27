'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, ArrowRight, Loader2, Clock3, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetaPixelPurchase } from '@/components/common/meta-pixel-events'

interface OrderStatusResponse {
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
  amount: number
  courseId: string | null
  bundleId: string | null
  paidAt: string | null
  isGuest: boolean
  guestEmail?: string | null
  paymentInstructions: {
    provider: 'shopline'
    method: 'ATM'
    bankCode: string | null
    bankName: string | null
    virtualAccount: string | null
    amount: number | null
    currency: string | null
    expiresAt: string | null
    message: string | null
  } | null
  subscription: {
    status: string
    nextBillingAt: string | null
    planLabel: string | null
  } | null
  course: {
    title: string
    slug: string
    firstLessonId: string | null
  } | null
  bundle: {
    title: string
    slug: string
    firstCourseSlug: string | null
    firstLessonId: string | null
  } | null
}

interface SuccessClientProps {
  orderNo: string
}

const POLL_INTERVAL_MS = 2000
const MAX_POLL_COUNT = 15 // 最多等 30 秒

export function SuccessClient({ orderNo }: SuccessClientProps) {
  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null)
  const [, setPollCount] = useState(0)
  const [isPolling, setIsPolling] = useState(true)

  useEffect(() => {
    if (!orderNo) return

    let timeoutId: ReturnType<typeof setTimeout>

    async function poll() {
      try {
        const res = await fetch(`/api/payment/order-status?orderNo=${orderNo}`)
        if (!res.ok) {
          setIsPolling(false)
          return
        }
        const data: OrderStatusResponse = await res.json()
        setOrderStatus(data)

        if (data.status === 'PAID' || data.status === 'FAILED' || data.status === 'CANCELLED') {
          setIsPolling(false)
          return
        }

        setPollCount((prev) => {
          const next = prev + 1
          if (next >= MAX_POLL_COUNT) {
            setIsPolling(false)
            return next
          }
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
          return next
        })
      } catch {
        setIsPolling(false)
      }
    }

    poll()

    return () => clearTimeout(timeoutId)
  }, [orderNo])

  const isPaid = orderStatus?.status === 'PAID'
  const isFailure =
    orderStatus?.status === 'FAILED' ||
    orderStatus?.status === 'CANCELLED' ||
    orderStatus?.status === 'REFUNDED'
  const isTimedOut = !isPolling && orderStatus?.status === 'PENDING'
  const isPending = orderStatus?.status === 'PENDING'
  const paymentInstructions = orderStatus?.paymentInstructions ?? null
  const course = orderStatus?.course
  const bundle = orderStatus?.bundle
  const productTitle = course?.title || bundle?.title
  const isGuest = orderStatus?.isGuest ?? false
  const guestEmail = orderStatus?.guestEmail ?? null
  const subscription = orderStatus?.subscription ?? null
  const isSubscription = subscription !== null
  const nextBillingText = subscription?.nextBillingAt
    ? new Date(subscription.nextBillingAt).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const startLearningHref =
    course?.firstLessonId
      ? `/courses/${course.slug}/lessons/${course.firstLessonId}`
      : course
        ? `/courses/${course.slug}`
        : bundle?.firstCourseSlug && bundle.firstLessonId
          ? `/courses/${bundle.firstCourseSlug}/lessons/${bundle.firstLessonId}`
          : bundle?.firstCourseSlug
            ? `/courses/${bundle.firstCourseSlug}`
        : '/'
  const headingText = !orderStatus
    ? '確認付款狀態中'
    : isPending
      ? isSubscription
        ? '訂閱處理中'
        : '等待 ATM 轉帳付款'
      : isPaid
        ? isSubscription
          ? '訂閱已生效！'
          : '付款成功！'
        : '付款未完成'
  const descriptionText = !orderStatus
    ? '正在取得訂單狀態，請稍候'
    : isPending
      ? isSubscription
        ? '訂閱處理中，稍後可至「我的訂閱」查看狀態'
        : '請依下方資訊完成轉帳，系統收到付款通知後會自動開通課程'
      : isPaid
        ? isSubscription
          ? nextBillingText
            ? `訂閱已生效，下次扣款日為 ${nextBillingText}`
            : '訂閱已生效，課程內容已為您即刻解鎖'
          : '感謝您的購買，課程內容已為您即刻解鎖'
        : '付款尚未完成，請重新結帳或聯繫客服確認'

  return (
    <div className="min-h-screen bg-white py-12 sm:py-24">
      {/* Meta Pixel Purchase 轉換事件（付款確認後才觸發） */}
      {isPaid && orderStatus && (
        <MetaPixelPurchase
          value={orderStatus.amount}
          contentName={productTitle}
          contentId={orderStatus.courseId ?? orderStatus.bundleId ?? undefined}
          eventId={orderNo}
        />
      )}

      <div className="mx-auto px-4 max-w-xl">
        <div className="rounded-2xl border border-divider bg-white p-8 sm:p-12 text-center shadow-none">
          {/* 成功圖示 */}
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 ${
              isFailure
                ? 'bg-red-50'
                : !orderStatus || isPending
                  ? 'bg-amber-50'
                  : 'bg-green-50'
            }`}
          >
            {isFailure ? (
              <AlertCircle className="h-10 w-10 text-red-500" />
            ) : !orderStatus || isPending ? (
              <Clock3 className="h-10 w-10 text-amber-500" />
            ) : (
              <CheckCircle className="h-10 w-10 text-green-500" />
            )}
          </div>

          {/* 標題 */}
          <h1 className="text-3xl font-bold tracking-tight text-heading mb-3">
            {headingText}
          </h1>
          <p className="text-body mb-10">
            {descriptionText}
          </p>

          {/* 訂單資訊 */}
          {orderStatus && (
            <div className="bg-surface rounded-2xl p-6 mb-10 text-left space-y-4 border border-surface-hover">
              <div className="flex justify-between items-center">
                <span className="text-sm text-caption">訂單編號</span>
                <span className="text-heading font-mono text-xs font-medium">{orderNo}</span>
              </div>
              {productTitle && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-caption">商品明細</span>
                  <span className="text-heading font-medium text-sm">{productTitle}</span>
                </div>
              )}
              <div className="h-px bg-divider my-2" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-caption">
                  {isSubscription ? '本期扣款' : '實付金額'}
                </span>
                <span className="text-cta font-bold text-lg">
                  NT$ {orderStatus.amount.toLocaleString('zh-TW')}
                </span>
              </div>
              {isSubscription && isPaid && subscription?.planLabel && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-caption">訂閱方案</span>
                  <span className="text-heading font-medium text-sm">
                    {subscription.planLabel}
                  </span>
                </div>
              )}
              {isSubscription && isPaid && nextBillingText && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-caption">下次扣款日</span>
                  <span className="text-heading font-medium text-sm">
                    {nextBillingText}
                  </span>
                </div>
              )}
              {isPending && (
                <>
                  <div className="h-px bg-divider my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-caption">付款狀態</span>
                    <span className="text-sm font-semibold text-amber-600">
                      待 ATM 轉帳
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {paymentInstructions && (
            <div className="mb-10 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-left">
              <h2 className="mb-4 text-base font-bold text-heading">
                ATM 銀行轉帳資訊
              </h2>
              <div className="space-y-3">
                <InstructionRow
                  label="銀行代碼"
                  value={paymentInstructions.bankCode}
                />
                <InstructionRow
                  label="銀行名稱"
                  value={paymentInstructions.bankName}
                />
                <InstructionRow
                  label="虛擬帳號"
                  value={paymentInstructions.virtualAccount}
                  monospace
                />
                <InstructionRow
                  label="繳費金額"
                  value={
                    paymentInstructions.amount != null
                      ? `NT$ ${paymentInstructions.amount.toLocaleString('zh-TW')}`
                      : null
                  }
                />
                <InstructionRow
                  label="繳費期限"
                  value={formatDateTime(paymentInstructions.expiresAt)}
                />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-caption">
                {paymentInstructions.message ||
                  '完成轉帳後，付款狀態會由 SHOPLINE Payments webhook 自動更新。若已付款但畫面尚未變更，請稍後重新整理。'}
              </p>
            </div>
          )}

          {/* 操作按鈕 */}
          <div className="space-y-4">
            {/* 輪詢中：顯示 loading 按鈕 */}
            {isPolling && !paymentInstructions && (
              <Button
                disabled
                className="w-full rounded-full bg-cta hover:bg-cta-hover text-white py-8 text-lg font-bold opacity-80"
              >
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                確認付款狀態中...
              </Button>
            )}

            {isPolling && paymentInstructions && (
              <Button
                disabled
                className="w-full rounded-full bg-amber-500 hover:bg-amber-500 text-white py-8 text-lg font-bold opacity-90"
              >
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                等待 ATM 付款通知...
              </Button>
            )}

            {/* 已確認付款成功 */}
            {!isPolling && isPaid && !isGuest && (course || bundle) && (
              <Button
                asChild
                className="w-full rounded-full bg-cta hover:bg-cta-hover text-white py-8 text-lg font-bold transition-all shadow-lg shadow-cta/20 hover:shadow-xl hover:shadow-cta/30"
              >
                <Link href={startLearningHref}>
                  開始學習
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
            )}

            {/* 訪客用戶：引導登入 */}
            {!isPolling && isPaid && isGuest && (
              <Button
                asChild
                className="w-full rounded-full bg-cta hover:bg-cta-hover text-white py-8 text-lg font-bold transition-all shadow-lg shadow-cta/20 hover:shadow-xl hover:shadow-cta/30"
              >
                <Link href="/login">
                  前往登入頁
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
            )}

            {/* 逾時仍未確認：給替代按鈕 */}
            {isTimedOut && (
              <>
                <p className="text-sm text-caption mb-2">
                  {isSubscription
                    ? '訂閱處理中，稍後可至「我的訂閱」查看狀態。'
                    : paymentInstructions
                      ? 'ATM 付款完成前課程不會開通。完成轉帳後請稍後重新整理此頁，或等待系統通知。'
                      : '付款確認需要一點時間，請稍後至「我的課程」查看。'}
                </p>
                <Button
                  asChild
                  className="w-full rounded-full bg-cta hover:bg-cta-hover text-white py-8 text-lg font-bold"
                >
                  <Link href={isSubscription ? '/my-subscriptions' : '/my-courses'}>
                    {isSubscription ? '前往我的訂閱' : '前往我的課程'}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>
              </>
            )}

            {/* 付款失敗 */}
            {!isPolling && orderStatus?.status === 'FAILED' && (
              <Button
                asChild
                className="w-full rounded-full bg-red-500 hover:bg-red-600 text-white py-8 text-lg font-bold"
              >
                <Link href="/checkout">
                  重新結帳
                  <ArrowRight className="h-5 w-5 ml-2" />
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

          {/* 提示訊息 */}
          <div className="mt-12 pt-8 border-t border-divider">
            {isPaid && isGuest ? (
              <div className="space-y-1 text-sm text-caption">
                <p>您已完成付款，請至購買信箱收取「啟用帳號」信件後設定密碼。</p>
                {guestEmail && (
                  <p>
                    啟用信已寄送至：<span className="font-bold">{guestEmail}</span>
                  </p>
                )}
              </div>
            ) : isPaid ? (
              <p className="text-sm text-caption">
                購買確認信已同步發送至您的註冊電子信箱
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function InstructionRow({
  label,
  value,
  monospace = false,
}: {
  label: string
  value: string | null
  monospace?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-caption">{label}</span>
      <span
        className={`text-right text-sm font-semibold text-heading ${
          monospace ? 'font-mono tracking-wide' : ''
        }`}
      >
        {value || '待 SHOPLINE 回傳'}
      </span>
    </div>
  )
}

function formatDateTime(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
