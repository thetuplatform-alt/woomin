// lib/actions/courses.ts
// 課程管理 Server Actions
// 提供課程 CRUD 操作

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, isInstructorRole } from '@/lib/require-admin'
import {
  manageableCourseWhereForUser,
  requireCourseManageAccess,
} from '@/lib/course-permissions'
import {
  courseSchema,
  coursePricingSchema,
  courseDetailsSchema,
  type CourseFormData,
  type CoursePricingFormData,
  type CourseDetailsFormData,
} from '@/lib/validations/course'
import { syncCourseToStripe, archiveCourseStripeResources } from '@/lib/stripe'
import { getActiveGatewayType } from '@/lib/payment/gateway-factory'
import { sanitizeLandingPageHtml } from '@/lib/utils/sanitize-landing-page-html'
import type {
  CourseStatus,
  CourseVisibility,
  Course,
  Prisma,
  WatermarkEmailDisplayMode,
  WatermarkMovementMode,
  WatermarkTextSize,
} from '@prisma/client'
import { z } from 'zod'

export type CourseWithVideoWatermarkSetting = Prisma.CourseGetPayload<{
  include: {
    videoWatermarkSetting: true
    instructors: {
      include: {
        user: { select: { id: true; name: true; email: true } }
      }
    }
  }
}>

/**
 * 課程列表查詢參數
 */
export interface GetCoursesParams {
  search?: string
  status?: CourseStatus | 'ALL'
  salesVisibility?: CourseVisibility | 'ALL'
  page?: number
  pageSize?: number
}

const courseInstructorIdsSchema = z.array(z.string().min(1)).max(100)

/**
 * 課程列表項目（含講師數，用於標示「全講師共管」狀態）
 */
export type CourseListItem = Course & {
  _count: { instructors: number }
}

/**
 * 課程列表回傳結果
 */
export interface GetCoursesResult {
  courses: CourseListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// requireAdminAuth 從 @/lib/require-admin 引入（直接查 DB 確保角色即時生效）

/**
 * 記錄管理員操作日誌
 */
async function logAdminAction(
  adminId: string,
  action: 'CREATE_COURSE' | 'UPDATE_COURSE' | 'DELETE_COURSE',
  targetId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType: 'Course',
        targetId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    })
  } catch (error) {
    console.error('記錄操作日誌失敗:', error)
  }
}

/**
 * 取得課程列表（含搜尋、篩選、分頁）
 */
