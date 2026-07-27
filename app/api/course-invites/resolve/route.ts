// app/api/course-invites/resolve/route.ts
// Public invite-token resolver. Returns only minimal validity data.

import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  getIdentifier,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit'
import { auth } from '@/lib/auth'
import { resolveCourseInviteToken } from '@/lib/actions/course-invites'

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request)
  const rateLimitResult = checkRateLimit(
    `course-invite-resolve:${identifier}`,
    RATE_LIMIT_CONFIGS.auth
  )

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { valid: false },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    )
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const courseId = url.searchParams.get('courseId') ?? undefined
  const courseSlug = url.searchParams.get('courseSlug') ?? undefined
  const session = await auth()

  const resolution = await resolveCourseInviteToken({
    token,
    courseId,
    courseSlug,
    userEmail: session?.user?.email,
  })

  const headers = getRateLimitHeaders(rateLimitResult)

  if (!resolution.valid) {
    return NextResponse.json({ valid: false }, { headers })
  }

  return NextResponse.json(
    {
      valid: true,
      courseId: resolution.courseId,
      courseSlug: resolution.courseSlug,
      emailRestricted: resolution.emailRestricted,
      expiresAt: resolution.expiresAt?.toISOString() ?? null,
    },
    { headers }
  )
}
