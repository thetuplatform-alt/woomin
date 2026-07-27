// lib/actions/subscription-plans.ts
// 課程訂閱方案 CRUD（後台課程定價 tab）。
//
// 一次以「整批取代」語意儲存某課程的訂閱方案列表（比照 course-pricing 的整表儲存）：
// 前端傳入方案陣列（含既有 id 表更新、無 id 表新增），本檔負責 diff → 建 / 改 / 停用，
// 並在 gateway=stripe 時同步 recurring Price（容錯不阻擋儲存，AC-13）。
//
// 慣例：requireCourseManageAccess + Zod 驗證 + AdminLog(UPDATE_COURSE) + revalidatePath。
// 統一回傳 { success, error?, data? }。

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import { subscriptionPlanSchema } from '@/lib/validations/subscription'
import { getActiveGatewayType } from '@/lib/payment/gateway-factory'
import { gatewayTypeSupportsSubscription } from '@/lib/payment/subscription-support'
import { ensureRecurringPrice } from '@/lib/subscription/stripe-billing'
import type { CourseSubscriptionPlan } from '@prisma/client'

/**
 * 單筆方案輸入（含可選 id：有 id 表更新既有方案，無 id 表新增）。
 * 欄位驗證沿用地基的 subscriptionPlanSchema。
 */
const planItemSchema = subscriptionPlanSchema.and(
  z.object({ id: z.string().min(1).optional() })
)

/** 整批儲存輸入：某課程的完整方案列表 */
const savePlansSchema = z.object({
  plans: z.array(planItemSchema).max(20, '單一課程最多 20 個訂閱方案'),
})

export type SubscriptionPlanInputItem = z.infer<typeof planItemSchema>

/**
 * 後台方案列表項（傳給定價表單的資料形狀）。
 */
export interface AdminSubscriptionPlanItem {
  id: string
  label: string
  type: CourseSubscriptionPlan['type']
  interval: CourseSubscriptionPlan['interval']
  price: number
  totalPeriods: number | null
  termEndBehavior: CourseSubscriptionPlan['termEndBehavior']
  renewalReminderDays: number | null
  enabled: boolean
  sortOrder: number
  stripePriceId: string | null
  /** 是否有任何歷史訂閱使用此方案（有的話只能停用，避免破壞帳務稽核與 FK） */
  hasActiveSubscriptions: boolean
}

/**
 * 記錄方案操作到 AdminLog（AC-76：方案 CRUD 記 UPDATE_COURSE）。
 */
async function logPlanAction(
  adminId: string,
  courseId: string,
  details: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'UPDATE_COURSE',
        targetType: 'Course',
        targetId: courseId,
        details: JSON.parse(JSON.stringify({ tab: 'pricing', ...details })),
      },
    })
  } catch (error) {
    console.error('記錄方案操作日誌失敗:', error)
  }
}

/**
 * 取得某課程的所有訂閱方案（後台定價表單用）。
 * 一併回傳「是否有進行中的訂閱」旗標，供 UI 決定刪除語意（停用而非硬刪）。
 */
export async function getSubscriptionPlansByCourseId(
  courseId: string
): Promise<AdminSubscriptionPlanItem[]> {
  await requireCourseManageAccess(courseId)

  const plans = await prisma.courseSubscriptionPlan.findMany({
    where: { courseId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: {
        select: {
          subscriptions: {
            where: {},
          },
        },
      },
    },
  })

  return plans.map((plan) => ({
    id: plan.id,
    label: plan.label,
    type: plan.type,
    interval: plan.interval,
    price: plan.price,
    totalPeriods: plan.totalPeriods,
    termEndBehavior: plan.termEndBehavior,
    renewalReminderDays: plan.renewalReminderDays,
    enabled: plan.enabled,
    sortOrder: plan.sortOrder,
    stripePriceId: plan.stripePriceId,
    hasActiveSubscriptions: plan._count.subscriptions > 0,
  }))
}

/**
 * 整批儲存某課程的訂閱方案。
 *
 * 語意：
 * - 傳入含 id 的方案 → 更新（變價時 Stripe 端建新 Price、舊 Price 不歸檔）
 * - 傳入無 id 的方案 → 新增
 * - 既有但這次未傳入的方案：
 *     無進行中訂閱 → 硬刪
 *     有進行中訂閱 → 停用（enabled=false，保留方案快照與 FK）
 * - gateway=stripe：每個 enabled 方案儲存後同步 recurring Price（容錯，AC-13）
 */
