// app/sitemap.ts
// 動態產生 XML Sitemap，讓搜尋引擎高效發現所有頁面

import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { resolveAppUrl } from '@/lib/app-url'

// 強制動態渲染（建置時無法連接 Zeabur 內部資料庫）
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await resolveAppUrl()

  // 取得所有已發佈的課程
  const courses = await prisma.course.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true, updatedAt: true },
  })

  // 靜態頁面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/courses`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date('2024-01-09'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2024-01-09'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // 動態課程頁面
  const coursePages: MetadataRoute.Sitemap = courses.map((course) => ({
    url: `${baseUrl}/courses/${course.slug}`,
    lastModified: course.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...coursePages]
}
