// app/api/watch-time/route.ts
// 觀看時間心跳 API
// POST: 記錄用戶每分鐘的觀看心跳

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkLessonAccess } from '@/lib/actions/lesson'

// 心跳請求驗證
const watchTimeSchema = z.object({
  lessonId: z
    .string()
    .min(1, { message: '單元 ID 為必填' })
    .max(50, { message: '單元 ID 格式錯誤' }),
  duration: z
    .number({ message: '觀看秒數必須為數字' })
    .int({ message: '觀看秒數必須為整數' })
    .min(1, { message: '觀看秒數不能小於 1' })
    .max(120, { message: '觀看秒數不能超過 120' }),
  startedAt: z
    .string()
    .datetime({ message: '開始時間格式錯誤' }),
})

// 心跳 rate limit：每分鐘最多 5 次
const WATCH_TIME_RATE_LIMIT = { windowMs: 60_000, maxRequests: 5 }

/**
 * POST /api/watch-time
 * 記錄觀看時間心跳
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證登入狀態
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    // Rate Limiting
    const rateResult = checkRateLimit(`watchtime:${session.user.id}`, WATCH_TIME_RATE_LIMIT)
    if (!rateResult.success) {
      return NextResponse.json(
        { success: false, error: '請求過於頻繁' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validation = watchTimeSchema.safeParse(body)
    if (!validation.success) {
      const firstError = validation.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || '輸入資料格式錯誤' },
        { status: 400 }
      )
    }

    const { lessonId, duration, startedAt } = validation.data

    // 防止未來時間或太久遠的時間
    const startedAtDate = new Date(startedAt)
    const now = new Date()
    const diffMs = now.getTime() - startedAtDate.getTime()
    if (diffMs < -30000 || diffMs > 300000) {
      // 允許 30 秒的時鐘偏差，但不接受超過 5 分鐘前的心跳
      return NextResponse.json(
        { success: false, error: '時間戳不合理' },
        { status: 400 }
      )
    }

    // 驗證用戶是否有權限存取該單元
    const accessStatus = await checkLessonAccess(lessonId)
    if (accessStatus !== 'granted' && accessStatus !== 'free') {
      return NextResponse.json(
        { success: false, error: '無權限存取此單元' },
        { status: 403 }
      )
    }

    // 寫入心跳記錄
    await prisma.watchTimeLog.create({
      data: {
        userId: session.user.id,
        lessonId,
        startedAt: startedAtDate,
        duration,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('記錄觀看時間失敗:', error)
    return NextResponse.json(
      { success: false, error: '記錄觀看時間失敗' },
      { status: 500 }
    )
  }
}
