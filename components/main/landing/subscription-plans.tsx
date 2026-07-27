// components/main/landing/subscription-plans.tsx
// 訂閱方案選項卡（銷售頁共用）
// AC-17/18/19/20：未購買狀態顯示每期價、週期、FIXED_TERM 總繳金額與取消政策摘要，
// CTA 導向 /checkout?courseId=…&plan={planId}；促銷並存時標示「促銷價僅適用買斷」。

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Infinity as InfinityIcon, CalendarClock, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils/price'
import type { PlanOption } from '@/lib/actions/public-courses'
import posthog from 'posthog-js'

interface SubscriptionPlansProps {
  courseId: string
  courseSlug?: string
  plans: PlanOption[]
  /** 課程是否同時有買斷促銷（AC-20：標示「促銷價僅適用買斷」） */
  isOnSale?: boolean
  /** 版面風格：light（預設，淺底）/ dark（深底客製頁用） */
  variant?: 'light' | 'dark'
  /** 標題文案，預設「訂閱方案」 */
  title?: string
}

const intervalLabel: Record<PlanOption['interval'], string> = {
  MONTH: '每月',
  YEAR: '每年',
}

const perPeriodLabel: Record<PlanOption['interval'], string> = {
  MONTH: '/ 月',
  YEAR: '/ 年',
}

/**
 * 建立單一方案的結帳連結（保留 courseId 與 plan 參數）
 */
function planCheckoutHref(courseId: string, planId: string) {
  return `/checkout?courseId=${courseId}&plan=${encodeURIComponent(planId)}`
}

