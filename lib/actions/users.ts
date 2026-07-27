// lib/actions/users.ts
// 用戶管理 Server Actions
// 提供用戶查詢、角色管理、課程授權操作

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, requireOnlyAdminAuth } from '@/lib/require-admin'
import {
  manageableCourseWhereForUser,
  requireCourseManageAccess,
  canManageCourse,
  getManageableCourseIds,
  isFullAdmin,
} from '@/lib/course-permissions'
import {
  grantAccessSchema,
  revokeAccessSchema,
  extendAccessSchema,
  updateRoleSchema,
  createAdminUserSchema,
  importStudentsSchema,
  searchUsersSchema,
  assignTeamRoleSchema,
  type GrantAccessData,
  type RevokeAccessData,
  type ExtendAccessData,
  type UpdateRoleData,
  type CreateAdminUserData,
  type ImportStudentsData,
  type AssignTeamRoleData,
} from '@/lib/validations/user'
import { computeExpiresAt } from '@/lib/purchase/compute-expires-at'
import { sendCourseAccessExtendedEmail } from '@/lib/email'
import { sendAccountInviteEmail } from '@/lib/account-invite'
import type { User, Purchase, Course, Prisma, UserRole } from '@prisma/client'

/**
 * 用戶列表查詢參數
 */
export interface GetUsersParams {
  search?: string
  role?: 'ALL' | 'USER' | 'INSTRUCTOR' | 'ADMIN'
  hasPurchase?: 'all' | 'yes' | 'no'
  /** 依課程篩選：只顯示持有此課程有效授權的用戶 */
  courseId?: string
  page?: number
  pageSize?: number
}

/**
 * 用戶資訊（含購買數量）
 */
export interface UserWithPurchaseCount extends User {
  _count: {
    purchases: number
  }
}

/**
 * 用戶列表回傳結果
 */
export interface GetUsersResult {
  users: UserWithPurchaseCount[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 用戶詳情（含購買記錄和學習進度）
 */
export interface UserDetail extends User {
  purchases: (Purchase & {
    course: Course
  })[]
  progress: {
    lessonId: string
    completed: boolean
    watchedSec: number
    lastWatchAt: Date
    lesson: {
      id: string
      title: string
      videoDuration: number | null
      chapter: {
        id: string
        title: string
        courseId: string
        course: {
          id: string
          title: string
        }
      }
    }
  }[]
}

/**
 * 管理員用戶資訊
 */
export interface AdminUser extends User {
  _count: {
    adminLogs: number
  }
}

/**
 * 課程進度統計
 */
export interface CourseProgress {
  courseId: string
  courseTitle: string
  totalLessons: number
  completedLessons: number
  totalDuration: number
  watchedDuration: number
  progressPercent: number
  lastWatchAt: Date | null
}

// requireAdminAuth, requireOnlyAdminAuth 從 @/lib/require-admin 引入（直接查 DB 確保角色即時生效）

/**
 * 記錄管理員操作日誌
 */
async function logAdminAction(
  adminId: string,
  action: 'GRANT_ACCESS' | 'REVOKE_ACCESS' | 'UPDATE_USER_ROLE' | 'EXTEND_ACCESS',
  targetId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType: 'User',
        targetId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    })
  } catch (error) {
    console.error('記錄操作日誌失敗:', error)
  }
}

/**
 * 取得用戶列表
 */
