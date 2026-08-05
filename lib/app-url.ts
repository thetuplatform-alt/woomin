import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'

const DEFAULT_APP_URL = 'http://localhost:3000'

const ENV_APP_URL_KEYS = [
  'NEXT_PUBLIC_APP_URL',
  'APP_URL',
  'SITE_URL',
  'AUTH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'ZEABUR_URL',
  'ZEABUR_WEB_URL',
] as const

const ALWAYS_PRIVATE_HOSTS = new Set(['0.0.0.0', '::', '[::]'])
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production'
}

export function isInternalAppHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return ALWAYS_PRIVATE_HOSTS.has(normalized) || LOCAL_HOSTS.has(normalized)
}

function isAllowedAppUrl(url: URL): boolean {
  if (ALWAYS_PRIVATE_HOSTS.has(url.hostname.toLowerCase())) {
    return false
  }

  if (isProductionRuntime() && LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    return false
  }

  return true
}

function normalizeAppUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) {
    return null
  }

  const candidate = value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://${value}`

  try {
    const url = new URL(candidate)
    if (!isAllowedAppUrl(url)) {
      return null
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function resolveOriginFromHeaders(headerSource: Headers): string | null {
  const forwardedProto = headerSource.get('x-forwarded-proto')
  const forwardedHost = headerSource.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    return normalizeAppUrl(`${forwardedProto}://${forwardedHost}`)
  }

  const host = headerSource.get('host')
  if (host) {
    const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https')
    return normalizeAppUrl(`${protocol}://${host}`)
  }

  const origin = headerSource.get('origin')
  if (origin) {
    return normalizeAppUrl(origin)
  }

  return null
}

function getPlatformAppUrl(): string | null {
  for (const key of ENV_APP_URL_KEYS) {
    const value = process.env[key]
    if (value) {
      const normalized = normalizeAppUrl(value)
      if (normalized) {
        return normalized
      }
    }
  }

  return null
}

async function getDbAppUrl(): Promise<string | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.SITE_URL },
      select: { value: true },
    })

    if (!setting?.value) {
      return null
    }

    return normalizeAppUrl(setting.value)
  } catch {
    return null
  }
}

export function getAppUrl(): string {
  return getPlatformAppUrl() || DEFAULT_APP_URL
}

export async function getStoredAppUrl(): Promise<string> {
  return (await getDbAppUrl()) || getPlatformAppUrl() || DEFAULT_APP_URL
}

export async function getAppUrlFromRequest(request: Request): Promise<string> {
  return resolveOriginFromHeaders(request.headers) || (await getStoredAppUrl())
}

export async function resolveAppUrl(options?: {
  request?: Request
  headers?: Headers
}): Promise<string> {
  if (options?.request) {
    return getAppUrlFromRequest(options.request)
  }

  if (options?.headers) {
    return resolveOriginFromHeaders(options.headers) || (await getStoredAppUrl())
  }

  try {
    const headerStore = await headers()
    const resolved = resolveOriginFromHeaders(headerStore)
    if (resolved) {
      return resolved
    }
  } catch {
    // headers() is unavailable outside the request lifecycle.
  }

  return getStoredAppUrl()
}