export function SubscriptionPlans({
  courseId,
  courseSlug,
  plans,
  isOnSale = false,
  variant = 'light',
  title = '訂閱方案',
}: SubscriptionPlansProps) {
  // 無方案（gating 後為空）→ 完全不渲染任何訂閱 UI（AC-21）
  if (!plans || plans.length === 0) {
    return null
  }

  const isDark = variant === 'dark'

  return (
    <section
      className={
        isDark
          ? 'bg-[#0f0f1a] py-14 text-white sm:py-20'
          : 'bg-surface py-14 sm:py-20'
      }
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-[0.18em] text-cta"
          >
            Subscription
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className={`mt-3 text-2xl font-bold tracking-tight sm:text-4xl ${
              isDark ? 'text-white' : 'text-heading'
            }`}
          >
            {title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className={`mx-auto mt-3 max-w-2xl text-sm sm:text-base ${
              isDark ? 'text-white/60' : 'text-body'
            }`}
          >
            除了單次買斷，你也可以選擇定期訂閱，依自己的節奏開始學習。
          </motion.p>
        </div>

        {/* 促銷並存時的標示（AC-20） */}
        {isOnSale && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className={`mx-auto mt-6 flex max-w-xl items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
              isDark
                ? 'bg-white/10 text-white/80'
                : 'bg-white text-body ring-1 ring-divider'
            }`}
          >
            <Info className="h-4 w-4 shrink-0 text-cta" />
            <span>促銷價僅適用「買斷」，訂閱方案不套用促銷折扣。</span>
          </motion.div>
        )}

        <div
          className={`mt-10 grid gap-5 ${
            plans.length === 1
              ? 'mx-auto max-w-md'
              : 'sm:grid-cols-2'
          }`}
        >
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={index}
              courseId={courseId}
              courseSlug={courseSlug}
              isDark={isDark}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function PlanCard({
  plan,
  index,
  courseId,
  courseSlug,
  isDark,
}: {
  plan: PlanOption
  index: number
  courseId: string
  courseSlug?: string
  isDark: boolean
}) {
  const isFixedTerm = plan.type === 'FIXED_TERM'
  const href = planCheckoutHref(courseId, plan.id)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1 + index * 0.08 }}
      className={`flex flex-col rounded-2xl border p-6 sm:p-7 ${
        isDark
          ? 'border-white/10 bg-white/[0.04]'
          : 'border-divider bg-white'
      }`}
    >
      {/* 類型徽章 + 方案名稱 */}
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cta/10 text-cta">
          {isFixedTerm ? (
            <CalendarClock className="h-5 w-5" />
          ) : (
            <InfinityIcon className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0">
          <p
            className={`text-xs font-bold uppercase tracking-wider ${
              isDark ? 'text-white/50' : 'text-caption'
            }`}
          >
            {isFixedTerm ? '期限訂閱' : '無限訂閱'}
          </p>
          <h3
            className={`truncate text-base font-bold ${
              isDark ? 'text-white' : 'text-heading'
            }`}
          >
            {plan.label}
          </h3>
        </div>
      </div>

      {/* 每期價格 + 週期 */}
      <div className="mt-6 flex items-baseline gap-1.5">
        <span
          className={`text-3xl font-black tracking-tight sm:text-4xl ${
            isDark ? 'text-white' : 'text-heading'
          }`}
        >
          {formatPrice(plan.price)}
        </span>
        <span
          className={`text-sm font-medium ${
            isDark ? 'text-white/50' : 'text-caption'
          }`}
        >
          {perPeriodLabel[plan.interval]}
        </span>
      </div>

      {/* FIXED_TERM：NT$Y × N 期＝總計 NT$X（AC-17） */}
      {isFixedTerm && plan.totalPeriods && plan.totalAmount !== null ? (
        <p
          className={`mt-2 text-sm ${isDark ? 'text-white/70' : 'text-body'}`}
        >
          {formatPrice(plan.price)} × {plan.totalPeriods} 期 ＝ 總計{' '}
          <span
            className={`font-bold ${isDark ? 'text-white' : 'text-heading'}`}
          >
            {formatPrice(plan.totalAmount)}
          </span>
        </p>
      ) : (
        <p
          className={`mt-2 text-sm ${isDark ? 'text-white/70' : 'text-body'}`}
        >
          {intervalLabel[plan.interval]}自動扣款，不取消就持續開通觀看。
        </p>
      )}

      {/* 期滿行為說明 + 取消政策摘要（AC-17） */}
      <ul
        className={`mt-5 space-y-2 text-xs leading-5 ${
          isDark ? 'text-white/60' : 'text-body'
        }`}
      >
        {isFixedTerm ? (
          <li>
            {plan.termEndBehavior === 'GRANT_LIFETIME'
              ? `繳滿 ${plan.totalPeriods} 期後轉為永久擁有，可繼續觀看。`
              : `繳滿 ${plan.totalPeriods} 期後訂閱結束、存取到期。`}
          </li>
        ) : (
          <li>可隨時取消，取消後不再扣款。</li>
        )}
        <li>
          {isFixedTerm
            ? '中途取消不轉永久、已繳期款不退款；取消後可觀看至已付期間結束。'
            : '已繳期款不退款；取消後可觀看至當期結束。'}
        </li>
      </ul>

      {/* CTA */}
      <Button
        asChild
        className={`mt-6 h-12 w-full rounded-xl text-base font-bold ${
          isDark
            ? 'bg-cta text-white hover:bg-cta-hover'
            : 'bg-cta text-white hover:bg-cta-hover'
        }`}
      >
        <Link
          href={href}
          onClick={() => {
            posthog.capture('cta_clicked', {
              cta_location: 'subscription_plans',
              cta_text: '選擇訂閱方案',
              course_id: courseId,
              course_slug: courseSlug,
              plan_id: plan.id,
              plan_type: isFixedTerm ? 'fixed_term' : 'unlimited',
              plan_price: plan.price,
              plan_interval: plan.interval,
            })
          }}
        >
          選擇此方案
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </Button>
    </motion.div>
  )
}

/**
 * 從方案陣列取「每期最低價」用於 sticky-cta 次行入口（AC-19）
 */
export function lowestPlanPrice(plans: PlanOption[] | undefined): PlanOption | null {
  if (!plans || plans.length === 0) return null
  return plans.reduce((lowest, p) => (p.price < lowest.price ? p : lowest), plans[0])
}