export async function getUsers(
  params: GetUsersParams = {}
): Promise<GetUsersResult> {
  const actor = await requireAdminAuth()
  const manageableCourseIds = await getManageableCourseIds(actor)

  const { search, role = 'USER', hasPurchase = 'all', courseId, page = 1, pageSize = 20 } = params

  // 建立查詢條件
  const where: Prisma.UserWhereInput = {}

  if (role === 'INSTRUCTOR') {
    where.role = { in: ['INSTRUCTOR', 'EDITOR'] }
  } else if (role !== 'ALL') {
    where.role = role
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  // 課程篩選優先於「有/無購買」：只顯示持有此課程有效授權的用戶
  if (courseId) {
    where.purchases = { some: { courseId, revokedAt: null } }
  } else if (hasPurchase === 'yes') {
    where.purchases = { some: {} }
  } else if (hasPurchase === 'no') {
    where.purchases = { none: {} }
  }

  // 講師只能看到自己可管理課程的學員（ADMIN 回傳 null 表示不限制）
  // 同時鎖定為一般學員角色，避免講師看到其他講師/管理員
  if (manageableCourseIds !== null) {
    where.role = 'USER'
    // 若有指定課程篩選且該課程在可管理範圍內，收斂到該課程；否則沿用全部可管理課程
    const effectiveCourseIds =
      courseId && manageableCourseIds.includes(courseId)
        ? [courseId]
        : manageableCourseIds
    where.purchases = {
      some: { courseId: { in: effectiveCourseIds }, revokedAt: null },
    }
  }

  // 講師看到的購買數僅計入自己可管理的課程
  const countSelect =
    manageableCourseIds !== null
      ? { purchases: { where: { courseId: { in: manageableCourseIds } } } }
      : { purchases: true }

  // 查詢總數
  const total = await prisma.user.count({ where })

  // 查詢用戶列表
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      _count: {
        select: countSelect,
      },
    },
  })

  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * 取得單一用戶詳情
 */
