// lib/actions/bundles.ts
// 組合包管理 Server Actions

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
// M17：組合包跨多門課程、屬全站營運層級（定價 / 上架 / 封存），全部僅限 ADMIN
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { bundleSchema, type BundleFormData } from '@/lib/validations/bundle'
import type { BundleStatus, CourseVisibility } from '@prisma/client'

export interface BundleListItem {
  id: string
  title: string
  slug: string
  description: string | null
  coverImage: string | null
  price: number
  salePrice: number | null
  status: BundleStatus
  visibility: CourseVisibility
  createdAt: Date
  updatedAt: Date
  _count: { courses: number; orders: number; purchases: number }
}

export interface BundleDetail extends Omit<BundleListItem, '_count'> {
  courses: {
    id: string
    order: number
    course: {
      id: string
      title: string
      slug: string
      coverImage: string | null
      status: string
    }
  }[]
  _count: { orders: number; purchases: number }
}

export interface BundleCourseOption {
  id: string
  title: string
  slug: string
  status: string
}

async function logBundleAction(
  adminId: string,
  bundleId: string,
  bundleAction: 'CREATE_BUNDLE' | 'UPDATE_BUNDLE' | 'ARCHIVE_BUNDLE',
  details?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'UPDATE_SETTINGS',
        targetType: 'Bundle',
        targetId: bundleId,
        details: {
          bundleAction,
          ...(details || {}),
        },
      },
    })
  } catch (error) {
    console.error('記錄組合包操作日誌失敗:', error)
  }
}

function normalizeBundleInput(data: BundleFormData) {
  const validated = bundleSchema.parse(data)
  const uniqueCourseIds = Array.from(new Set(validated.courseIds))

  return {
    ...validated,
    description: validated.description?.trim() || null,
    coverImage: validated.coverImage?.trim() || null,
    salePrice: validated.salePrice ?? null,
    courseIds: uniqueCourseIds,
  }
}

export async function getBundles(): Promise<BundleListItem[]> {
  await requireOnlyAdminAuth()

  return prisma.bundle.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { courses: true, orders: true, purchases: true },
      },
    },
  })
}

export async function getBundleById(id: string): Promise<BundleDetail | null> {
  await requireOnlyAdminAuth()

  return prisma.bundle.findUnique({
    where: { id },
    include: {
      courses: {
        orderBy: { order: 'asc' },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
              status: true,
            },
          },
        },
      },
      _count: {
        select: { orders: true, purchases: true },
      },
    },
  })
}

export async function getCoursesForBundle(): Promise<BundleCourseOption[]> {
  await requireOnlyAdminAuth()

  return prisma.course.findMany({
    where: {
      status: { in: ['PUBLISHED', 'UNLISTED'] },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
    orderBy: { title: 'asc' },
  })
}

export async function createBundle(
  data: BundleFormData
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const admin = await requireOnlyAdminAuth()
    const validated = normalizeBundleInput(data)

    const existing = await prisma.bundle.findUnique({
      where: { slug: validated.slug },
      select: { id: true },
    })

    if (existing) {
      return { success: false, error: '此 Slug 已被其他組合包使用' }
    }

    const existingCourses = await prisma.course.count({
      where: { id: { in: validated.courseIds } },
    })

    if (existingCourses !== validated.courseIds.length) {
      return { success: false, error: '部分課程不存在，請重新選擇' }
    }

    // L49：發布中的組合包不得包含未發布（草稿）課程，避免販售草稿內容
    if (validated.status === 'PUBLISHED') {
      const sellableCount = await prisma.course.count({
        where: { id: { in: validated.courseIds }, status: { in: ['PUBLISHED', 'UNLISTED'] } },
      })
      if (sellableCount !== validated.courseIds.length) {
        return { success: false, error: '組合包包含未發布的課程，請先發布或移除這些課程後再上架組合包' }
      }
    }

    const bundle = await prisma.bundle.create({
      data: {
        title: validated.title,
        slug: validated.slug,
        description: validated.description,
        coverImage: validated.coverImage,
        price: validated.price,
        salePrice: validated.salePrice,
        status: validated.status,
        visibility: validated.visibility,
        createdBy: admin.id,
        courses: {
          create: validated.courseIds.map((courseId, index) => ({
            courseId,
            order: index,
          })),
        },
      },
      select: { id: true },
    })

    await logBundleAction(admin.id, bundle.id, 'CREATE_BUNDLE', {
      title: validated.title,
      slug: validated.slug,
      status: validated.status,
      courseCount: validated.courseIds.length,
    })

    revalidatePath('/admin/bundles')
    revalidatePath(`/bundles/${validated.slug}`)

    return { success: true, id: bundle.id }
  } catch (error) {
    console.error('建立組合包失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '建立組合包時發生錯誤',
    }
  }
}

