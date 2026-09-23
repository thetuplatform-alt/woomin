import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { LumiProduct } from '@/app/lumi-series/data'

const publishedLumiWhere = {
  series: { code: 'LUMI_SERIES', status: 'ACTIVE' as const },
  status: 'ACTIVE' as const,
  isPublished: true,
}

const toolInclude = {
  requiredEntitlement: { select: { code: true } },
} satisfies Prisma.ToolInclude

type ToolWithEntitlement = Prisma.ToolGetPayload<{ include: typeof toolInclude }>

function stringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function featureArray(value: Prisma.JsonValue | null): Array<{ title: string; description: string }> {
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

function mapPricingType(value: ToolWithEntitlement['pricingType']): LumiProduct['pricingType'] {
  if (value === 'FREE') return 'free'
  if (value === 'PAID') return 'paid'
  if (value === 'COMING_SOON') return 'coming_soon'
  return 'included'
}

function mapToolType(value: ToolWithEntitlement['type']): LumiProduct['type'] {
  if (value === 'SKILL') return 'AI Skill'
  if (value === 'AI_TOOL') return 'AI Tool'
  if (value === 'SAAS') return 'SaaS'
  return 'Web App'
}

export function toLumiProduct(tool: ToolWithEntitlement): LumiProduct {
  return {
    id: tool.id,
    slug: tool.slug,
    name: tool.name,
    eyebrow: tool.eyebrow ?? undefined,
    type: mapToolType(tool.type),
    category: tool.category as LumiProduct['category'],
    subCategory: tool.subCategory ?? undefined,
    shortDescription: tool.shortDescription ?? '',
    longDescription: tool.longDescription ?? tool.shortDescription ?? '',
    tags: stringArray(tool.tags),
    thumbnail: tool.thumbnail ?? '',
    heroImage: tool.heroImage ?? undefined,
    pricingType: mapPricingType(tool.pricingType),
    price: tool.price === null ? null : Number(tool.price),
    currency: null,
    trialDays: null,
    status: 'available',
    ctaLabel: tool.ctaLabel ?? '開始使用',
    ctaUrl: `/lumi-series/launch/${tool.slug}`,
    featured: tool.isFeatured,
    featuredOrder: tool.featuredOrder,
    sortOrder: tool.displayOrder,
    audience: stringArray(tool.audience),
    benefits: stringArray(tool.benefits),
    features: featureArray(tool.features),
    usageSteps: stringArray(tool.usageSteps),
    runtimeType: tool.runtimeType,
    requiredEntitlementCode: tool.requiredEntitlement?.code ?? null,
  }
}

export async function listPublishedLumiTools(): Promise<LumiProduct[]> {
  const tools = await prisma.tool.findMany({
    where: publishedLumiWhere,
    include: toolInclude,
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
  return tools.map(toLumiProduct)
}

export async function getPublishedLumiProduct(slug: string): Promise<LumiProduct | null> {
  const tool = await prisma.tool.findFirst({
    where: { ...publishedLumiWhere, slug },
    include: toolInclude,
  })
  return tool ? toLumiProduct(tool) : null
}

export async function getPublishedLumiToolBySlug(slug: string) {
  return prisma.tool.findFirst({
    where: { ...publishedLumiWhere, slug },
    select: {
      slug: true,
      runtimeType: true,
      status: true,
      isPublished: true,
      requiresLogin: true,
      launchUrl: true,
      detailUrl: true,
      requiredEntitlement: { select: { code: true } },
    },
  }).then((tool) =>
    tool
      ? {
          ...tool,
          requiredEntitlementCode: tool.requiredEntitlement?.code ?? null,
        }
      : null
  )
}