export async function getUserById(id: string): Promise<UserDetail | null> {
  const actor = await requireAdminAuth()
  const manageableCourseIds = await getManageableCourseIds(actor)

  // 講師檢視用戶詳情時，購買與進度僅限自己可管理的課程
  const purchaseWhere =
    manageableCourseIds !== null
      ? { revokedAt: null, courseId: { in: manageableCourseIds } }
      : { revokedAt: null }
  const progressWhere =
    manageableCourseIds !== null
      ? { lesson: { chapter: { courseId: { in: manageableCourseIds } } } }
      : undefined

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      purchases: {
        where: purchaseWhere,
        include: {
          course: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      progress: {
        where: progressWhere,
        include: {
          lesson: {
            include: {
              chapter: {
                include: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { lastWatchAt: 'desc' },
      },
    },
  })

  if (!user) {
    return null
  }

  // 講師僅能檢視自己可管理課程的學員（且不可檢視其他講師/管理員）
  if (manageableCourseIds !== null) {
    if (user.role !== 'USER' || user.purchases.length === 0) {
      return null
    }
  }

  // 不要把密碼雜湊回傳到 client
  return { ...user, password: null } as UserDetail
}

/**
 * 取得用戶學習進度（按課程統計）
 */
export async function getUserProgress(userId: string): Promise<CourseProgress[]> {
  const actor = await requireAdminAuth()
  const manageableCourseIds = await getManageableCourseIds(actor)

  // 取得用戶已購買的課程（講師僅限自己可管理的課程）
  const purchases = await prisma.purchase.findMany({
    where: {
      userId,
      revokedAt: null,
      ...(manageableCourseIds !== null
        ? { courseId: { in: manageableCourseIds } }
        : {}),
    },
    include: {
      course: {
        include: {
          chapters: {
            include: {
              lessons: {
                select: {
                  id: true,
                  videoDuration: true,
                },
              },
            },
          },
        },
      },
    },
  })

  // 取得用戶的學習進度
  const progress = await prisma.lessonProgress.findMany({
    where: { userId },
  })

  // 建立進度查詢 Map
  const progressMap = new Map(
    progress.map((p) => [p.lessonId, p])
  )

  // 計算每個課程的進度
  const courseProgressList: CourseProgress[] = purchases.map((purchase) => {
    const course = purchase.course
    let totalLessons = 0
    let completedLessons = 0
    let totalDuration = 0
    let watchedDuration = 0
    let lastWatchAt: Date | null = null

    course.chapters.forEach((chapter) => {
      chapter.lessons.forEach((lesson) => {
        totalLessons++
        totalDuration += lesson.videoDuration ?? 0

        const lessonProgress = progressMap.get(lesson.id)
        if (lessonProgress) {
          if (lessonProgress.completed) {
            completedLessons++
          }
          watchedDuration += lessonProgress.watchedSec
          if (!lastWatchAt || lessonProgress.lastWatchAt > lastWatchAt) {
            lastWatchAt = lessonProgress.lastWatchAt
          }
        }
      })
    })

    const progressPercent = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0

    return {
      courseId: course.id,
      courseTitle: course.title,
      totalLessons,
      completedLessons,
      totalDuration,
      watchedDuration,
      progressPercent,
      lastWatchAt,
    }
  })

  return courseProgressList
}

/**
 * 取得管理員與講師列表
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  await requireOnlyAdminAuth()

  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'INSTRUCTOR', 'EDITOR'] },
    },
    orderBy: [
      { role: 'asc' },
      { createdAt: 'desc' },
    ],
    include: {
      _count: {
        select: { adminLogs: true },
      },
    },
  })

  return admins
}

/**
 * 取得講師選項
 */
export async function getInstructorUsers(): Promise<{ id: string; name: string | null; email: string }[]> {
  const actor = await requireAdminAuth()

  // L47：指派講師為 ADMIN 專屬功能。非 ADMIN（含講師）不應取得全站講師的 Email 等 PII，
  // 回傳空陣列即可（課程資訊頁的講師選擇器本就僅 ADMIN 可操作），避免頁面為講師崩潰。
  if (!isFullAdmin(actor.role)) {
    return []
  }

  return prisma.user.findMany({
    where: { role: { in: ['INSTRUCTOR', 'EDITOR'] } },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: { id: true, name: true, email: true },
  })
}

/**
 * 後台新增用戶
 */
export async function createAdminUser(
  data: CreateAdminUserData
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const currentUser = await requireOnlyAdminAuth()
    const validatedData = createAdminUserSchema.parse(data)

    const existing = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
      select: { id: true },
    })

    if (existing) {
      return { success: false, error: '此 Email 已存在' }
    }

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email.toLowerCase(),
        role: validatedData.role,
        // H6：標記為待啟用（guest），帳號在設定密碼前無法以密碼登入（authorize 會拒絕無密碼帳號）
        isGuest: true,
        guestSource: 'admin_invite',
      },
    })

    // 同流程指派課程（可多選；ADMIN 可授權任何課程）
    const courseIds = validatedData.courseIds ?? []
    let grantedCourseTitles: string[] = []
    if (courseIds.length > 0) {
      const courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
      })
      grantedCourseTitles = courses.map((c) => c.title)
      for (const course of courses) {
        await prisma.purchase.create({
          data: {
            userId: user.id,
            courseId: course.id,
            grantedBy: currentUser.id as string,
            source: 'ADMIN_GRANT',
            expiresAt: computeExpiresAt(course),
          },
        })
      }
    }

    // 寄送設定密碼邀請信（預設關閉，僅當 sendInvite 為 true 時）
    let inviteEmailSent = false
    if (validatedData.sendInvite) {
      const roleLabel =
        validatedData.role === 'ADMIN'
          ? '管理員'
          : validatedData.role === 'INSTRUCTOR'
            ? '講師'
            : undefined
      const result = await sendAccountInviteEmail(user.id, {
        courseTitles: grantedCourseTitles.length > 0 ? grantedCourseTitles : undefined,
        roleLabel,
      })
      inviteEmailSent = result.success
    }

    await logAdminAction(currentUser.id, 'UPDATE_USER_ROLE', user.id, {
      action: 'create_user',
      role: validatedData.role,
      email: user.email,
      courseIds,
      sendInvite: !!validatedData.sendInvite,
      inviteEmailSent,
    })

    revalidatePath('/admin/users')
    revalidatePath('/admin/instructors')

    return { success: true, id: user.id }
  } catch (error) {
    console.error('新增用戶失敗:', error)
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '新增用戶時發生錯誤' }
  }
}

/**
 * 更新用戶角色
 */
