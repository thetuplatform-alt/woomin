'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma, ToolPricingType, ToolRuntimeType, ToolStatus, ToolType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import {
  lumiToolCategoryOptions,
  toolSchema,
  type ToolFormData,
  type ToolLifecycle,
} from '@/lib/validations/tool'

export type ToolAction =
  | 'CREATE_TOOL'
  | 'UPDATE_TOOL'
  | 'PUBLISH_TOOL'
  | 'DISABLE_TOOL'
  | 'ARCHIVE_TOOL'
  | 'FEATURE_TOOL'

export interface AdminToolListItem {
  id: string
  name: string
  slug: string
  category: string
  type: ToolType
  runtimeType: ToolRuntimeType
  status: ToolStatus
  isPublished: boolean
  lifecycle: ToolLifecycle
  thumbnail: string | null
  isFeatured: boolean
  featuredOrder: number | null
  displayOrder: number
  pricingType: ToolPricingType
  price: number | null
  updatedAt: Date
  series: { id: string; code: string; name: string }
  requiredEntitlement: { id: string; code: string; name: string } | null
}

export interface AdminToolDetail extends Omit<AdminToolListItem, 'updatedAt'> {
  subCategory: string | null
  eyebrow: string | null
  shortDescription: string | null
  longDescription: string | null
  heroImage: string | null
  launchUrl: string | null
  detailUrl: string | null
  requiresLogin: boolean
  requiredEntitlementId: string | null
  ctaLabel: string | null
  tags: string[]
  audience: string[]
  benefits: string[]
  features: Array<{ title: string; description: string }>
  usageSteps: string[]
}

export interface ToolFormOptions {
  series: Array<{ id: string; code: string; name: string; slug: string }>
  entitlements: Array<{
    id: string
    code: string
    name: string
    kind: 'SERIES' | 'TOOL'
    seriesId: string | null
  }>
  nextDisplayOrderBySeries: Record<string, number>
}

export interface AdminToolFilters {
  search?: string
  seriesId?: string
  type?: ToolType
  lifecycle?: ToolLifecycle
}

const toolListSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  type: true,
  runtimeType: true,
  status: true,
  isPublished: true,
  thumbnail: true,
  isFeatured: true,
  featuredOrder: true,
  displayOrder: true,
  pricingType: true,
  price: true,
  updatedAt: true,
  series: { select: { id: true, code: true, name: true } },
  requiredEntitlement: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ToolSelect

type ToolListRecord = Prisma.ToolGetPayload<{ select: typeof toolListSelect }>

function lifecycleFromRecord(status: ToolStatus, isPublished: boolean): ToolLifecycle {
  if (status === 'ACTIVE' && isPublished) return 'PUBLISHED'
  if (status === 'DISABLED') return 'DISABLED'
  if (status === 'ARCHIVED') return 'ARCHIVED'
  return 'DRAFT'
}

function lifecycleFields(lifecycle: ToolLifecycle): { status: ToolStatus; isPublished: boolean } {
  if (lifecycle === 'PUBLISHED') return { status: 'ACTIVE', isPublished: true }
  if (lifecycle === 'DISABLED') return { status: 'DISABLED', isPublished: false }
  if (lifecycle === 'ARCHIVED') return { status: 'ARCHIVED', isPublished: false }
  return { status: 'DRAFT', isPublished: false }
}

function jsonStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function jsonFeatures(value: Prisma.JsonValue | null): Array<{ title: string; description: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const title = 'title' in item ? item.title : null
    const description = 'description' in item ? item.description : null
    return typeof title === 'string' && typeof description === 'string'
      ? [{ title, description }]
      : []
  })
}

function mapListRecord(tool: ToolListRecord): AdminToolListItem {
  return {
    ...tool,
    price: tool.price === null ? null : Number(tool.price),
    lifecycle: lifecycleFromRecord(tool.status, tool.isPublished),
  }
}

