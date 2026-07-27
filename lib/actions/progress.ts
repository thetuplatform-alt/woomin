// lib/actions/progress.ts
// 學習進度 Server Actions
// 提供進度更新、查詢和統計功能

'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { updateProgressSchema, type CourseProgressStats } from '@/lib/validations/progress'
import { checkLessonAccess } from '@/lib/actions/lesson'

/**
 * 單元進度資料類型
 */
export interface LessonProgressData {
  lessonId: string
  watchedSec: number
  completed: boolean
  lastWatchAt: Date
}

/**
 * 更新單元進度
 * @param lessonId - 單元 ID
 * @param watchedSec - 觀看秒數
 * @param completed - 是否完成
 */
export async function updateLessonProgress(
  lessonId: string,
  watchedSec: number,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // 驗證登入狀態
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: '請先登入' }
    }

    // 驗證輸入
    const validation = updateProgressSchema.safeParse({
      lessonId,
      watchedSec,
      completed,
    })

    if (!validation.success) {
      const firstError = validation.error.issues[0]
      return {
        success: false,
        error: firstError?.message || '輸入資料格式錯誤',
      }
    }

    // 驗證用戶是否有權限存取此單元（已購買或免費試看）
    const access = await checkLessonAccess(lessonId)
    if (access === 'not_found') {
      return { success: false, error: '單元不存在' }
    }
    if (access === 'not_purchased') {
      return { success: false, error: '尚未購買此課程' }
    }

    // 取得現有進度，用於保護已完成狀態和最大觀看秒數
    const existingProgress = await prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
    })

    // 保護邏輯：已完成不可倒退、觀看秒數取最大值
    const finalCompleted = existingProgress?.completed || completed
    const finalWatchedSec = Math.max(existingProgress?.watchedSec || 0, watchedSec)

    // Upsert 進度記錄
    await prisma.lessonProgress.upsert({
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

    return { success: true }
  } catch (error) {
    console.error('更新進度失敗:', error)
    return { success: false, error: '更新進度失敗' }
  }
}

/**
 * 取得單一單元進度
 * @param lessonId - 單元 ID
 */
export async function getLessonProgress(
  lessonId: string
): Promise<LessonProgressData | null> {
  try {
    // 驗證登入狀態
    const session = await auth()
    if (!session?.user?.id) {
      return null
    }

    const progress = await prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
    })

    if (!progress) {
      return null
    }

    return {
      lessonId: progress.lessonId,
      watchedSec: progress.watchedSec,
      completed: progress.completed,
      lastWatchAt: progress.lastWatchAt,
    }
  } catch (error) {
    console.error('取得進度失敗:', error)
    return null
  }
}

/**
 * 計算整體課程進度
 * @param courseId - 課程 ID
 */
export async function getCourseProgress(
  courseId: string
): Promise<CourseProgressStats> {
  try {
    // 驗證登入狀態
    const session = await auth()
    if (!session?.user?.id) {
      return {
        totalLessons: 0,
        completedLessons: 0,
        progressPercentage: 0,
      }
    }

    // 取得課程所有單元數量
    const totalLessons = await prisma.lesson.count({
      where: {
        chapter: {
          courseId,
        },
      },
    })

    // 取得用戶已完成的單元數量
    const completedLessons = await prisma.lessonProgress.count({
      where: {
        userId: session.user.id,
        completed: true,
        lesson: {
          chapter: {
            courseId,
          },
        },
      },
    })

    // 計算進度百分比
    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    return {
      totalLessons,
      completedLessons,
      progressPercentage,
    }
  } catch (error) {
    console.error('計算課程進度失敗:', error)
    return {
      totalLessons: 0,
      completedLessons: 0,
      progressPercentage: 0,
    }
  }
}

/**
 * 標記單元為已完成
 * @param lessonId - 單元 ID
 */
export async function markLessonComplete(
  lessonId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 驗證登入狀態
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: '請先登入' }
    }

    // 驗證用戶是否有權限存取此單元（已購買或免費試看）
    const access = await checkLessonAccess(lessonId)
    if (access === 'not_found') {
      return { success: false, error: '單元不存在' }
    }
    if (access === 'not_purchased') {
      return { success: false, error: '尚未購買此課程' }
    }

    // 取得單元資訊（用於 videoDuration）
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { videoDuration: true },
    })

    // 取得現有進度記錄
    const existingProgress = await prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
    })

    // Upsert 進度記錄，保留觀看秒數
    await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
      create: {
        userId: session.user.id,
        lessonId,
        watchedSec: lesson?.videoDuration || 0,
        completed: true,
        lastWatchAt: new Date(),
      },
      update: {
        completed: true,
        watchedSec: Math.max(
          existingProgress?.watchedSec || 0,
          lesson?.videoDuration || 0
        ),
        lastWatchAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('標記完成失敗:', error)
    return { success: false, error: '標記完成失敗' }
  }
}