export async function updateUserRole(
  data: UpdateRoleData
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireOnlyAdminAuth()

    // 驗證資料
    const validatedData = updateRoleSchema.parse(data)

    // 檢查是否修改自己的角色
    if (validatedData.userId === currentUser.id) {
      return { success: false, error: '無法修改自己的角色' }
    }

    // 查詢目標用戶
    const targetUser = await prisma.user.findUnique({
      where: { id: validatedData.userId },
    })

    if (!targetUser) {
      return { success: false, error: '用戶不存在' }
    }

    // 如果目標用戶是 ADMIN，檢查是否為最後一位管理員
    if (targetUser.role === 'ADMIN' && validatedData.role !== 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      })

      if (adminCount <= 1) {
        return { success: false, error: '必須保留至少一位管理員' }
      }
    }

    // L53：角色變更為高敏感操作，將「更新角色」與「稽核日誌」放在同一 transaction，
    // 確保不會發生「角色已改但稽核軌跡遺失」的情況（稽核失敗則整筆 rollback）。
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: validatedData.userId },
        data: { role: validatedData.role },
      })

      // L57：降級為一般 USER 時，清除其所有課程講師指派，
      // 避免殘留的 CourseInstructor 列污染講師計數與課程管理範圍判定。
      if (validatedData.role === 'USER') {
        await tx.courseInstructor.deleteMany({
          where: { userId: validatedData.userId },
        })
      }

      await tx.adminLog.create({
        data: {
          adminId: currentUser.id as string,
          action: 'UPDATE_USER_ROLE',
          targetType: 'User',
          targetId: validatedData.userId,
          details: { from: targetUser.role, to: validatedData.role },
        },
      })
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/users')
    revalidatePath('/admin/instructors')
    revalidatePath(`/admin/users/${validatedData.userId}`)

    return { success: true }
  } catch (error) {
    console.error('更新用戶角色失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新角色時發生錯誤' }
  }
}

/**
 * 手動授權課程存取
 */
export async function grantCourseAccess(
  data: GrantAccessData
): Promise<{ success: boolean; error?: string }> {
  try {
    // 驗證資料
    const validatedData = grantAccessSchema.parse(data)
    const currentUser = await requireCourseManageAccess(validatedData.courseId)

    // 檢查用戶是否存在
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId },
    })

    if (!user) {
      return { success: false, error: '用戶不存在' }
    }

    // 檢查課程是否存在
    const course = await prisma.course.findUnique({
      where: { id: validatedData.courseId },
    })

    if (!course) {
      return { success: false, error: '課程不存在' }
    }

    // 檢查是否已有授權記錄
    const existingPurchase = await prisma.purchase.findUnique({
      where: {
        userId_courseId: {
          userId: validatedData.userId,
          courseId: validatedData.courseId,
        },
      },
    })

    // 決定到期日：course_default 套用課程預設，custom 用輸入值
    const mode = validatedData.expiresMode ?? 'custom'
    const expiresAt =
      mode === 'course_default'
        ? computeExpiresAt(course)
        : (validatedData.expiresAt ?? null)

    if (existingPurchase) {
      // 如果已有授權但被撤銷，則恢復授權
      if (existingPurchase.revokedAt) {
        await prisma.purchase.update({
          where: { id: existingPurchase.id },
          data: {
            revokedAt: null,
            grantedBy: currentUser.id as string,
            grantNote: validatedData.grantNote ?? null,
            source: 'ADMIN_GRANT',
            expiresAt,
          },
        })
      } else {
        return { success: false, error: '用戶已擁有此課程的存取權限' }
      }
    } else {
      // 建立新的授權記錄
      await prisma.purchase.create({
        data: {
          userId: validatedData.userId,
          courseId: validatedData.courseId,
          grantedBy: currentUser.id as string,
          grantNote: validatedData.grantNote ?? null,
          source: 'ADMIN_GRANT',
          expiresAt,
        },
      })
    }

    // 通知學員（預設開啟）
    const notifyUser = validatedData.notifyUser ?? true
    if (notifyUser && user.email) {
      void sendCourseAccessExtendedEmail({
        toEmail: user.email,
        userName: user.name,
        courseTitle: course.title,
        courseSlug: course.slug,
        previousExpiresAt: existingPurchase?.expiresAt ?? null,
        newExpiresAt: expiresAt,
        reason: 'granted',
        note: validatedData.grantNote ?? null,
      })
    }

    // 記錄操作日誌
    await logAdminAction(
      currentUser.id as string,
      'GRANT_ACCESS',
      validatedData.userId,
      {
        courseId: validatedData.courseId,
        courseTitle: course.title,
        expiresAt,
        expiresMode: mode,
        note: validatedData.grantNote,
        notifyUser,
      }
    )

    // 重新驗證頁面快取
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${validatedData.userId}`)

    return { success: true }
  } catch (error) {
    console.error('授權課程存取失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '授權課程時發生錯誤' }
  }
}

/**
 * 撤銷課程存取權限
 */
export async function revokeCourseAccess(
  data: RevokeAccessData
): Promise<{ success: boolean; error?: string }> {
  try {
    // 驗證資料
    const validatedData = revokeAccessSchema.parse(data)
    const currentUser = await requireCourseManageAccess(validatedData.courseId)

    // 查詢授權記錄
    const purchase = await prisma.purchase.findUnique({
      where: {
        userId_courseId: {
          userId: validatedData.userId,
          courseId: validatedData.courseId,
        },
      },
      include: {
        course: true,
      },
    })

    if (!purchase) {
      return { success: false, error: '找不到授權記錄' }
    }

    if (purchase.revokedAt) {
      return { success: false, error: '此授權已被撤銷' }
    }

    // 撤銷授權
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { revokedAt: new Date() },
    })

    // 記錄操作日誌
    await logAdminAction(
      currentUser.id as string,
      'REVOKE_ACCESS',
      validatedData.userId,
      {
        courseId: validatedData.courseId,
        courseTitle: purchase.course.title,
      }
    )

    // 重新驗證頁面快取
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${validatedData.userId}`)

    return { success: true }
  } catch (error) {
    console.error('撤銷課程存取失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '撤銷課程時發生錯誤' }
  }
}

