// lib/actions/posthog-analytics.ts
// PostHog API 查詢 Server Actions
// 透過 PostHog Query API 取得漏斗和趨勢資料

'use server'

import { requireOnlyAdminAuth } from '@/lib/require-admin'
import type { FunnelStep } from '@/lib/actions/analytics'
import { getAnalyticsSettings } from '@/lib/analytics-settings'

const POSTHOG_QUERY_TIMEOUT_MS = 1500
const MIN_PERSONAL_API_KEY_LENGTH = 20
const loggedWarnings = new Set<string>()

function warnPostHogOnce(code: string, message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development' && loggedWarnings.has(code)) {
    return
  }

  loggedWarnings.add(code)
  console.warn(`[PostHog] ${message}`, details ?? '')
}

function getUsablePersonalApiKey(value: string): string | null {
  const apiKey = value.trim()

  if (!apiKey) {
    return null
  }

  const isMaskedValue = apiKey.includes('...') || /^[*•]+$/.test(apiKey)
  if (isMaskedValue) {
    warnPostHogOnce('masked-personal-api-key', 'Personal API Key looks masked; funnel query skipped.')
    return null
  }

  if (apiKey.length < MIN_PERSONAL_API_KEY_LENGTH) {
    warnPostHogOnce('short-personal-api-key', 'Personal API Key looks too short; funnel query skipped.', {
      keyLength: apiKey.length,
    })
    return null
  }

  return apiKey
}

function getPostHogQueryUrl(hostSetting: string): string | null {
  const host = (hostSetting || 'https://us.i.posthog.com').trim().replace(/\/+$/, '')

  try {
    const url = new URL('/api/environments/@current/query/', host)
    return url.toString()
  } catch {
    warnPostHogOnce('invalid-host', 'Invalid PostHog host; funnel query skipped.')
    return null
  }
}

function isPostHogFunnelResponse(value: unknown): value is PostHogFunnelResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as { results?: unknown }).results)
  )
}

/**
 * 呼叫 PostHog Query API
 */
async function queryPostHog(query: Record<string, unknown>): Promise<unknown | null> {
  const settings = await getAnalyticsSettings()
  const personalApiKey = getUsablePersonalApiKey(settings.posthogPersonalApiKey)

  if (!personalApiKey) {
    return null
  }

  const url = getPostHogQueryUrl(settings.posthogHost)
  if (!url) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), POSTHOG_QUERY_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${personalApiKey}`,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
      next: { revalidate: 300 }, // 快取 5 分鐘
    })

    if (!res.ok) {
      warnPostHogOnce(`api-error-${res.status}`, 'Funnel query skipped after PostHog API error.', {
        status: res.status,
      })
      return null
    }

    return await res.json()
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    warnPostHogOnce(
      isAbort ? 'query-timeout' : 'query-failed',
      isAbort ? 'Funnel query timed out; dashboard continued without PostHog data.' : 'Funnel query failed; dashboard continued without PostHog data.'
    )
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 取得轉換漏斗數據（PostHog Funnel Query）
 * 瀏覽網頁 → 點擊 CTA → 建立訂單 → 付款成功
 */
export async function getPostHogFunnel(days: number = 30): Promise<FunnelStep[]> {
  // M15：全站轉換漏斗為平台級營運數據，僅限 ADMIN（避免講師取得全站行銷 / 轉換機密）
  await requireOnlyAdminAuth()

  const result = await queryPostHog({
    kind: 'FunnelsQuery',
    series: [
      { kind: 'EventsNode', event: '$pageview', custom_name: '瀏覽網頁' },
      { kind: 'EventsNode', event: 'cta_clicked', custom_name: '點擊 CTA' },
      { kind: 'EventsNode', event: 'checkout_initiated', custom_name: '建立訂單' },
      { kind: 'EventsNode', event: 'payment_succeeded', custom_name: '付款成功' },
    ],
    dateRange: { date_from: `-${days}d` },
    funnelsFilter: {
      funnelWindowInterval: days,
      funnelWindowIntervalUnit: 'day',
      funnelOrderType: 'ordered',
      funnelVizType: 'steps',
    },
  })

  if (!isPostHogFunnelResponse(result)) {
    return []
  }

  // 轉換為 FunnelStep 格式
  const firstStepCount = result.results[0]?.count || 1
  const steps: FunnelStep[] = result.results.map(
    (step: PostHogFunnelStep, index: number) => {
      const prevStepCount = index > 0 ? result.results[index - 1]?.count || 1 : step.count

      return {
        name: step.custom_name || step.name,
        count: step.count,
        conversionRate:
          index === 0
            ? 100
            : Math.round((step.count / prevStepCount) * 1000) / 10,
        overallConversionRate:
          index === 0
            ? 100
            : Math.round((step.count / firstStepCount) * 1000) / 10,
      }
    }
  )

  return steps
}

// PostHog API response types
interface PostHogFunnelStep {
  action_id: string
  name: string
  custom_name?: string
  order: number
  count: number
  type: string
  average_conversion_time: number | null
  median_conversion_time: number | null
}

interface PostHogFunnelResponse {
  results: PostHogFunnelStep[]
}
