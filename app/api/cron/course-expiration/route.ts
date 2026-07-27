// app/api/cron/course-expiration/route.ts
// 課程到期提醒 Cron Job
// 每日 02:00 UTC（台北 10:00）執行一次
// 1. 依課程設定的 expirationReminderDays 寄送到期前提醒
// 2. 到期當天寄送過期通知
// 3. 使用 CourseExpirationReminder 表避免重送

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendCourseExpirationReminder,
  sendCourseExpiredNotice,
} from '@/lib/email'

// Vercel Cron 最長可跑 60 秒；大量學員時增加批次控制
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function verifyCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // 本地測試允許無 secret（但 production 必須設）
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

function dayBoundary(daysFromNow: number): { start: Date; end: Date } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + daysFromNow)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

/**
 * 處理「到期前 N 天提醒」
 */
async function processReminders(daysBefore: number) {
  const { start, end } = dayBoundary(daysBefore)

  // 找所有 expiresAt 落在該天的 Purchase，且課程啟用提醒、此天數在設定內、尚未寄過
  const purchases = await prisma.purchase.findMany({
    where: {
      revokedAt: null,
      // 訂閱來源的授權由訂閱制自行管理提醒（即將扣款/存取即將結束），排除於課程到期提醒
      source: { not: 'SUBSCRIPTION' },
      expiresAt: { gte: start, lt: end },
      course: {
        expirationReminderEnabled: true,
        expirationReminderDays: { has: daysBefore },
        status: { not: 'DRAFT' },
      },
      expirationReminders: {
        none: { daysBefore },
      },
    },
    include: {
      user: { select: { email: true, name: true } },
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          chapters: {
            orderBy: { order: 'asc' },
            take: 1,
            select: {
              lessons: {
                orderBy: { order: 'asc' },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      },
    },
    take: 500, // 單次最多處理 500 筆，避免超時
  })

  let sent = 0
  let failed = 0

  for (const purchase of purchases) {
    if (!purchase.user.email || !purchase.expiresAt) {
      // 無 email 仍記錄，避免下次重複查詢
      await prisma.courseExpirationReminder.create({
        data: { purchaseId: purchase.id, daysBefore },
      }).catch(() => {})
      continue
    }

    const firstLessonId =
      purchase.course.chapters[0]?.lessons[0]?.id ?? null

    const result = await sendCourseExpirationReminder({
      toEmail: purchase.user.email,
      userName: purchase.user.name,
      courseName: purchase.course.title,
      courseSlug: purchase.course.slug,
      firstLessonId,
      daysRemaining: daysBefore,
      expiresAt: purchase.expiresAt,
    })

    if (result.success) {
      sent++
    } else {
      failed++
      console.error(
        `[Cron] 到期提醒發送失敗: purchase=${purchase.id}`,
        result.error
      )
    }

    // 不論成功失敗都記錄，避免下一次 cron 再次嘗試（成功重送更糟）
    await prisma.courseExpirationReminder
      .create({
        data: { purchaseId: purchase.id, daysBefore },
      })
      .catch(() => {})
  }

  return { checked: purchases.length, sent, failed }
}

/**
 * 處理「已過期通知」（到期後第 1 天寄）
 * daysBefore = 0 作為「已過期」記錄 key
 */
async function processExpiredNotices() {
  const now = new Date()
  // 過去 2 天內過期、但尚未寄過期通知的
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

  const purchases = await prisma.purchase.findMany({
    where: {
      revokedAt: null,
      // 訂閱來源排除於過期通知（訂閱另有終止/存取結束信）
      source: { not: 'SUBSCRIPTION' },
      expiresAt: { gte: twoDaysAgo, lt: now },
      course: {
        expirationReminderEnabled: true,
        status: { not: 'DRAFT' },
      },
      expirationReminders: {
        none: { daysBefore: 0 },
      },
    },
    include: {
      user: { select: { email: true, name: true } },
      course: { select: { title: true, slug: true } },
    },
    take: 500,
  })

  let sent = 0
  let failed = 0

  for (const purchase of purchases) {
    if (!purchase.user.email || !purchase.expiresAt) {
      await prisma.courseExpirationReminder
        .create({ data: { purchaseId: purchase.id, daysBefore: 0 } })
        .catch(() => {})
      continue
    }

    const result = await sendCourseExpiredNotice({
      toEmail: purchase.user.email,
      userName: purchase.user.name,
      courseName: purchase.course.title,
      courseSlug: purchase.course.slug,
      expiredAt: purchase.expiresAt,
    })

    if (result.success) {
      sent++
    } else {
      failed++
      console.error(
        `[Cron] 過期通知發送失敗: purchase=${purchase.id}`,
        result.error
      )
    }

    await prisma.courseExpirationReminder
      .create({ data: { purchaseId: purchase.id, daysBefore: 0 } })
      .catch(() => {})
  }

  return { checked: purchases.length, sent, failed }
}

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date()

  // 蒐集所有啟用的提醒天數
  const distinctDaysRaw = await prisma.course.findMany({
    where: { expirationReminderEnabled: true },
    select: { expirationReminderDays: true },
  })
  const distinctDays = new Set<number>()
  for (const row of distinctDaysRaw) {
    for (const d of row.expirationReminderDays) {
      if (d > 0) distinctDays.add(d)
    }
  }

  const reminderResults: Record<string, unknown> = {}
  for (const day of Array.from(distinctDays).sort((a, b) => b - a)) {
    reminderResults[`day_${day}`] = await processReminders(day)
  }

  const expiredResult = await processExpiredNotices()

  const finishedAt = new Date()

  return NextResponse.json({
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    reminders: reminderResults,
    expired: expiredResult,
  })
}
