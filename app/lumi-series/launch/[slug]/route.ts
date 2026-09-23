import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasActiveEntitlement } from '@/lib/entitlements'
import { getPublishedLumiToolBySlug } from '@/lib/lumi-tools'

type RouteContext = { params: Promise<{ slug: string }> }

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function controlledExternalUrl(value: string | null): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params
  if (!SAFE_SLUG.test(slug)) {
    return NextResponse.json({ error: 'tool_not_found' }, { status: 404 })
  }

  const tool = await getPublishedLumiToolBySlug(slug)
  if (!tool || !tool.isPublished || tool.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'tool_not_found' }, { status: 404 })
  }

  const session = await auth()
  if (tool.requiresLogin && !session?.user?.id) {
    const loginUrl = new URL('/login', request.nextUrl.origin)
    loginUrl.searchParams.set('returnTo', `/lumi-series/launch/${slug}`)
    return NextResponse.redirect(loginUrl)
  }

  const requiredEntitlement = tool.requiredEntitlementCode ?? 'LUMI_SERIES'
  if (
    requiredEntitlement &&
    (!session?.user?.id || !(await hasActiveEntitlement(session.user.id, requiredEntitlement)))
  ) {
    const servicesUrl = new URL('/my-services', request.nextUrl.origin)
    servicesUrl.searchParams.set('access', 'denied')
    servicesUrl.searchParams.set('service', 'lumi-series')
    return NextResponse.redirect(servicesUrl, 303)
  }

  if (tool.runtimeType === 'EXTERNAL_WEB_APP') {
    const launchUrl = controlledExternalUrl(tool.launchUrl)
    if (!launchUrl) {
      return NextResponse.json({ error: 'tool_launch_unavailable' }, { status: 409 })
    }
    return NextResponse.redirect(launchUrl)
  }

  if (tool.runtimeType === 'BESTAPPSTORE_NATIVE' && tool.detailUrl) {
    const detailUrl = new URL(tool.detailUrl, request.nextUrl.origin)
    if (detailUrl.origin === request.nextUrl.origin) return NextResponse.redirect(detailUrl)
  }

  // Skill Runtime migration is intentionally outside this batch.
  return NextResponse.json({ error: 'tool_runtime_unavailable' }, { status: 409 })
}
