import { groupLumiCatalogProducts, lumiKidsGroup } from '@/app/lumi-series/catalog-grouping'
import type { LumiProduct, LumiProductCategory } from '@/app/lumi-series/data'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function product(slug: string, category: LumiProductCategory): LumiProduct {
  return {
    id: slug,
    slug,
    name: slug,
    type: category === 'creator' || category === 'business' ? 'AI Skill' : 'Web App',
    category,
    shortDescription: '',
    longDescription: '',
    tags: [],
    thumbnail: '',
    pricingType: 'included',
    price: null,
    currency: null,
    trialDays: null,
    status: 'available',
    ctaLabel: '查看工具',
    ctaUrl: `/lumi-series/launch/${slug}`,
    featured: false,
    sortOrder: 0,
    audience: [],
    benefits: [],
    features: [],
    usageSteps: [],
  }
}

describe('Lumi catalog grouping', () => {
  const visibleProducts = [
    product('today-where-to-go', 'life'),
    product('what-to-cook', 'life'),
    product('where-to-eat', 'life'),
    product('rourou-fit-meal', 'life'),
    product('kindergarten-contact-book', 'kids'),
    product('kindergarten-term-comments', 'kids'),
    product('line-sticker-planner', 'creator'),
    product('ai-product-social-sales-studio', 'business'),
    product('ai-business-message-assistant', 'business'),
  ]

  it('places both education tools exactly once under Lumi Kids', () => {
    const grouped = groupLumiCatalogProducts(visibleProducts)

    expect(grouped.kidsProducts.map(({ slug }) => slug)).toEqual([
      'kindergarten-contact-book',
      'kindergarten-term-comments',
    ])
    expect(grouped.otherProducts).toHaveLength(7)
    expect([...grouped.kidsProducts, ...grouped.otherProducts]).toHaveLength(9)
    expect(new Set([...grouped.kidsProducts, ...grouped.otherProducts].map(({ slug }) => slug)).size).toBe(9)
  })

  it('preserves the existing order within each group', () => {
    const grouped = groupLumiCatalogProducts(visibleProducts)

    expect(grouped.otherProducts.map(({ slug }) => slug)).toEqual([
      'today-where-to-go',
      'what-to-cook',
      'where-to-eat',
      'rourou-fit-meal',
      'line-sticker-planner',
      'ai-product-social-sales-studio',
      'ai-business-message-assistant',
    ])
  })

  it('does not introduce unpublished tools such as qmeng-avatar', () => {
    const grouped = groupLumiCatalogProducts(visibleProducts)
    const slugs = [...grouped.kidsProducts, ...grouped.otherProducts].map(({ slug }) => slug)

    expect(slugs).not.toContain('qmeng-avatar')
  })

  it('exposes reusable Lumi Kids category copy', () => {
    expect(lumiKidsGroup).toEqual({
      category: 'kids',
      name: 'Lumi Kids',
      label: '幼教工具',
      description: '給幼教老師與家長的日常實用工具',
    })
  })

  it('keeps the Explore anchor and responsive single-column card layout', () => {
    const root = process.cwd()
    const catalogSource = readFileSync(join(root, 'app/lumi-series/catalog.tsx'), 'utf8')
    const styles = readFileSync(join(root, 'app/lumi-series/lumi-series.module.css'), 'utf8')

    expect(catalogSource).toContain('id="explore"')
    expect(styles).toContain('@media (max-width: 760px)')
    expect(styles).toContain('.featuredGrid, .productGrid { grid-template-columns: 1fr; }')
    expect(styles).toContain('.kidsGroupHeading { align-items: start; flex-direction: column;')
  })
})