export async function saveSubscriptionPlans(
  courseId: string,
  input: { plans: SubscriptionPlanInputItem[] }
): Promise<{ success: boolean; error?: string; data?: AdminSubscriptionPlanItem[] }> {
  try {
    const user = await requireCourseManageAccess(courseId)

    const { plans } = savePlansSchema.parse(input)

    // 取課程標題（Stripe Price 命名用）與既有方案
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    })
    if (!course) {
      return { success: false, error: '找不到課程' }
    }

    const existing = await prisma.courseSubscriptionPlan.findMany({
      where: { courseId },
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {},
            },
          },
        },
      },
    })
    const existingById = new Map(existing.map((p) => [p.id, p]))

    const incomingIds = new Set(
      plans.map((p) => p.id).filter((id): id is string => !!id)
    )

    // ---- 交易內：建 / 改 / 刪或停用 ----
    await prisma.$transaction(async (tx) => {
      // 1) 這次未傳入的既有方案 → 刪除（無進行中訂閱）或停用（有）
      for (const old of existing) {
        if (incomingIds.has(old.id)) continue
        if (old._count.subscriptions > 0) {
          await tx.courseSubscriptionPlan.update({
            where: { id: old.id },
            data: { enabled: false },
          })
        } else {
          await tx.courseSubscriptionPlan.delete({ where: { id: old.id } })
        }
      }

      // 2) 建 / 改（sortOrder 依傳入順序覆寫，讓拖曳/新增順序生效）
      for (let index = 0; index < plans.length; index++) {
        const plan = plans[index]
        const data = {
          label: plan.label,
          type: plan.type,
          interval: plan.interval,
          price: plan.price,
          // UNLIMITED 一律 null；FIXED_TERM 用傳入值
          totalPeriods: plan.type === 'FIXED_TERM' ? plan.totalPeriods ?? null : null,
          termEndBehavior: plan.termEndBehavior,
          renewalReminderDays: plan.renewalReminderDays ?? null,
          enabled: plan.enabled,
          sortOrder: index,
        }

        if (plan.id && existingById.has(plan.id)) {
          await tx.courseSubscriptionPlan.update({
            where: { id: plan.id },
            data,
          })
        } else {
          await tx.courseSubscriptionPlan.create({
            data: { courseId, ...data },
          })
        }
      }
    })

    // ---- 交易外：gateway=stripe 時同步 recurring Price（容錯，AC-13）----
    const gatewayType = await getActiveGatewayType().catch(() => null)
    if (gatewayType === 'stripe' && gatewayTypeSupportsSubscription(gatewayType)) {
      const saved = await prisma.courseSubscriptionPlan.findMany({
        where: { courseId, enabled: true },
      })
      for (const plan of saved) {
        try {
          const priceId = await ensureRecurringPrice({
            planId: plan.id,
            courseTitle: course.title,
            interval: plan.interval,
            unitAmount: plan.price,
            existingStripePriceId: plan.stripePriceId,
          })
          if (priceId && priceId !== plan.stripePriceId) {
            await prisma.courseSubscriptionPlan.update({
              where: { id: plan.id },
              data: { stripePriceId: priceId },
            })
          }
        } catch (err) {
          // 同步失敗不阻擋儲存：方案已入庫，Price 缺失時結帳降級 price_data
          console.error(
            `[subscription-plans] Stripe recurring Price 同步失敗 plan=${plan.id}:`,
            err
          )
        }
      }
    }

    await logPlanAction(user.id as string, courseId, {
      action: 'SAVE_SUBSCRIPTION_PLANS',
      planCount: plans.length,
    })

    revalidatePath(`/admin/courses/${courseId}/pricing`)
    revalidatePath(`/admin/courses/${courseId}`)

    const data = await getSubscriptionPlansByCourseId(courseId)
    return { success: true, data }
  } catch (error) {
    console.error('儲存訂閱方案失敗:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? '方案資料格式有誤' }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '儲存訂閱方案時發生錯誤' }
  }
}
