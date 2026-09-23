jest.mock('@/lib/prisma', () => ({
  prisma: {
    userEntitlement: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getDefaultPostLoginPath,
  getActiveSeriesEntitlements,
  hasActiveEntitlement,
} from '@/lib/entitlements'

const mockedFindFirst = prisma.userEntitlement.findFirst as jest.Mock
const mockedFindMany = prisma.userEntitlement.findMany as jest.Mock

describe('BestAppStore entitlement checks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('accepts an active, non-expired entitlement grant', async () => {
    mockedFindFirst.mockResolvedValue({ id: 'grant_1' })

    await expect(
      hasActiveEntitlement('user_1', 'LUMI_SERIES', new Date('2026-09-18T00:00:00Z'))
    ).resolves.toBe(true)

    expect(mockedFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        status: 'ACTIVE',
        entitlement: { code: 'LUMI_SERIES', isActive: true },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date('2026-09-18T00:00:00Z') } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date('2026-09-18T00:00:00Z') } }] },
        ],
      },
      select: { id: true },
    })
  })

  it('denies access when no active grant exists', async () => {
    mockedFindFirst.mockResolvedValue(null)
    await expect(hasActiveEntitlement('user_1', 'LUMI_SERIES')).resolves.toBe(false)
  })

  it('returns only active series grants for My Services', async () => {
    mockedFindMany.mockResolvedValue([
      {
        entitlement: {
          code: 'LUMI_SERIES',
          series: { code: 'LUMI_SERIES', slug: 'lumi-series', name: 'Lumi Series' },
        },
      },
    ])

    await expect(getActiveSeriesEntitlements('user_1')).resolves.toEqual([
      { code: 'LUMI_SERIES', slug: 'lumi-series', name: 'Lumi Series' },
    ])
  })

  it('opens the only available series after login', async () => {
    mockedFindMany.mockResolvedValue([
      {
        entitlement: {
          code: 'LUMI_SERIES',
          series: { code: 'LUMI_SERIES', slug: 'lumi-series', name: 'Lumi Series' },
        },
      },
    ])

    await expect(getDefaultPostLoginPath('user_1')).resolves.toBe('/lumi-series')
  })

  it.each([[[]], [[
    {
      entitlement: {
        code: 'LUMI_SERIES',
        series: { code: 'LUMI_SERIES', slug: 'lumi-series', name: 'Lumi Series' },
      },
    },
    {
      entitlement: {
        code: 'CIS',
        series: { code: 'CIS', slug: 'cis', name: 'CIS' },
      },
    },
  ]]])('uses My Services when the user has zero or multiple series', async (grants) => {
    mockedFindMany.mockResolvedValue(grants)
    await expect(getDefaultPostLoginPath('user_1')).resolves.toBe('/my-services')
  })
})
