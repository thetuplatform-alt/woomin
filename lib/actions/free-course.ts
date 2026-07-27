// lib/actions/free-course.ts
// 免費課程加入 Server Actions
// 提供免費課程的自動加入功能（支援原價免費或促銷價免費）

'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { calculatePrice } from '@/lib/utils/price'
import { getPostHogClient, flushPostHogInBackground } from '@/lib/posthog-server'
import { computeExpiresAt } from '@/lib/purchase/compute-expires-at'

/**
 * 加入免費課程結果型別
 */
export interface EnrollFreeCourseResult {
  success: boolean
  error?: string
  firstLessonId?: string
  courseSlug?: string
}

/**
 * 加入免費課程
 * 建立 Purchase 記錄（不需要 Order）
 */
export async function enrollFreeCourse(
  courseId: string
): Promise<EnrollFreeCourseResult> {
  try {
    // 1. 驗證用戶登入
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: '請先登入' }
    }

    // 2. 查詢課程並驗證是否為免費課程
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        status: { in: ['PUBLISHED', 'UNLISTED'] },
      },
      include: {
        chapters: {
          orderBy: { order: 'asc' },
          take: 1,
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    })

    if (!course) {
      return { success: false, error: '課程不存在或尚未發佈' }
    }

    // 3. 計算最終價格（考慮促銷價）
    const priceResult = calculatePrice({
      originalPrice: course.price,
      salePrice: course.salePrice,
      saleEndAt: course.saleEndAt,
      saleCycleEnabled: course.saleCycleEnabled,
      saleCycleDays: course.saleCycleDays,
    })

    // 驗證課程為免費（原價為 0 或有效促銷價為 0）
    if (priceResult.finalPrice !== 0) {
      return { success: false, error: '此課程需要付費購買' }
    }

    // 4. 檢查是否已加入
    const existingPurchase = await prisma.purchase.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
    })

    if (existingPurchase && !existingPurchase.revokedAt) {
      return { success: false, error: '您已經加入此課程' }
    }

    // 5. 建立或恢復 Purchase 記錄
    const expiresAt = computeExpiresAt(course)
    if (existingPurchase?.revokedAt) {
      // 恢復被撤銷的記錄，同步套用最新有效期設定
      await prisma.purchase.update({
        where: { id: existingPurchase.id },
        data: {
          revokedAt: null,
          source: 'FREE_ENROLL',
          expiresAt,
        },
      })
    } else {
      // 建立新記錄（orderId 為 null，表示免費加入）
      // L46：check-then-create 在併發下可能撞上 (userId, courseId) 唯一鍵；
      // 捕捉 P2002 視為「已加入」，回傳正確訊息而非誤導性的「發生錯誤」。
      try {
        await prisma.purchase.create({
          data: {
            userId: session.user.id,
            courseId,
            source: 'FREE_ENROLL',
            expiresAt,
          },
        })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return { success: false, error: '您已經加入此課程' }
        }
        throw e
      }
    }

    // 6. 取得第一個單元 ID
    const firstLessonId = course.chapters[0]?.lessons[0]?.id || null

    // 7. PostHog: Track free course enrollment
    const posthog = await getPostHogClient()
    if (posthog) {
      posthog.capture({
        distinctId: session.user.id,
        event: 'free_course_enrolled',
        properties: {
          course_id: courseId,
          course_slug: course.slug,
          course_title: course.title,
          enrollment_type: existingPurchase?.revokedAt ? 'restored' : 'new',
        },
      })
      flushPostHogInBackground(posthog)
    }

    // 8. 重新驗證快取
    revalidatePath(`/courses/${course.slug}`)
    revalidatePath('/my-courses')

    return {
      success: true,
      firstLessonId: firstLessonId || undefined,
      courseSlug: course.slug,
    }
  } catch (error) {
    console.error('加入免費課程失敗:', error)
    return { success: false, error: '加入課程時發生錯誤' }
  }
}
