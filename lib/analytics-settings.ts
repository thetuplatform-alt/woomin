// lib/analytics-settings.ts
// 從資料庫讀取分析追蹤相關設定（GA、PostHog）
// 用於前台 script 注入和 PostHog 初始化

import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'

export interface AnalyticsSettings {
  gaId: string
  posthogKey: string
  posthogHost: string
  posthogPersonalApiKey: string
  metaPixelId: string
  metaCapiAccessToken: string
}

const ANALYTICS_DEFAULTS: AnalyticsSettings = {
  gaId: process.env.GA_ID || '',
  posthogKey: process.env.POSTHOG_KEY || '',
  posthogHost: process.env.POSTHOG_HOST || '',
  posthogPersonalApiKey: process.env.POSTHOG_PERSONAL_API_KEY || '',
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || '',
  metaCapiAccessToken: process.env.META_CAPI_ACCESS_TOKEN || '',
}

export const getAnalyticsSettings = cache(async (): Promise<AnalyticsSettings> => {
  const keys = [
    SETTING_KEYS.GA_ID,
    SETTING_KEYS.POSTHOG_KEY,
    SETTING_KEYS.POSTHOG_HOST,
    SETTING_KEYS.POSTHOG_PERSONAL_API_KEY,
    SETTING_KEYS.META_PIXEL_ID,
    SETTING_KEYS.META_CAPI_ACCESS_TOKEN,
  ]

  let settings: { key: string; value: string }[] = []
  try {
    settings = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
    })
  } catch {
    // DB not available (e.g. during build), return defaults
  }

  const map = new Map(settings.map((s) => [s.key, s.value]))

  return {
    gaId: map.get(SETTING_KEYS.GA_ID) || ANALYTICS_DEFAULTS.gaId,
    posthogKey: map.get(SETTING_KEYS.POSTHOG_KEY) || ANALYTICS_DEFAULTS.posthogKey,
    posthogHost: map.get(SETTING_KEYS.POSTHOG_HOST) || ANALYTICS_DEFAULTS.posthogHost,
    posthogPersonalApiKey:
      map.get(SETTING_KEYS.POSTHOG_PERSONAL_API_KEY) || ANALYTICS_DEFAULTS.posthogPersonalApiKey,
    metaPixelId: map.get(SETTING_KEYS.META_PIXEL_ID) || ANALYTICS_DEFAULTS.metaPixelId,
    metaCapiAccessToken:
      map.get(SETTING_KEYS.META_CAPI_ACCESS_TOKEN) || ANALYTICS_DEFAULTS.metaCapiAccessToken,
  }
})
