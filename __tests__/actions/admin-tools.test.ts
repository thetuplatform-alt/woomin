jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/require-admin', () => ({ requireOnlyAdminAuth: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    series: { findUnique: jest.fn(), findMany: jest.fn() },
    entitlement: { findUnique: jest.fn(), findMany: jest.fn() },
    tool: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
    adminLog: { create: jest.fn() },
  },
}))

import { revalidatePath } from 'next/cache'
import { createTool, updateTool } from '@/lib/actions/admin-tools'
import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import type { ToolFormData } from '@/lib/validations/tool'

const mockedRequireAdmin = requireOnlyAdminAuth as jest.Mock
const db = prisma as unknown as {
  series: { findUnique: jest.Mock }
  entitlement: { findUnique: jest.Mock }
  tool: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock }
  adminLog: { create: jest.Mock }
}

function input(overrides: Partial<ToolFormData> = {}): ToolFormData {
  return {
    seriesId: 'series_lumi', name: 'Test Tool', slug: 'test-tool', category: 'life',
    subCategory: null, eyebrow: null, type: 'WEB_APP', shortDescription: 'Short',
    longDescription: 'Long', thumbnail: 'day-trip', heroImage: null,
    launchUrl: 'https://tool.example.com', detailUrl: '/lumi-series/test-tool',
    runtimeType: 'EXTERNAL_WEB_APP', lifecycle: 'DRAFT', isFeatured: false,
    featuredOrder: null, displayOrder: 10, requiresLogin: true,
    requiredEntitlementId: 'ent_lumi', pricingType: 'INCLUDED', price: null,
    ctaLabel: '開始使用', tags: [], audience: [], benefits: [], features: [], usageSteps: [],
    ...overrides,
  }
}

describe('admin Tool actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAdmin.mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
    db.series.findUnique.mockResolvedValue({ id: 'series_lumi', code: 'LUMI_SERIES', status: 'ACTIVE' })
    db.entitlement.findUnique.mockResolvedValue({ id: 'ent_lumi', isActive: true, seriesId: 'series_lumi' })
    db.adminLog.create.mockResolvedValue({ id: 'log_1' })
  })

  it('creates a Draft Tool and records the fixed CREATE_TOOL audit value', async () => {
    db.tool.findUnique.mockResolvedValue(null)
    db.tool.create.mockResolvedValue({ id: 'tool_1' })

    await expect(createTool(input())).resolves.toEqual({ success: true, id: 'tool_1' })
    expect(mockedRequireAdmin).toHaveBeenCalled()
    expect(db.tool.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DRAFT', isPublished: false, price: null }),
    }))
    expect(db.adminLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'UPDATE_SETTINGS',
        targetType: 'Tool',
        details: expect.objectContaining({ toolAction: 'CREATE_TOOL' }),
      }),
    }))
  })

  it('rejects publishing a Lumi Tool without entitlement', async () => {
    const result = await createTool(input({ lifecycle: 'PUBLISHED', requiredEntitlementId: null }))
    expect(result).toEqual({ success: false, error: '發布 Lumi Series 工具前必須指定 required entitlement' })
    expect(db.tool.create).not.toHaveBeenCalled()
  })

  it('records UPDATE, PUBLISH and FEATURE actions with fixed values', async () => {
    db.tool.findUnique
      .mockResolvedValueOnce({ id: 'tool_1', slug: 'test-tool', status: 'DRAFT', isPublished: false, isFeatured: false, featuredOrder: null })
      .mockResolvedValueOnce(null)
    db.tool.update.mockResolvedValue({ id: 'tool_1' })

    const result = await updateTool('tool_1', input({ lifecycle: 'PUBLISHED', isFeatured: true, featuredOrder: 1 }))
    expect(result).toEqual({ success: true })
    expect(db.tool.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ACTIVE', isPublished: true, isFeatured: true, featuredOrder: 1 }),
    }))
    const actions = db.adminLog.create.mock.calls.map((call) => call[0].data.details.toolAction)
    expect(actions).toEqual(['UPDATE_TOOL', 'PUBLISH_TOOL', 'FEATURE_TOOL'])
    expect(revalidatePath).toHaveBeenCalledWith('/lumi-series')
    expect(revalidatePath).toHaveBeenCalledWith('/lumi-series/test-tool')
  })

  it('rejects an entitlement owned by a different series', async () => {
    db.entitlement.findUnique.mockResolvedValue({ id: 'ent_other', isActive: true, seriesId: 'series_other' })
    const result = await createTool(input({ requiredEntitlementId: 'ent_other' }))
    expect(result).toEqual({ success: false, error: '所選 entitlement 不屬於此系列' })
  })
})
