// app/api/lesson-progress/route.ts
// 進度更新 API
// POST: 更新單元觀看進度

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateProgressSchema } from '@/lib/validations/progress'
import { checkLessonAccess } from '@/lib/actions/lesson'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'

/**
 * POST /api/lesson-progress
 * 更新單元進度（觀看秒數、完成狀態）
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

    // Rate Limiting 檢查
    const rateResult = checkRateLimit(`progress:${session.user.id}`, RATE_LIMIT_CONFIGS.api)
    if (!rateResult.success) {
      return NextResponse.json(
        { success: false, error: '請求過於頻繁' },
        { status: 429 }
      )
    }

    // 解析請求內容
    const body = await request.json()

    // 驗證輸入
    const validation = updateProgressSchema.safeParse(body)
    if (!validation.success) {
      const firstError = validation.error.issues[0]
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || '輸入資料格式錯誤',
        },
        { status: 400 }
      )
    }

    const { lessonId, watchedSec, completed, forceComplete } = validation.data

    // 權限檢查
    const accessLevel = await checkLessonAccess(lessonId)

    if (accessLevel === 'not_found') {
      return NextResponse.json(
        { success: false, error: '單元不存在' },
        { status: 404 }
      )
    }

    if (accessLevel === 'not_logged_in') {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    // allowlist：僅 granted / free 放行；not_purchased / expired 等一律拒絕
    //（修 PRD §9：過期 / 未登入原可經 denylist 落穿繼續寫進度）
    if (accessLevel !== 'granted' && accessLevel !== 'free') {
      return NextResponse.json(
        {
          success: false,
          error:
            accessLevel === 'expired'
              ? '您的課程觀看權限已到期'
              : '您尚未購買此課程',
        },
        { status: 403 }
      )
    }

    // 取得單元資訊（用於進度值驗證）
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        videoDuration: true,
      },
    })

    // 進度值驗證：確保 watchedSec 不超過影片時長
    let validatedWatchedSec = watchedSec
    if (lesson?.videoDuration && watchedSec > lesson.videoDuration) {
      validatedWatchedSec = lesson.videoDuration
    }

    // 先取得現有進度（如果存在）
    const existingProgress = await prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
      select: {
        watchedSec: true,
        completed: true,
      },
    })

    // 保留最大觀看時間，避免倒帶時進度回退
    const finalWatchedSec = existingProgress
      ? Math.max(existingProgress.watchedSec, validatedWatchedSec)
      : validatedWatchedSec

    // 計算最終完成狀態
    // 如果是強制設定（forceComplete），直接使用傳入的 completed 值
    // 否則保護已完成狀態，一旦完成就不會被改回未完成
    const finalCompleted = forceComplete
      ? completed
      : existingProgress?.completed || completed

    // Upsert 進度記錄
    const progress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
      create: {
        userId: session.user.id,
        lessonId,
        watchedSec: finalWatchedSec,
        completed: finalCompleted,
        lastWatchAt: new Date(),
      },
      update: {
        watchedSec: finalWatchedSec,
        completed: finalCompleted,
        lastWatchAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      progress: {
        lessonId: progress.lessonId,
        watchedSec: progress.watchedSec,
        completed: progress.completed,
      },
    })
  } catch (error) {
    console.error('更新進度失敗:', error)
    return NextResponse.json(
      { success: false, error: '更新進度失敗' },
      { status: 500 }
    )
  }
}