export async function updateBundle(
  id: string,
  data: BundleFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireOnlyAdminAuth()
    const validated = normalizeBundleInput(data)

    const existing = await prisma.bundle.findUnique({
      where: { id },
      select: { id: true, slug: true },
    })

    if (!existing) {
      return { success: false, error: '組合包不存在' }
    }

    const slugOwner = await prisma.bundle.findUnique({
      where: { slug: validated.slug },
      select: { id: true },
    })

    if (slugOwner && slugOwner.id !== id) {
      return { success: false, error: '此 Slug 已被其他組合包使用' }
    }

    const existingCourses = await prisma.course.count({
      where: { id: { in: validated.courseIds } },
    })

    if (existingCourses !== validated.courseIds.length) {
      return { success: false, error: '部分課程不存在，請重新選擇' }
    }

    // L49：發布中的組合包不得包含未發布（草稿）課程
    if (validated.status === 'PUBLISHED') {
      const sellableCount = await prisma.course.count({
        where: { id: { in: validated.courseIds }, status: { in: ['PUBLISHED', 'UNLISTED'] } },
      })
      if (sellableCount !== validated.courseIds.length) {
        return { success: false, error: '組合包包含未發布的課程，請先發布或移除這些課程後再上架組合包' }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.bundleCourse.deleteMany({ where: { bundleId: id } })
      await tx.bundle.update({
        where: { id },
        data: {
          title: validated.title,
          slug: validated.slug,
          description: validated.description,
          coverImage: validated.coverImage,
          price: validated.price,
          salePrice: validated.salePrice,
          status: validated.status,
          visibility: validated.visibility,
          courses: {
            create: validated.courseIds.map((courseId, index) => ({
              courseId,
              order: index,
            })),
          },
        },
      })
    })

    await logBundleAction(admin.id, id, 'UPDATE_BUNDLE', {
      title: validated.title,
      slug: validated.slug,
      previousSlug: existing.slug,
      status: validated.status,
      courseCount: validated.courseIds.length,
    })

    revalidatePath('/admin/bundles')
    revalidatePath(`/admin/bundles/${id}`)
    revalidatePath(`/bundles/${existing.slug}`)
    revalidatePath(`/bundles/${validated.slug}`)

    return { success: true }
  } catch (error) {
    console.error('更新組合包失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新組合包時發生錯誤',
    }
  }
}

export async function archiveBundle(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireOnlyAdminAuth()

    const bundle = await prisma.bundle.findUnique({
      where: { id },
      select: { id: true, title: true, slug: true, status: true },
    })

    if (!bundle) {
      return { success: false, error: '組合包不存在' }
    }

    await prisma.bundle.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    })

    await logBundleAction(admin.id, id, 'ARCHIVE_BUNDLE', {
      title: bundle.title,
      slug: bundle.slug,
      previousStatus: bundle.status,
    })

    revalidatePath('/admin/bundles')
    revalidatePath(`/admin/bundles/${id}`)
    revalidatePath(`/bundles/${bundle.slug}`)

    return { success: true }
  } catch (error) {
    console.error('停用組合包失敗:', error)
    return { success: false, error: '停用組合包時發生錯誤' }
  }
}
