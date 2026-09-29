jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/app-url', () => ({ resolveAppUrl: jest.fn() }))
jest.mock('@/lib/entitlements', () => ({ hasActiveEntitlement: jest.fn() }))
jest.mock('@/lib/lumi-tools', () => ({ getPublishedLumiToolBySlug: jest.fn() }))

import { NextRequest } from 'next/server'
import { GET } from '@/app/lumi-series/launch/[slug]/route'
import { resolveAppUrl } from '@/lib/app-url'
import { auth } from '@/lib/auth'
import { hasActiveEntitlement } from '@/lib/entitlements'
import { getPublishedLumiToolBySlug } from '@/lib/lumi-tools'

const mockedResolveAppUrl = resolveAppUrl as jest.Mock
const mockedAuth = auth as jest.Mock
const mockedHasEntitlement = hasActiveEntitlement as jest.Mock
const mockedGetTool = getPublishedLumiToolBySlug as jest.Mock

const canonicalAppUrl = 'https://bestappstore.co.uk'
const internalAppUrl = 'https://0.0.0.0:8080'
const skillSlugs = [
  'line-sticker-planner',
  'ai-product-social-sales-studio',
  'ai-business-message-assistant',
] as const

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

function callRoute(slug = externalTool.slug, origin = internalAppUrl) {
  return GET(new NextRequest(`${origin}/lumi-series/launch/${slug}`), {
    params: Promise.resolve({ slug }),
  })
}

describe('GET /lumi-series/launch/[slug]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedResolveAppUrl.mockResolvedValue(canonicalAppUrl)
    mockedGetTool.mockResolvedValue(externalTool)
    mockedAuth.mockResolvedValue({ user: { id: 'user_1' } })
    mockedHasEntitlement.mockResolvedValue(true)
  })

  it.each(skillSlugs)(
    'redirects an unauthenticated %s request from the internal origin to canonical login',
    async (slug) => {
      mockedAuth.mockResolvedValue(null)
      mockedGetTool.mockResolvedValue({
        ...externalTool,
        slug,
        runtimeType: 'SKILL_RUNTIME',
        launchUrl: null,
      })

      const response = await callRoute(slug)
      const location = response.headers.get('location')

      expect(response.status).toBe(307)
      expect(location).toBe(
        `${canonicalAppUrl}/login?returnTo=%2Flumi-series%2Flaunch%2F${slug}`
      )
      expect(new URL(location!)).toMatchObject({
        protocol: 'https:',
        hostname: 'bestappstore.co.uk',
        port: '',
      })
      expect(location).not.toContain('0.0.0.0')
      expect(location).not.toContain(':8080')
    }
  )

  it('denies a signed-in user without the required entitlement', async () => {
    mockedHasEntitlement.mockResolvedValue(false)
    const response = await callRoute()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(
      `${canonicalAppUrl}/my-services?access=denied&service=lumi-series`
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

  it('keeps a draft tool unavailable', async () => {
    mockedGetTool.mockResolvedValue({
      ...externalTool,
      slug: 'qmeng-avatar',
      status: 'DRAFT',
      isPublished: false,
    })

    const response = await callRoute('qmeng-avatar')
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'tool_not_found' })
  })

  it('does not launch a Skill without an existing runtime URL', async () => {
    mockedGetTool.mockResolvedValue({
      ...externalTool,
      runtimeType: 'SKILL_RUNTIME',
      launchUrl: null,
    })
    const response = await callRoute('line-sticker-planner')
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: 'tool_runtime_unavailable' })
  })
})