function trimOptional(value: string | null | undefined) {
  return value?.trim() || null
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeToolInput(input: ToolFormData) {
  const data = toolSchema.parse(input)
  return {
    ...data,
    name: data.name.trim(),
    slug: data.slug.trim(),
    category: data.category.trim(),
    subCategory: trimOptional(data.subCategory),
    eyebrow: trimOptional(data.eyebrow),
    shortDescription: trimOptional(data.shortDescription),
    longDescription: trimOptional(data.longDescription),
    thumbnail: trimOptional(data.thumbnail),
    heroImage: trimOptional(data.heroImage),
    launchUrl: data.runtimeType === 'EXTERNAL_WEB_APP' ? trimOptional(data.launchUrl) : null,
    detailUrl: trimOptional(data.detailUrl),
    requiredEntitlementId: trimOptional(data.requiredEntitlementId),
    price: data.pricingType === 'PAID' ? data.price ?? null : null,
    ctaLabel: trimOptional(data.ctaLabel),
    featuredOrder: data.isFeatured ? data.featuredOrder ?? 0 : null,
    tags: uniqueStrings(data.tags),
    audience: uniqueStrings(data.audience),
    benefits: uniqueStrings(data.benefits),
    features: data.features.map((feature) => ({
      title: feature.title.trim(),
      description: feature.description.trim(),
    })),
    usageSteps: uniqueStrings(data.usageSteps),
    ...lifecycleFields(data.lifecycle),
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues
    if (issues?.[0]?.message) return issues[0].message
  }
  return error instanceof Error ? error.message : fallback
}

async function validateRelations(data: ReturnType<typeof normalizeToolInput>) {
  const series = await prisma.series.findUnique({
    where: { id: data.seriesId },
    select: { id: true, code: true, status: true },
  })
  if (!series || series.status !== 'ACTIVE') {
    throw new Error('所選系列不存在或已停用')
  }

  if (
    series.code === 'LUMI_SERIES' &&
    !lumiToolCategoryOptions.some((option) => option.value === data.category)
  ) {
    throw new Error('Lumi Series 工具必須使用既有 Lumi 分類')
  }

  if (data.requiredEntitlementId) {
    const entitlement = await prisma.entitlement.findUnique({
      where: { id: data.requiredEntitlementId },
      select: { id: true, isActive: true, seriesId: true },
    })
    if (!entitlement?.isActive) throw new Error('所選 entitlement 不存在或已停用')
    if (entitlement.seriesId && entitlement.seriesId !== series.id) {
      throw new Error('所選 entitlement 不屬於此系列')
    }
  }

  if (series.code === 'LUMI_SERIES' && data.lifecycle === 'PUBLISHED' && !data.requiredEntitlementId) {
    throw new Error('發布 Lumi Series 工具前必須指定 required entitlement')
  }

  return series
}

async function logToolAction(
  adminId: string,
  toolId: string,
  toolAction: ToolAction,
  details: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'UPDATE_SETTINGS',
        targetType: 'Tool',
        targetId: toolId,
        details: { toolAction, ...details } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    console.error('記錄 Tool 管理操作失敗:', error)
  }
}

