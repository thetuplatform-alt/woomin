jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/entitlements', () => ({ hasActiveEntitlement: jest.fn() }))
jest.mock('@/lib/lumi-tools', () => ({ getPublishedLumiToolBySlug: jest.fn() }))

import { NextRequest } from 'next/server'
import { GET } from '@/app/lumi-series/launch/[slug]/route'
import { auth } from '@/lib/auth'
import { hasActiveEntitlement } from '@/lib/entitlements'
import { getPublishedLumiToolBySlug } from '@/lib/lumi-tools'

const mockedAuth = auth as jest.Mock
const mockedHasEntitlement = hasActiveEntitlement as jest.Mock
const mockedGetTool = getPublishedLumiToolBySlug as jest.Mock

const externalTool = {
  slug: 'today-where-to-go',
  runtimeType: 'EXTERNAL_WEB_APP',
  status: 'ACTIVE',
  isPublished: true,
  requiresLogin: true,
  requiredEntitlementCode: 'LUMI_SERIES',
  launchUrl: 'https://lumi-north-travel.yangchingyuan.chatgpt.site/',
  detailUrl: null,
}

function callRoute(slug = externalTool.slug) {
  return GET(new NextRequest(`https://bestappstore.test/lumi-series/launch/${slug}`), {
    params: Promise.resolve({ slug }),
  })
}

describe('GET /lumi-series/launch/[slug]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetTool.mockResolvedValue(externalTool)
    mockedAuth.mockResolvedValue({ user: { id: 'user_1' } })
    mockedHasEntitlement.mockResolvedValue(true)
  })

  it('redirects an unauthenticated visitor to the shared login with a safe returnTo', async () => {
    mockedAuth.mockResolvedValue(null)
    const response = await callRoute()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://bestappstore.test/login?returnTo=%2Flumi-series%2Flaunch%2Ftoday-where-to-go'
    )
  })

  it('denies a signed-in user without the required entitlement', async () => {
    mockedHasEntitlement.mockResolvedValue(false)
    const response = await callRoute()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(
      'https://bestappstore.test/my-services?access=denied&service=lumi-series'
    )
  })

  it('redirects an entitled user to the database-controlled launch URL', async () => {
    const response = await callRoute()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(externalTool.launchUrl)
  })

  it('never accepts an external URL from the request', async () => {
    const response = await callRoute('https:%2F%2Fevil.example')
    expect(response.status).toBe(404)
    expect(mockedGetTool).not.toHaveBeenCalled()
  })

  it('does not launch a Skill without an existing runtime URL', async () => {
    mockedGetTool.mockResolvedValue({
      ...externalTool,
      runtimeType: 'SKILL_RUNTIME',
      launchUrl: null,
    })
    const response = await callRoute('line-sticker-planner')
    expect(response.status).toBe(409)
  })
})
