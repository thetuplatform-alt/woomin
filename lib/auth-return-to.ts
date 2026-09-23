const SAFE_ROUTE_RULES: Array<{
  path: RegExp
  queryKeys?: ReadonlySet<string>
}> = [
  { path: /^\/$/ },
  { path: /^\/lumi-series$/ },
  { path: /^\/lumi-series\/[a-z0-9-]+$/ },
  { path: /^\/lumi-series\/launch\/[a-z0-9-]+$/ },
  { path: /^\/cis$/ },
  { path: /^\/my-(?:courses|subscriptions|services)$/ },
  { path: /^\/courses\/[a-z0-9-]+$/, queryKeys: new Set(['enroll', 'expired']) },
  { path: /^\/courses\/[a-z0-9-]+\/lessons\/[A-Za-z0-9_-]+$/ },
  { path: /^\/bundles\/[a-z0-9-]+$/ },
  {
    path: /^\/checkout$/,
    queryKeys: new Set(['courseId', 'bundleId', 'invite', 'coupon', 'plan']),
  },
  { path: /^\/lesson-tool\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/ },
  { path: /^\/admin(?:\/[A-Za-z0-9_/-]+)?$/ },
]

const INTERNAL_BASE = 'https://bestappstore.invalid'
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/

/**
 * Resolve a login destination against an explicit internal-route allowlist.
 * Unknown paths, absolute/protocol-relative URLs, fragments, and redirect-like
 * query values are rejected instead of being silently passed to the browser.
 */
export function resolveSafeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null
  if (CONTROL_OR_BACKSLASH.test(candidate)) return null

  const rawPath = candidate.split('?', 1)[0]
  try {
    if (rawPath.split('/').some((segment) => ['.', '..'].includes(decodeURIComponent(segment)))) {
      return null
    }
  } catch {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(candidate, INTERNAL_BASE)
  } catch {
    return null
  }

  if (parsed.origin !== INTERNAL_BASE || parsed.hash) return null

  const rule = SAFE_ROUTE_RULES.find((item) => item.path.test(parsed.pathname))
  if (!rule) return null

  if (parsed.searchParams.size > 0) {
    if (!rule.queryKeys) return null
    for (const [key, queryValue] of parsed.searchParams) {
      if (!rule.queryKeys.has(key)) return null
      if (queryValue.length > 500 || queryValue.includes('://') || queryValue.startsWith('//')) {
        return null
      }
    }
  }

  return `${parsed.pathname}${parsed.search}`
}

export function resolveLoginReturnTo(params: {
  returnTo?: unknown
  callbackUrl?: unknown
}): string | null {
  return resolveSafeReturnTo(params.returnTo) ?? resolveSafeReturnTo(params.callbackUrl)
}