/**
 * 延長或縮短學員的課程有效期
 * - mode='add_days'：從目前 expiresAt（或現在，若已永久/已過期）加上 N 天
 * - mode='set_date'：直接設定為指定到期日（expiresAt=null 代表改為永久）
 */
export async function extendCourseAccess(
  data: ExtendAccessData
): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = extendAccessSchema.parse(data)
    const currentUser = await requireCourseManageAccess(validated.courseId)

    const purchase = await prisma.purchase.findUnique({
      where: {
        userId_courseId: {
          userId: validated.userId,
          courseId: validated.courseId,
        },
      },
      include: {
        course: { select: { title: true, slug: true } },
        user: { select: { email: true, name: true } },
      },
    })

    if (!purchase) {
      return { success: false, error: '找不到授權記錄' }
    }
    if (purchase.revokedAt) {
      return { success: false, error: '此授權已被撤銷，請先恢復授權' }
    }

    const previousExpiresAt = purchase.expiresAt
    let nextExpiresAt: Date | null

    if (validated.mode === 'add_days') {
      if (!validated.days) {
        return { success: false, error: '請提供延長天數' }
      }
      // 若目前為永久，不可再加天數（會反而縮短）
      if (!previousExpiresAt) {
        return {
          success: false,
          error: '目前為永久授權，無法再延長；若要調整請改用「設定到期日」',
        }
      }
      // 若已過期，從現在起算
      const base =
        previousExpiresAt.getTime() > Date.now() ? previousExpiresAt : new Date()
      nextExpiresAt = new Date(
        base.getTime() + validated.days * 24 * 60 * 60 * 1000
      )
    } else {
      // set_date
      nextExpiresAt = validated.expiresAt ?? null
    }

    await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        expiresAt: nextExpiresAt,
        grantNote: validated.grantNote ?? purchase.grantNote,
      },
    })

    // 清除已發送過的「未來到期提醒」記錄，讓新的到期日重新觸發提醒
    if (nextExpiresAt) {
      await prisma.courseExpirationReminder.deleteMany({
        where: {
          purchaseId: purchase.id,
          daysBefore: { gt: 0 },
        },
      })
    }

    // 通知學員（預設開啟）
    const notifyUser = validated.notifyUser ?? true
    if (notifyUser && purchase.user.email) {
      void sendCourseAccessExtendedEmail({
        toEmail: purchase.user.email,
        userName: purchase.user.name,
        courseTitle: purchase.course.title,
        courseSlug: purchase.course.slug,
        previousExpiresAt,
        newExpiresAt: nextExpiresAt,
        reason: 'extended',
        note: validated.grantNote ?? null,
      })
    }

    await logAdminAction(
      currentUser.id as string,
      'EXTEND_ACCESS',
      validated.userId,
      {
        courseId: validated.courseId,
        courseTitle: purchase.course.title,
        mode: validated.mode,
        previousExpiresAt,
        nextExpiresAt,
        note: validated.grantNote,
        notifyUser,
      }
    )

    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${validated.userId}`)

    return { success: true }
  } catch (error) {
    console.error('延長課程存取失敗:', error)
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '延長課程時發生錯誤' }
  }
}

/**
 * 匯出學員列表為 CSV（根據篩選條件，不分頁）
 */
export async function exportUsersCSV(
  params: Pick<GetUsersParams, 'search' | 'hasPurchase' | 'role' | 'courseId'>
): Promise<string> {
  const actor = await requireAdminAuth()
  const manageableCourseIds = await getManageableCourseIds(actor)

  const { search, role = 'ALL', hasPurchase = 'all', courseId } = params

  // 建立查詢條件（與 getUsers 相同邏輯）
  const where: Prisma.UserWhereInput = {}

  if (role === 'INSTRUCTOR') {
    where.role = { in: ['INSTRUCTOR', 'EDITOR'] }
  } else if (role !== 'ALL') {
    where.role = role
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  // 課程篩選優先於「有/無購買」
  if (courseId) {
    where.purchases = { some: { courseId, revokedAt: null } }
  } else if (hasPurchase === 'yes') {
    where.purchases = { some: {} }
  } else if (hasPurchase === 'no') {
    where.purchases = { none: {} }
  }

  // 講師只能匯出自己可管理課程的學員
  if (manageableCourseIds !== null) {
    where.role = 'USER'
    const effectiveCourseIds =
      courseId && manageableCourseIds.includes(courseId)
        ? [courseId]
        : manageableCourseIds
    where.purchases = {
      some: { courseId: { in: effectiveCourseIds }, revokedAt: null },
    }
  }

  // 查詢所有符合條件的用戶（含購買的課程名稱）
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      purchases: {
        where:
          manageableCourseIds !== null
            ? { revokedAt: null, courseId: { in: manageableCourseIds } }
            : { revokedAt: null },
        include: {
          course: { select: { title: true } },
        },
      },
    },
  })

  // CSV 欄位轉義（含公式注入防護）
  const escapeCsv = (value: string) => {
    let safe = value
    // 防止 CSV Injection：開頭為公式觸發字元時加上單引號前綴
    if (/^[=+\-@\t\r]/.test(safe)) {
      safe = `'${safe}`
    }
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe !== value) {
      return `"${safe.replace(/"/g, '""')}"`
    }
    return safe
  }

  // 產生 CSV
  const header = '姓名,Email,電話,已購課程數,已購課程,註冊日期'
  const rows = users.map((user) => {
    const name = escapeCsv(user.name ?? '')
    const email = escapeCsv(user.email)
    const phone = user.phone ?? '-'
    const purchaseCount = user.purchases.length.toString()
    const courseNames = escapeCsv(
      user.purchases.map((p) => p.course.title).join(', ')
    )
    const createdAt = user.createdAt.toISOString().split('T')[0]

    return `${name},${email},${phone},${purchaseCount},${courseNames},${createdAt}`
  })

  return [header, ...rows].join('\n')
}

