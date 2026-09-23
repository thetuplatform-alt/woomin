import { prisma } from '../lib/prisma'
import { LUMI_SERIES_SEED, LUMI_TOOL_SEEDS } from '../lib/lumi-seed-data'

async function seedBestAppStore() {
  if (process.argv.includes('--dry-run')) {
    const webApps = LUMI_TOOL_SEEDS.filter((tool) => tool.type === 'WEB_APP').length
    const skills = LUMI_TOOL_SEEDS.filter((tool) => tool.type === 'SKILL').length
    console.log(`BestAppStore seed dry run: 1 series, 1 entitlement, ${webApps} Web Apps, ${skills} Skills`)
    return
  }

  await prisma.$transaction(async (tx) => {
    const series = await tx.series.upsert({
      where: { code: LUMI_SERIES_SEED.code },
      update: {
        slug: LUMI_SERIES_SEED.slug,
        name: LUMI_SERIES_SEED.name,
        description: LUMI_SERIES_SEED.description,
        status: 'ACTIVE',
      },
      create: {
        code: LUMI_SERIES_SEED.code,
        slug: LUMI_SERIES_SEED.slug,
        name: LUMI_SERIES_SEED.name,
        description: LUMI_SERIES_SEED.description,
        status: 'ACTIVE',
      },
    })

    const entitlement = await tx.entitlement.upsert({
      where: { code: LUMI_SERIES_SEED.requiredEntitlementCode },
      update: {
        name: 'Lumi Series 使用權',
        kind: 'SERIES',
        seriesId: series.id,
        isActive: true,
      },
      create: {
        code: LUMI_SERIES_SEED.requiredEntitlementCode,
        name: 'Lumi Series 使用權',
        kind: 'SERIES',
        seriesId: series.id,
        isActive: true,
      },
    })

    for (const tool of LUMI_TOOL_SEEDS) {
      const data = {
        seriesId: series.id,
        name: tool.name,
        category: tool.category,
        subCategory: tool.subCategory,
        eyebrow: tool.eyebrow,
        type: tool.type,
        shortDescription: tool.shortDescription,
        longDescription: tool.longDescription,
        thumbnail: tool.thumbnail,
        heroImage: null,
        launchUrl: tool.launchUrl,
        detailUrl: `/lumi-series/${tool.slug}`,
        runtimeType: tool.runtimeType,
        status: tool.status,
        isFeatured: tool.isFeatured,
        featuredOrder: tool.featuredOrder,
        displayOrder: tool.displayOrder,
        requiresLogin: tool.requiresLogin,
        requiredEntitlementId: entitlement.id,
        pricingType: tool.pricingType,
        price: null,
        ctaLabel: tool.ctaLabel,
        isPublished: tool.isPublished,
        tags: tool.tags,
        audience: tool.audience,
        benefits: tool.benefits,
        features: tool.features,
        usageSteps: tool.usageSteps,
      } as const

      await tx.tool.upsert({
        where: { slug: tool.slug },
        update: data,
        create: { slug: tool.slug, ...data },
      })
    }
  })

  console.log('BestAppStore seed complete: 1 series, 1 entitlement, 7 Web Apps, 3 Skills')
}

seedBestAppStore()
  .catch((error) => {
    console.error('BestAppStore seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
