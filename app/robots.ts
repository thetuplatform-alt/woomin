// app/robots.ts
// 搜尋引擎爬蟲控制規則

import type { MetadataRoute } from 'next'
import { resolveAppUrl } from '@/lib/app-url'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await resolveAppUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/checkout/',
          '/my-courses/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
