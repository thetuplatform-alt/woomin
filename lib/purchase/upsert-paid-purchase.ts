// lib/purchase/upsert-paid-purchase.ts
// 付款成功後建立（或恢復）Purchase 的共用邏輯
// 供 Stripe webhook / PAYUNi notify / 零元訂單 / 訂閱每期展期 共用

import type { Prisma, PrismaClient } from '@prisma/client'
import { computeExpiresAt } from './compute-expires-at'

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface UpsertPaidPurchaseParams {
  tx: TxClient | Prisma.TransactionClient
  userId: string
  courseId: string
  orderId: string
  paidAt?: Date
  source?: 'PAID' | 'BUNDLE' | 'SUBSCRIPTION'
  bundleId?: string | null
  /**
   * 到期日覆寫（訂閱制專用）。
   * 買斷 / bundle 情境留空 → 依課程 accessType 由 computeExpiresAt 計算。
   * 訂閱情境傳入 currentPeriodEnd + 寬限（或期滿轉永久時傳 null）。
   * 注意：傳入 null 與「不傳（undefined）」語意不同——
   *   - undefined：走課程 accessType 計算
   *   - null：明確設為永久（訂閱期滿轉永久用）
   */
  expiresAtOverride?: Date | null
  /**
   * 展期時是否清除未來的 CourseExpirationReminder（訂閱續期 / 買斷續費用）。
   * 續費延長到期日後，舊的 (purchaseId, daysBefore) 記錄會讓新到期日的提醒被跳過，
   * 故展期時一併清除 daysBefore>0 的記錄，讓提醒依新到期日重新觸發。
   */
  clearFutureReminders?: boolean
}

/**
 * 建立（或恢復）付費授權的 Purchase
 * - 計算到期日（依課程授權設定，或 expiresAtOverride 覆寫）
 * - 若已存在且被撤銷 → 恢復並更新到期日與 orderId
 * - 若已存在且未撤銷 → 取較晚到期日（永久優先）延長授權
 * - 若不存在 → 建立
 */
export async function upsertPaidPurchase({
  tx,
  userId,
  courseId,
  orderId,
  paidAt = new Date(),
  source = 'PAID',
  bundleId = null,
  expiresAtOverride,
  clearFutureReminders = false,
}: UpsertPaidPurchaseParams): Promise<void> {
  // expiresAtOverride 有明確傳入（含 null）時採用之；否則依課程設定計算
  let expiresAt: Date | null
  if (expiresAtOverride !== undefined) {
    expiresAt = expiresAtOverride
  } else {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: {
        accessType: true,
        accessDurationDays: true,
        accessExpiresAt: true,
      },
    })

    if (!course) {
      throw new Error(`Course not found: ${courseId}`)
    }

    expiresAt = computeExpiresAt(course, paidAt)
  }

  const existing = await tx.purchase.findUnique({
    where: { userId_courseId: { userId, courseId } },
  })

  if (!existing) {
    await tx.purchase.create({
      data: {
        userId,
        courseId,
        orderId,
        source,
        bundleId,
        expiresAt,
      },
    })
    return
  }

  if (existing.revokedAt) {
    // 被撤銷的購買記錄 → 恢復，套用新的到期日
    await tx.purchase.update({
      where: { id: existing.id },
      data: {
        revokedAt: null,
        orderId,
        source,
        bundleId,
        expiresAt,
      },
    })
    await maybeClearFutureReminders(tx, existing.id, expiresAt, clearFutureReminders)
    return
  }

  // 已存在且有效：若是重新購買延長授權，取較晚的到期日
  // existing 永久（null）→ 保留永久
  // existing 非永久、新購買也非永久 → 取 max
  // existing 非永久、新購買永久 → 升級為永久
  if (existing.expiresAt) {
    const nextExpiresAt = !expiresAt
      ? null
      : existing.expiresAt.getTime() >= expiresAt.getTime()
        ? existing.expiresAt
        : expiresAt

    await tx.purchase.update({
      where: { id: existing.id },
      data: {
        orderId,
        source,
        bundleId,
        expiresAt: nextExpiresAt,
      },
    })
    await maybeClearFutureReminders(tx, existing.id, nextExpiresAt, clearFutureReminders)
    return
  }

  // existing 永久 → 保留永久授權，但更新本次訂單來源以便後台辨識 bundle 購買
  await tx.purchase.update({
    where: { id: existing.id },
    data: {
      orderId,
      source,
      bundleId,
    },
  })
}

/**
 * 展期後清除未來的到期提醒記錄（比照 extendCourseAccess 的清理寫法）。
 * 僅在 clearFutureReminders 且延展後仍為非永久時清除 daysBefore>0 的記錄。
 */
async function maybeClearFutureReminders(
  tx: TxClient | Prisma.TransactionClient,
  purchaseId: string,
  nextExpiresAt: Date | null,
  clearFutureReminders: boolean
): Promise<void> {
  if (!clearFutureReminders) return
  if (!nextExpiresAt) return
  await tx.courseExpirationReminder.deleteMany({
    where: {
      purchaseId,
      daysBefore: { gt: 0 },
    },
  })
}