/**
 * 取得所有可授權的課程（用於授權對話框）
 */
export async function getAvailableCourses(): Promise<{ id: string; title: string }[]> {
  const user = await requireAdminAuth()

  const courses = await prisma.course.findMany({
    where: {
      status: { in: ['PUBLISHED', 'UNLISTED'] },
      ...manageableCourseWhereForUser(user),
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: { title: 'asc' },
  })

  return courses
}

/**
 * 取得可管理的課程清單（不限狀態，含草稿）
 * 用於：學員管理頁的課程篩選下拉、新增/匯入時的課程指派
 */
export async function getManageableCourseOptions(): Promise<{ id: string; title: string }[]> {
  const user = await requireAdminAuth()

  return prisma.course.findMany({
    where: manageableCourseWhereForUser(user),
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  })
}

/**
 * 講師管理 — 即時搜尋既有用戶（依 Email 或姓名）
 * 僅 ADMIN 可用，限制回傳筆數
 */
export interface UserSearchResult {
  id: string
  name: string | null
  email: string
  role: UserRole
}

export async function searchUsersForRole(query: string): Promise<UserSearchResult[]> {
  await requireOnlyAdminAuth()

  const parsed = searchUsersSchema.safeParse({ query })
  if (!parsed.success) return []

  const q = parsed.data.query

  return prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    take: 8,
  })
}

/**
 * 講師管理 — 將既有用戶設為講師/管理員，或直接新建並設定角色
 * - 帶 userId：既有用戶升級角色
 * - 帶 email：建立新的 guest 帳號並設定角色
 * sendInvite 為 true 時寄送設定密碼邀請信
 */