function revalidateToolPaths(id: string, slug: string, previousSlug?: string) {
  revalidatePath('/admin/tools')
  revalidatePath(`/admin/tools/${id}`)
  revalidatePath('/lumi-series')
  revalidatePath(`/lumi-series/${slug}`)
  revalidatePath(`/lumi-series/launch/${slug}`)
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/lumi-series/${previousSlug}`)
    revalidatePath(`/lumi-series/launch/${previousSlug}`)
  }
}

export async function getAdminTools(filters: AdminToolFilters = {}): Promise<AdminToolListItem[]> {
  await requireOnlyAdminAuth()

  const where: Prisma.ToolWhereInput = {}
  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (filters.seriesId) where.seriesId = filters.seriesId
  if (filters.type) where.type = filters.type
  if (filters.lifecycle) Object.assign(where, lifecycleFields(filters.lifecycle))

  const tools = await prisma.tool.findMany({
    where,
    select: toolListSelect,
    orderBy: [{ series: { displayOrder: 'asc' } }, { displayOrder: 'asc' }, { name: 'asc' }],
  })
  return tools.map(mapListRecord)
}

export async function getToolFormOptions(): Promise<ToolFormOptions> {
  await requireOnlyAdminAuth()
  const [series, entitlements, orderGroups] = await Promise.all([
    prisma.series.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true, slug: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.entitlement.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, kind: true, seriesId: true },
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    }),
    prisma.tool.groupBy({ by: ['seriesId'], _max: { displayOrder: true } }),
  ])

  return {
    series,
    entitlements,
    nextDisplayOrderBySeries: Object.fromEntries(
      orderGroups.map((group) => [group.seriesId, (group._max.displayOrder ?? 0) + 10])
    ),
  }
}

export async function getAdminToolById(id: string): Promise<AdminToolDetail | null> {
  await requireOnlyAdminAuth()
  const tool = await prisma.tool.findUnique({
    where: { id },
    include: {
      series: { select: { id: true, code: true, name: true } },
      requiredEntitlement: { select: { id: true, code: true, name: true } },
    },
  })
  if (!tool) return null

  return {
    ...tool,
    price: tool.price === null ? null : Number(tool.price),
    lifecycle: lifecycleFromRecord(tool.status, tool.isPublished),
    tags: jsonStringArray(tool.tags),
    audience: jsonStringArray(tool.audience),
    benefits: jsonStringArray(tool.benefits),
    features: jsonFeatures(tool.features),
    usageSteps: jsonStringArray(tool.usageSteps),
  }
}

export async function createTool(
  input: ToolFormData
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const admin = await requireOnlyAdminAuth()
    const data = normalizeToolInput(input)
    const series = await validateRelations(data)

    const duplicate = await prisma.tool.findUnique({ where: { slug: data.slug }, select: { id: true } })
    if (duplicate) return { success: false, error: '此 Slug 已被其他工具使用' }

    const tool = await prisma.tool.create({
      data: {
        seriesId: data.seriesId,
        name: data.name,
        slug: data.slug,
        category: data.category,
        subCategory: data.subCategory,
        eyebrow: data.eyebrow,
        type: data.type,
        shortDescription: data.shortDescription,
        longDescription: data.longDescription,
        thumbnail: data.thumbnail,
        heroImage: data.heroImage,
        launchUrl: data.launchUrl,
        detailUrl: data.detailUrl,
        runtimeType: data.runtimeType,
        status: data.status,
        isPublished: data.isPublished,
        isFeatured: data.isFeatured,
        featuredOrder: data.featuredOrder,
        displayOrder: data.displayOrder,
        requiresLogin: data.requiresLogin,
        requiredEntitlementId: data.requiredEntitlementId,
        pricingType: data.pricingType,
        price: data.price,
        ctaLabel: data.ctaLabel,
        tags: data.tags,
        audience: data.audience,
        benefits: data.benefits,
        features: data.features,
        usageSteps: data.usageSteps,
      },
      select: { id: true },
    })

    await logToolAction(admin.id, tool.id, 'CREATE_TOOL', {
      slug: data.slug,
      seriesCode: series.code,
      lifecycle: data.lifecycle,
    })
    if (data.lifecycle === 'PUBLISHED') {
      await logToolAction(admin.id, tool.id, 'PUBLISH_TOOL', {
        slug: data.slug,
        previousLifecycle: null,
        lifecycle: data.lifecycle,
      })
    }
    if (data.isFeatured) {
      await logToolAction(admin.id, tool.id, 'FEATURE_TOOL', {
        slug: data.slug,
        isFeatured: true,
        featuredOrder: data.featuredOrder,
      })
    }
    revalidateToolPaths(tool.id, data.slug)
    return { success: true, id: tool.id }
  } catch (error) {
    console.error('建立 Tool 失敗:', error)
    return { success: false, error: errorMessage(error, '建立 Tool 時發生錯誤') }
  }
}

export async function updateTool(
  id: string,
  input: ToolFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireOnlyAdminAuth()
    const data = normalizeToolInput(input)
    const series = await validateRelations(data)
    const existing = await prisma.tool.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        status: true,
        isPublished: true,
        isFeatured: true,
        featuredOrder: true,
      },
    })
    if (!existing) return { success: false, error: '工具不存在' }

    const slugOwner = await prisma.tool.findUnique({ where: { slug: data.slug }, select: { id: true } })
    if (slugOwner && slugOwner.id !== id) return { success: false, error: '此 Slug 已被其他工具使用' }

    await prisma.tool.update({
      where: { id },
      data: {
        seriesId: data.seriesId,
        name: data.name,
        slug: data.slug,
        category: data.category,
        subCategory: data.subCategory,
        eyebrow: data.eyebrow,
        type: data.type,
        shortDescription: data.shortDescription,
        longDescription: data.longDescription,
        thumbnail: data.thumbnail,
        heroImage: data.heroImage,
        launchUrl: data.launchUrl,
        detailUrl: data.detailUrl,
        runtimeType: data.runtimeType,
        status: data.status,
        isPublished: data.isPublished,
        isFeatured: data.isFeatured,
        featuredOrder: data.featuredOrder,
        displayOrder: data.displayOrder,
        requiresLogin: data.requiresLogin,
        requiredEntitlementId: data.requiredEntitlementId,
        pricingType: data.pricingType,
        price: data.price,
        ctaLabel: data.ctaLabel,
        tags: data.tags,
        audience: data.audience,
        benefits: data.benefits,
        features: data.features,
        usageSteps: data.usageSteps,
      },
    })

    const previousLifecycle = lifecycleFromRecord(existing.status, existing.isPublished)
    const commonDetails = {
      slug: data.slug,
      previousSlug: existing.slug,
      seriesCode: series.code,
      previousLifecycle,
      lifecycle: data.lifecycle,
    }
    await logToolAction(admin.id, id, 'UPDATE_TOOL', commonDetails)
    if (previousLifecycle !== data.lifecycle) {
      const transitionAction: ToolAction | null =
        data.lifecycle === 'PUBLISHED'
          ? 'PUBLISH_TOOL'
          : data.lifecycle === 'DISABLED'
            ? 'DISABLE_TOOL'
            : data.lifecycle === 'ARCHIVED'
              ? 'ARCHIVE_TOOL'
              : null
      if (transitionAction) await logToolAction(admin.id, id, transitionAction, commonDetails)
    }
    if (existing.isFeatured !== data.isFeatured || existing.featuredOrder !== data.featuredOrder) {
      await logToolAction(admin.id, id, 'FEATURE_TOOL', {
        slug: data.slug,
        isFeatured: data.isFeatured,
        featuredOrder: data.featuredOrder,
      })
    }

    revalidateToolPaths(id, data.slug, existing.slug)
    return { success: true }
  } catch (error) {
    console.error('更新 Tool 失敗:', error)
    return { success: false, error: errorMessage(error, '更新 Tool 時發生錯誤') }
  }
}
