import { toolSchema, type ToolFormData } from '@/lib/validations/tool'

function validTool(overrides: Partial<ToolFormData> = {}): ToolFormData {
  return {
    seriesId: 'series_lumi',
    name: 'Local Test Tool',
    slug: 'local-test-tool',
    category: 'life',
    subCategory: null,
    eyebrow: null,
    type: 'WEB_APP',
    shortDescription: 'Short description',
    longDescription: 'Long description',
    thumbnail: 'day-trip',
    heroImage: '/uploads/tool-hero.webp',
    launchUrl: 'https://tool.example.com/start',
    detailUrl: '/lumi-series/local-test-tool',
    runtimeType: 'EXTERNAL_WEB_APP',
    lifecycle: 'DRAFT',
    isFeatured: false,
    featuredOrder: null,
    displayOrder: 10,
    requiresLogin: true,
    requiredEntitlementId: 'ent_lumi',
    pricingType: 'INCLUDED',
    price: null,
    ctaLabel: '開始使用',
    tags: ['Web App'],
    audience: ['會員'],
    benefits: ['快速完成'],
    features: [{ title: '功能', description: '說明' }],
    usageSteps: ['登入後開始'],
    ...overrides,
  }
}

describe('Tool Management validation', () => {
  it('accepts the approved external web app contract', () => {
    expect(toolSchema.safeParse(validTool()).success).toBe(true)
  })

  it.each([
    'http://tool.example.com',
    '//tool.example.com',
    'https://user:password@tool.example.com',
    '/internal-tool',
  ])('rejects unsafe external launch URL %s', (launchUrl) => {
    expect(toolSchema.safeParse(validTool({ launchUrl })).success).toBe(false)
  })

  it('requires native tools to use a safe internal detail URL', () => {
    expect(toolSchema.safeParse(validTool({ runtimeType: 'BESTAPPSTORE_NATIVE', launchUrl: null, detailUrl: '/tools/native' })).success).toBe(true)
    expect(toolSchema.safeParse(validTool({ runtimeType: 'BESTAPPSTORE_NATIVE', launchUrl: null, detailUrl: 'https://evil.example' })).success).toBe(false)
    expect(toolSchema.safeParse(validTool({ runtimeType: 'BESTAPPSTORE_NATIVE', launchUrl: null, detailUrl: '/../admin' })).success).toBe(false)
  })

  it('allows Skill Runtime data without creating or requiring a runtime URL', () => {
    expect(toolSchema.safeParse(validTool({ type: 'SKILL', runtimeType: 'SKILL_RUNTIME', launchUrl: null })).success).toBe(true)
  })

  it('requires login whenever an entitlement is selected', () => {
    expect(toolSchema.safeParse(validTool({ requiresLogin: false })).success).toBe(false)
  })

  it('requires a positive price only for PAID tools', () => {
    expect(toolSchema.safeParse(validTool({ pricingType: 'PAID', price: 199 })).success).toBe(true)
    expect(toolSchema.safeParse(validTool({ pricingType: 'PAID', price: 0 })).success).toBe(false)
    expect(toolSchema.safeParse(validTool({ pricingType: 'FREE', price: 199 })).success).toBe(false)
  })

  it('requires featuredOrder for featured tools', () => {
    expect(toolSchema.safeParse(validTool({ isFeatured: true, featuredOrder: null })).success).toBe(false)
    expect(toolSchema.safeParse(validTool({ isFeatured: true, featuredOrder: 5 })).success).toBe(true)
  })

  it('accepts artwork tokens and HTTPS images but rejects protocol-relative images', () => {
    expect(toolSchema.safeParse(validTool({ thumbnail: 'day-trip' })).success).toBe(true)
    expect(toolSchema.safeParse(validTool({ thumbnail: 'https://cdn.example.com/tool.webp' })).success).toBe(true)
    expect(toolSchema.safeParse(validTool({ thumbnail: '//cdn.example.com/tool.webp' })).success).toBe(false)
  })
})