export async function assignTeamRole(
  data: AssignTeamRoleData
): Promise<{ success: boolean; error?: string; id?: string; created?: boolean }> {
  try {
    const currentUser = await requireOnlyAdminAuth()
    const validated = assignTeamRoleSchema.parse(data)
    const roleLabel = validated.role === 'ADMIN' ? '管理員' : '講師'

    let userId: string
    let isNew = false

    if (validated.userId) {
      // 既有用戶 → 升級角色
      if (validated.userId === currentUser.id) {
        return { success: false, error: '無法修改自己的角色' }
      }
      const target = await prisma.user.findUnique({
        where: { id: validated.userId },
        select: { id: true, role: true },
      })
      if (!target) {
        return { success: false, error: '用戶不存在' }
      }
      userId = target.id

      if (target.role !== validated.role) {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { role: validated.role },
          })
          await tx.adminLog.create({
            data: {
              adminId: currentUser.id as string,
              action: 'UPDATE_USER_ROLE',
              targetType: 'User',
              targetId: userId,
              details: {
                from: target.role,
                to: validated.role,
                via: 'instructor_admin_page',
              },
            },
          })
        })
      }
    } else {
      // 新用戶 → 建立 guest 帳號並設定角色
      const email = validated.email!.toLowerCase()
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      if (existing) {
        return {
          success: false,
          error: '此 Email 已存在，請改從下方清單選取該用戶',
        }
      }
      const created = await prisma.user.create({
        data: {
          email,
          name: validated.name || null,
          role: validated.role,
          isGuest: true,
          guestSource: 'admin_invite',
        },
      })
      userId = created.id
      isNew = true

      await logAdminAction(currentUser.id as string, 'UPDATE_USER_ROLE', userId, {
        action: 'create_team_member',
        role: validated.role,
        email,
      })
    }

    // 寄送設定密碼邀請信
    let inviteEmailSent = false
    if (validated.sendInvite) {
      const result = await sendAccountInviteEmail(userId, { roleLabel })
      inviteEmailSent = result.success
    }

    if (validated.sendInvite) {
      await logAdminAction(currentUser.id as string, 'UPDATE_USER_ROLE', userId, {
        action: 'team_invite_email',
        role: validated.role,
        inviteEmailSent,
      })
    }

    revalidatePath('/admin/users')
    revalidatePath('/admin/instructors')

    return { success: true, id: userId, created: isNew }
  } catch (error) {
    console.error('指派講師/管理員失敗:', error)
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: '指派角色時發生錯誤' }
  }
}

/**
 * 匯入結果
 */
export interface ImportStudentsResult {
  success: boolean
  error?: string
  summary?: {
    totalRows: number
    newUsers: number
    existingUsers: number
    newGrants: number
    alreadyGranted: number
    errors: { row: number; email: string; error: string }[]
  }
}

/**
 * 批次匯入學員
 * - 根據 email 判斷是否為既有用戶，若不存在則建立新帳號
 * - 自動為所有匯入的學員授權指定課程
 * - 已擁有該課程的學員會跳過（不重複授權）
 */
