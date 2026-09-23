import 'server-only'
import { prisma } from '@/lib/prisma'

export type AvailableSeries = {
  code: string
  slug: string
  name: string
}

function activeGrantWindow(now: Date) {
  return [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  ]
}

export async function hasActiveEntitlement(
  userId: string,
  entitlementCode: string,
  now: Date = new Date()
): Promise<boolean> {
  const grant = await prisma.userEntitlement.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      entitlement: { code: entitlementCode, isActive: true },
      AND: activeGrantWindow(now),
    },
    select: { id: true },
  })
  return Boolean(grant)
}

export async function getActiveSeriesEntitlements(
  userId: string,
  now: Date = new Date()
): Promise<AvailableSeries[]> {
  const grants = await prisma.userEntitlement.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      entitlement: {
        isActive: true,
        kind: 'SERIES',
        series: { is: { status: 'ACTIVE' } },
      },
      AND: activeGrantWindow(now),
    },
    select: {
      entitlement: {
        select: {
          code: true,
          series: { select: { code: true, slug: true, name: true } },
        },
      },
    },
    orderBy: { entitlement: { series: { displayOrder: 'asc' } } },
  })

  return grants.flatMap(({ entitlement }) =>
    entitlement.series
      ? [{ code: entitlement.code, slug: entitlement.series.slug, name: entitlement.series.name }]
      : []
  )
}

export async function getDefaultPostLoginPath(userId: string): Promise<string> {
  const services = await getActiveSeriesEntitlements(userId)
  if (services.length === 1) return `/${services[0].slug}`
  return '/my-services'
}