export async function getCourses(
  params: GetCoursesParams = {}
): Promise<GetCoursesResult> {
  const user = await requireAdminAuth()

  const { search, status, salesVisibility, page = 1, pageSize = 10 } = params

  // 建立查詢條件
  const where: Prisma.CourseWhereInput = manageableCourseWhereForUser(user)

  if (search) {
    where.title = {
      contains: search,
      mode: 'insensitive',
    }
  }

  if (status && status !== 'ALL') {
    where.status = status
  }

  if (salesVisibility && salesVisibility !== 'ALL') {
    where.salesVisibility = salesVisibility
  }

  const [total, courses] = await Promise.all([
    prisma.course.count({ where }),
    // 查詢課程列表（含講師數，用於標示「全講師共管」狀態）
    prisma.course.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { instructors: true } },
      },
    }),
  ])

  return {
    courses,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * 取得單一課程
 */
export async function getCourseById(
  id: string
): Promise<CourseWithVideoWatermarkSetting | null> {
  await requireCourseManageAccess(id)

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      videoWatermarkSetting: true,
      instructors: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  return course
}

/**
 * 建立課程
 */
export async function createCourse(
  data: CourseFormData
): Promise<{ success: boolean; course?: Course; error?: string }> {
  try {
    const user = await requireAdminAuth()

    // 驗證資料
    const validatedData = courseSchema.parse(data)

    // 檢查 slug 是否已存在
    const existingCourse = await prisma.course.findUnique({
      where: { slug: validatedData.slug },
    })

    if (existingCourse) {
      return {
        success: false,
        error: '此 Slug 已被使用，請更換其他 Slug',
      }
    }

    // 建立課程
    const course = await prisma.course.create({
      data: {
        title: validatedData.title,
        subtitle: validatedData.subtitle ?? null,
        slug: validatedData.slug,
        description: validatedData.description ?? null,
        coverImage: validatedData.coverImage || null,
        price: validatedData.price,
        salePrice: validatedData.salePrice ?? null,
        saleEndAt: validatedData.saleEndAt ?? null,
        saleLabel: validatedData.saleLabel ?? null,
        saleCycleEnabled: validatedData.saleCycleEnabled ?? false,
        saleCycleDays: validatedData.saleCycleDays ?? null,
        showCountdown: validatedData.showCountdown ?? true,
        seoTitle: validatedData.seoTitle ?? null,
        seoDesc: validatedData.seoDesc ?? null,
        seoKeywords: validatedData.seoKeywords ?? null,
        ogTitle: validatedData.ogTitle ?? null,
        ogDescription: validatedData.ogDescription ?? null,
        ogImage: validatedData.ogImage || null,
        landingPageMode: validatedData.landingPageMode ?? null,
        landingPageSlug: validatedData.landingPageSlug ?? null,
        landingPageHtml: validatedData.landingPageHtml
          ? sanitizeLandingPageHtml(validatedData.landingPageHtml)
          : null,
        instructorName: validatedData.instructorName ?? null,
        instructorTitle: validatedData.instructorTitle ?? null,
        instructorDesc: validatedData.instructorDesc ?? null,
        courseWorkload: validatedData.courseWorkload ?? null,
        ratingValue: validatedData.ratingValue ?? null,
        ratingCount: validatedData.ratingCount ?? null,
        notifyAdminOnPurchase: validatedData.notifyAdminOnPurchase ?? false,
        status: validatedData.status,
        salesVisibility: validatedData.salesVisibility ?? 'PUBLIC',
        createdById: user.id,
      },
    })

    // 講師建立的課程預設只有自己可管理，避免落入「未指定講師＝全講師可管」
    // 而讓其他講師也能管理這門新課（ADMIN 本就可管理全部，不需指派）
    if (isInstructorRole(user.role)) {
      await prisma.courseInstructor.create({
        data: {
          courseId: course.id,
          userId: user.id,
          createdById: user.id,
        },
      })
    }

    // 同步到 Stripe（建立 Product + Price）- 僅在 Stripe 模式下執行
    const activeGateway = await getActiveGatewayType()
    if (activeGateway === 'stripe') {
      try {
        const stripeResult = await syncCourseToStripe({
          id: course.id,
          title: course.title,
          subtitle: course.subtitle,
          coverImage: course.coverImage,
          price: course.price,
          salePrice: course.salePrice,
        })

        if (stripeResult.stripeProductId) {
          await prisma.course.update({
            where: { id: course.id },
            data: {
              stripeProductId: stripeResult.stripeProductId,
              stripePriceId: stripeResult.stripePriceId,
              stripeSalePriceId: stripeResult.stripeSalePriceId,
            },
          })
        }
      } catch (stripeError) {
        console.error('[Stripe] 建立課程時同步失敗:', stripeError)
      }
    }

    // 記錄操作日誌
    await logAdminAction(user.id as string, 'CREATE_COURSE', course.id, {
      title: course.title,
      slug: course.slug,
      salesVisibility: course.salesVisibility,
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/courses')
    revalidatePath('/admin')

    return { success: true, course }
  } catch (error) {
    console.error('建立課程失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '建立課程時發生錯誤' }
  }
}

/**
 * 更新課程
 */
export async function updateCourse(
  id: string,
  data: CourseFormData
): Promise<{ success: boolean; course?: Course; error?: string }> {
  try {
    const user = await requireCourseManageAccess(id)

    // 驗證資料
    const validatedData = courseSchema.parse(data)

    // 檢查課程是否存在
    const existingCourse = await prisma.course.findUnique({
      where: { id },
    })

    if (!existingCourse) {
      return { success: false, error: '課程不存在' }
    }

    // 檢查 slug 是否與其他課程重複
    const slugConflict = await prisma.course.findFirst({
      where: {
        slug: validatedData.slug,
        id: { not: id },
      },
    })

    if (slugConflict) {
      return {
        success: false,
        error: '此 Slug 已被其他課程使用',
      }
    }

    // 更新課程
    const course = await prisma.course.update({
      where: { id },
      data: {
        title: validatedData.title,
        subtitle: validatedData.subtitle ?? null,
        slug: validatedData.slug,
        description: validatedData.description ?? null,
        coverImage: validatedData.coverImage || null,
        price: validatedData.price,
        salePrice: validatedData.salePrice ?? null,
        saleEndAt: validatedData.saleEndAt ?? null,
        saleLabel: validatedData.saleLabel ?? null,
        saleCycleEnabled: validatedData.saleCycleEnabled ?? false,
        saleCycleDays: validatedData.saleCycleDays ?? null,
        showCountdown: validatedData.showCountdown ?? true,
        seoTitle: validatedData.seoTitle ?? null,
        seoDesc: validatedData.seoDesc ?? null,
        seoKeywords: validatedData.seoKeywords ?? null,
        ogTitle: validatedData.ogTitle ?? null,
        ogDescription: validatedData.ogDescription ?? null,
        ogImage: validatedData.ogImage || null,
        landingPageMode: validatedData.landingPageMode ?? null,
        landingPageSlug: validatedData.landingPageSlug ?? null,
        landingPageHtml: validatedData.landingPageHtml
          ? sanitizeLandingPageHtml(validatedData.landingPageHtml)
          : null,
        instructorName: validatedData.instructorName ?? null,
        instructorTitle: validatedData.instructorTitle ?? null,
        instructorDesc: validatedData.instructorDesc ?? null,
        courseWorkload: validatedData.courseWorkload ?? null,
        ratingValue: validatedData.ratingValue ?? null,
        ratingCount: validatedData.ratingCount ?? null,
        notifyAdminOnPurchase: validatedData.notifyAdminOnPurchase ?? false,
        status: validatedData.status,
        salesVisibility: validatedData.salesVisibility ?? existingCourse.salesVisibility,
      },
    })

    // 同步到 Stripe（更新 Product / 重建 Price）- 僅在 Stripe 模式下執行
    const updateGateway = await getActiveGatewayType()
    if (updateGateway === 'stripe') {
      try {
        const stripeResult = await syncCourseToStripe({
          id: course.id,
          title: course.title,
          subtitle: course.subtitle,
          coverImage: course.coverImage,
          price: course.price,
          salePrice: course.salePrice,
          stripeProductId: existingCourse.stripeProductId,
          stripePriceId: existingCourse.stripePriceId,
          stripeSalePriceId: existingCourse.stripeSalePriceId,
        })

        const needsUpdate =
          stripeResult.stripeProductId !== existingCourse.stripeProductId ||
          stripeResult.stripePriceId !== existingCourse.stripePriceId ||
          stripeResult.stripeSalePriceId !== existingCourse.stripeSalePriceId

        if (needsUpdate) {
          await prisma.course.update({
            where: { id: course.id },
            data: {
              stripeProductId: stripeResult.stripeProductId,
              stripePriceId: stripeResult.stripePriceId,
              stripeSalePriceId: stripeResult.stripeSalePriceId,
            },
          })
        }
      } catch (stripeError) {
        console.error('[Stripe] 更新課程時同步失敗:', stripeError)
      }
    }

    // 記錄操作日誌
    await logAdminAction(user.id as string, 'UPDATE_COURSE', course.id, {
      title: course.title,
      changes: {
        before: existingCourse.title,
        after: course.title,
        salesVisibilityBefore: existingCourse.salesVisibility,
        salesVisibilityAfter: course.salesVisibility,
      },
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${id}`)
    revalidatePath('/admin')

    return { success: true, course }
  } catch (error) {
    console.error('更新課程失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新課程時發生錯誤' }
  }
}

/**
 * 刪除課程
 */
export async function deleteCourse(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireCourseManageAccess(id)

    // 檢查課程是否存在
    const course = await prisma.course.findUnique({
      where: { id },
    })

    if (!course) {
      return { success: false, error: '課程不存在' }
    }

    // 檢查是否有相關購買記錄
    const purchaseCount = await prisma.purchase.count({
      where: { courseId: id },
    })

    if (purchaseCount > 0) {
      return {
        success: false,
        error: `無法刪除：此課程有 ${purchaseCount} 筆購買記錄`,
      }
    }

    const subscriptionCount = await prisma.courseSubscription.count({
      where: { courseId: id },
    })
    if (subscriptionCount > 0) {
      return {
        success: false,
        error: `無法刪除：此課程有 ${subscriptionCount} 筆訂閱帳務紀錄。請改為下架課程，以保留金流對帳與 webhook 關聯。`,
      }
    }

    // 刪除課程
    await prisma.course.delete({
      where: { id },
    })

    // L56：歸檔對應的 Stripe Product / Price（best-effort，失敗不影響刪除）
    await archiveCourseStripeResources({
      stripeProductId: course.stripeProductId,
      stripePriceId: course.stripePriceId,
      stripeSalePriceId: course.stripeSalePriceId,
    })

    // 記錄操作日誌
    await logAdminAction(user.id as string, 'DELETE_COURSE', id, {
      title: course.title,
      slug: course.slug,
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/courses')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('刪除課程失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '刪除課程時發生錯誤' }
  }
}

/**
 * 切換課程狀態
 */
export async function toggleCourseStatus(
  id: string
): Promise<{ success: boolean; course?: Course; error?: string }> {
  try {
    const user = await requireCourseManageAccess(id)

    // 取得課程
    const course = await prisma.course.findUnique({
      where: { id },
    })

    if (!course) {
      return { success: false, error: '課程不存在' }
    }

    // 決定新狀態（三態循環：DRAFT -> PUBLISHED -> UNLISTED -> DRAFT）
    // 或者簡單的發佈/取消發佈邏輯
    let newStatus: CourseStatus
    switch (course.status) {
      case 'DRAFT':
        // 草稿 -> 發佈
        newStatus = 'PUBLISHED'
        break
      case 'PUBLISHED':
        // 已發佈 -> 隱藏（不公開但已購買者仍可觀看）
        newStatus = 'UNLISTED'
        break
      case 'UNLISTED':
        // 隱藏 -> 草稿（完全下架）
        newStatus = 'DRAFT'
        break
      default:
        newStatus = 'DRAFT'
    }

    // L48：發佈前內容驗證 — 不允許發佈「沒有任何單元」的空課程
    if (newStatus === 'PUBLISHED') {
      const lessonCount = await prisma.lesson.count({
        where: { chapter: { courseId: id } },
      })
      if (lessonCount === 0) {
        return { success: false, error: '課程尚無任何單元，請先新增內容後再發佈' }
      }
    }

    // 更新狀態
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: { status: newStatus },
    })

    // 記錄操作日誌
    await logAdminAction(user.id as string, 'UPDATE_COURSE', id, {
      action: 'toggle_status',
      from: course.status,
      to: newStatus,
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/courses')
    revalidatePath('/admin')

    return { success: true, course: updatedCourse }
  } catch (error) {
    console.error('切換課程狀態失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '切換狀態時發生錯誤' }
  }
}

/**
 * 更新課程定價（定價與促銷 tab）
 */
export async function updateCoursePricing(
  id: string,
  data: CoursePricingFormData
): Promise<{ success: boolean; course?: Course; error?: string }> {
  try {
    const user = await requireCourseManageAccess(id)
    const validatedData = coursePricingSchema.parse(data)

    const existingCourse = await prisma.course.findUnique({ where: { id } })
    if (!existingCourse) {
      return { success: false, error: '課程不存在' }
    }

    const course = await prisma.course.update({
      where: { id },
      data: {
        price: validatedData.price,
        salePrice: validatedData.salePrice ?? null,
        saleEndAt: validatedData.saleEndAt ?? null,
        saleLabel: validatedData.saleLabel ?? null,
        saleCycleEnabled: validatedData.saleCycleEnabled ?? false,
        saleCycleDays: validatedData.saleCycleDays ?? null,
        showCountdown: validatedData.showCountdown ?? true,
        accessType: validatedData.accessType ?? 'LIFETIME',
        accessDurationDays:
          validatedData.accessType === 'DURATION'
            ? (validatedData.accessDurationDays ?? null)
            : null,
        accessExpiresAt:
          validatedData.accessType === 'FIXED_DATE'
            ? (validatedData.accessExpiresAt ?? null)
            : null,
        expirationReminderEnabled: validatedData.expirationReminderEnabled ?? true,
        expirationReminderDays:
          validatedData.expirationReminderDays ?? [30, 7, 1],
      },
    })

    // 同步到 Stripe
    const activeGateway = await getActiveGatewayType()
    if (activeGateway === 'stripe') {
      try {
        const stripeResult = await syncCourseToStripe({
          id: course.id,
          title: course.title,
          subtitle: course.subtitle,
          coverImage: course.coverImage,
          price: course.price,
          salePrice: course.salePrice,
          stripeProductId: existingCourse.stripeProductId,
          stripePriceId: existingCourse.stripePriceId,
          stripeSalePriceId: existingCourse.stripeSalePriceId,
        })

        const needsUpdate =
          stripeResult.stripeProductId !== existingCourse.stripeProductId ||
          stripeResult.stripePriceId !== existingCourse.stripePriceId ||
          stripeResult.stripeSalePriceId !== existingCourse.stripeSalePriceId

        if (needsUpdate) {
          await prisma.course.update({
            where: { id: course.id },
            data: {
              stripeProductId: stripeResult.stripeProductId,
              stripePriceId: stripeResult.stripePriceId,
              stripeSalePriceId: stripeResult.stripeSalePriceId,
            },
          })
        }
      } catch (stripeError) {
        console.error('[Stripe] 更新定價時同步失敗:', stripeError)
      }
    }

    await logAdminAction(user.id as string, 'UPDATE_COURSE', course.id, {
      tab: 'pricing',
      price: course.price,
      salePrice: course.salePrice,
    })

    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${id}`)
    revalidatePath(`/courses/${course.slug}`)

    return { success: true, course }
  } catch (error) {
    console.error('更新課程定價失敗:', error)
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '更新課程定價時發生錯誤' }
  }
}

/**
 * 更新課程詳細設定（課程資訊 tab，包含基本資訊 + 行銷設定）
 */
export async function updateCourseDetails(
  id: string,
  data: CourseDetailsFormData
): Promise<{ success: boolean; course?: Course; error?: string }> {
  try {
    const user = await requireCourseManageAccess(id)
    const validatedData = courseDetailsSchema.parse(data)

    const existingCourse = await prisma.course.findUnique({ where: { id } })
    if (!existingCourse) {
      return { success: false, error: '課程不存在' }
    }

    const slugConflict = await prisma.course.findFirst({
      where: { slug: validatedData.slug, id: { not: id } },
    })
    if (slugConflict) {
      return { success: false, error: '此 Slug 已被其他課程使用' }
    }

    const course = await prisma.course.update({
      where: { id },
      data: {
        title: validatedData.title,
        subtitle: validatedData.subtitle ?? null,
        slug: validatedData.slug,
        description: validatedData.description ?? null,
        coverImage: validatedData.coverImage || null,
        instructorName: validatedData.instructorName ?? null,
        instructorTitle: validatedData.instructorTitle ?? null,
        instructorDesc: validatedData.instructorDesc ?? null,
        status: validatedData.status,
        salesVisibility: validatedData.salesVisibility ?? existingCourse.salesVisibility,
        seoTitle: validatedData.seoTitle ?? null,
        seoDesc: validatedData.seoDesc ?? null,
        seoKeywords: validatedData.seoKeywords ?? null,
        ogTitle: validatedData.ogTitle ?? null,
        ogDescription: validatedData.ogDescription ?? null,
        ogImage: validatedData.ogImage || null,
        landingPageMode: validatedData.landingPageMode ?? null,
        landingPageSlug: validatedData.landingPageSlug ?? null,
        landingPageHtml: validatedData.landingPageHtml
          ? sanitizeLandingPageHtml(validatedData.landingPageHtml)
          : null,
        notifyAdminOnPurchase: validatedData.notifyAdminOnPurchase ?? false,
        videoWatermarkSetting: {
          upsert: {
            create: {
              enabled: validatedData.watermarkEnabled ?? false,
              showEmail: validatedData.watermarkShowEmail ?? true,
              showCourseTitle: validatedData.watermarkShowCourseTitle ?? true,
              showTimestamp: validatedData.watermarkShowTimestamp ?? true,
              emailDisplayMode:
                (validatedData.watermarkEmailDisplayMode as WatermarkEmailDisplayMode | undefined) ??
                'FULL',
              opacityPercent: validatedData.watermarkOpacityPercent ?? 18,
              textSize:
                (validatedData.watermarkTextSize as WatermarkTextSize | undefined) ?? 'MD',
              movementMode:
                (validatedData.watermarkMovementMode as WatermarkMovementMode | undefined) ??
                'STANDARD',
              moveIntervalSec: validatedData.watermarkMoveIntervalSec ?? 12,
              tamperPauseEnabled:
                validatedData.watermarkTamperPauseEnabled ?? true,
            },
            update: {
              enabled: validatedData.watermarkEnabled ?? false,
              showEmail: validatedData.watermarkShowEmail ?? true,
              showCourseTitle: validatedData.watermarkShowCourseTitle ?? true,
              showTimestamp: validatedData.watermarkShowTimestamp ?? true,
              emailDisplayMode:
                (validatedData.watermarkEmailDisplayMode as WatermarkEmailDisplayMode | undefined) ??
                'FULL',
              opacityPercent: validatedData.watermarkOpacityPercent ?? 18,
              textSize:
                (validatedData.watermarkTextSize as WatermarkTextSize | undefined) ?? 'MD',
              movementMode:
                (validatedData.watermarkMovementMode as WatermarkMovementMode | undefined) ??
                'STANDARD',
              moveIntervalSec: validatedData.watermarkMoveIntervalSec ?? 12,
              tamperPauseEnabled:
                validatedData.watermarkTamperPauseEnabled ?? true,
            },
          },
        },
      },
    })

    await logAdminAction(user.id as string, 'UPDATE_COURSE', course.id, {
      tab: 'details',
      title: course.title,
      salesVisibilityBefore: existingCourse.salesVisibility,
      salesVisibilityAfter: course.salesVisibility,
    })

    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${id}`)
    revalidatePath(`/courses/${course.slug}`)
    revalidatePath('/admin')

    return { success: true, course }
  } catch (error) {
    console.error('更新課程詳細設定失敗:', error)
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '更新課程資訊時發生錯誤' }
  }
}

/**
 * 更新課程講師管理權限。空陣列代表全部講師皆可管理。
 */
export async function updateCourseInstructors(
  courseId: string,
  instructorIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireCourseManageAccess(courseId)
    const validatedIds = Array.from(new Set(courseInstructorIdsSchema.parse(instructorIds)))

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { createdById: true },
    })
    if (!course) return { success: false, error: '課程不存在' }
    if (user.role !== 'ADMIN' && course.createdById !== user.id) {
      return { success: false, error: '只有管理員或開課講師可以調整講師管理權限' }
    }

    // 取得現有講師名單，做差異更新（只刪移除的、只建新增的），
    // 以保留既有指派列的 createdAt / createdById，並可在稽核記錄變動明細
    const existingRows = await prisma.courseInstructor.findMany({
      where: { courseId },
      select: { userId: true },
    })
    const existingIds = existingRows.map((row) => row.userId)
    const toAdd = validatedIds.filter((id) => !existingIds.includes(id))
    const toRemove = existingIds.filter((id) => !validatedIds.includes(id))

    if (toAdd.length > 0) {
      const instructors = await prisma.user.findMany({
        where: { id: { in: toAdd }, role: { in: ['INSTRUCTOR', 'EDITOR'] } },
        select: { id: true },
      })
      const validIdSet = new Set(instructors.map((instructor) => instructor.id))
      const invalidIds = toAdd.filter((id) => !validIdSet.has(id))
      if (invalidIds.length > 0) {
        return { success: false, error: '包含無效的講師帳號' }
      }
    }

    if (toAdd.length > 0 || toRemove.length > 0) {
      await prisma.$transaction([
        ...(toRemove.length > 0
          ? [
              prisma.courseInstructor.deleteMany({
                where: { courseId, userId: { in: toRemove } },
              }),
            ]
          : []),
        ...toAdd.map((instructorId) =>
          prisma.courseInstructor.create({
            data: {
              courseId,
              userId: instructorId,
              createdById: user.id,
            },
          })
        ),
      ])
    }

    await logAdminAction(user.id, 'UPDATE_COURSE', courseId, {
      tab: 'instructors',
      before: existingIds,
      instructorIds: validatedIds,
      added: toAdd,
      removed: toRemove,
      scope: validatedIds.length === 0 ? 'all_instructors' : 'selected_instructors',
    })

    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${courseId}`)
    revalidatePath(`/admin/courses/${courseId}/info`)

    return { success: true }
  } catch (error) {
    console.error('更新課程講師權限失敗:', error)
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '更新課程講師權限時發生錯誤' }
  }
}