export async function importStudents(
  data: ImportStudentsData
): Promise<ImportStudentsResult> {
  try {
    // 驗證資料
    const validatedData = importStudentsSchema.parse(data)
    const { students, courseIds, sendInvite } = validatedData
    const currentUser = await requireAdminAuth()

    // 檢查所有課程存在且皆可管理
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true },
    })
    if (courses.length !== courseIds.length) {
      return { success: false, error: '部分課程不存在' }
    }
    for (const course of courses) {
      if (!(await canManageCourse(currentUser, course.id))) {
        return { success: false, error: '沒有部分課程的管理權限' }
      }
    }
    const courseTitles = courses.map((c) => c.title)

    const summary = {
      totalRows: students.length,
      newUsers: 0,
      existingUsers: 0,
      newGrants: 0,
      alreadyGranted: 0,
      errors: [] as { row: number; email: string; error: string }[],
    }

    // 取得所有 email，批次查詢既有用戶
    const emails = students.map((s) => s.email.toLowerCase())
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    })
    const existingUserMap = new Map(
      existingUsers.map((u) => [u.email.toLowerCase(), u])
    )

    // 批次查詢這些課程的現有授權（以 userId::courseId 為 key）
    const existingPurchases = await prisma.purchase.findMany({
      where: {
        courseId: { in: courseIds },
        userId: { in: existingUsers.map((u) => u.id) },
      },
      select: { id: true, userId: true, courseId: true, revokedAt: true },
    })
    const purchaseKey = (userId: string, courseId: string) => `${userId}::${courseId}`
    const purchaseMap = new Map(
      existingPurchases.map((p) => [purchaseKey(p.userId, p.courseId), p])
    )

    // 本次新建的帳號（供邀請信使用）
    const newlyCreatedUserIds: string[] = []

    // 逐筆處理
    for (let i = 0; i < students.length; i++) {
      const student = students[i]
      const emailLower = student.email.toLowerCase()

      try {
        let userId: string

        const existingUser = existingUserMap.get(emailLower)
        if (existingUser) {
          userId = existingUser.id
          summary.existingUsers++

          // 更新姓名和電話（如果之前沒有）
          const updateData: { name?: string; phone?: string } = {}
          if (student.name) {
            // 只有在用戶沒有名字時才更新
            const userDetail = await prisma.user.findUnique({
              where: { id: userId },
              select: { name: true, phone: true },
            })
            if (!userDetail?.name) updateData.name = student.name
            if (!userDetail?.phone && student.phone) updateData.phone = student.phone
          }
          if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
              where: { id: userId },
              data: updateData,
            })
          }
        } else {
          // 建立新用戶（L61：標記為待啟用 guest，狀態一致，可走啟用 / 忘記密碼流程設定密碼；
          // 無密碼帳號在設定密碼前無法以密碼登入）
          const newUser = await prisma.user.create({
            data: {
              email: emailLower,
              name: student.name,
              phone: student.phone || null,
              isGuest: true,
              guestSource: 'admin_import',
            },
          })
          userId = newUser.id
          summary.newUsers++
          newlyCreatedUserIds.push(userId)
          existingUserMap.set(emailLower, { id: userId, email: emailLower })
        }

        // 為每門所選課程授權
        for (const courseId of courseIds) {
          const key = purchaseKey(userId, courseId)
          const existingPurchase = purchaseMap.get(key)

          if (existingPurchase && !existingPurchase.revokedAt) {
            summary.alreadyGranted++
            continue
          }

          if (existingPurchase && existingPurchase.revokedAt) {
            // 恢復已撤銷的授權
            await prisma.purchase.update({
              where: { id: existingPurchase.id },
              data: {
                revokedAt: null,
                grantedBy: currentUser.id as string,
                source: 'ADMIN_IMPORT',
              },
            })
            purchaseMap.set(key, { ...existingPurchase, revokedAt: null })
          } else {
            // 建立授權
            const created = await prisma.purchase.create({
              data: {
                userId,
                courseId,
                grantedBy: currentUser.id as string,
                source: 'ADMIN_IMPORT',
              },
            })
            purchaseMap.set(key, {
              id: created.id,
              userId,
              courseId,
              revokedAt: null,
            })
          }

          summary.newGrants++
        }
      } catch (error) {
        summary.errors.push({
          row: i + 1,
          email: student.email,
          error: error instanceof Error ? error.message : '處理失敗',
        })
      }
    }

    // 寄送邀請信：僅對「本次新建」的帳號（既有帳號已能登入、無需設定密碼）
    if (sendInvite && newlyCreatedUserIds.length > 0) {
      await Promise.allSettled(
        newlyCreatedUserIds.map((uid) =>
          sendAccountInviteEmail(uid, { courseTitles })
        )
      )
    }

    // 記錄操作日誌
    await logAdminAction(
      currentUser.id as string,
      'GRANT_ACCESS',
      courseIds[0],
      {
        action: 'BATCH_IMPORT',
        courseIds,
        courseTitles,
        totalRows: summary.totalRows,
        newUsers: summary.newUsers,
        newGrants: summary.newGrants,
        alreadyGranted: summary.alreadyGranted,
        errors: summary.errors.length,
        sendInvite: !!sendInvite,
      }
    )

    // 重新驗證快取
    revalidatePath('/admin/users')

    return { success: true, summary }
  } catch (error) {
    console.error('批次匯入學員失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '匯入時發生錯誤' }
  }
}
