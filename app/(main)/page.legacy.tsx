// app/(main)/page.tsx
// 首頁

import type { Metadata } from 'next'
import { getPublishedCourses } from '@/lib/actions/public-courses'
import { getPublishedBundles } from '@/lib/actions/public-bundles'
import { HomeCourseCarousel } from '@/components/main/home-course-carousel'
import { CourseGrid, CourseGridEmpty } from '@/components/main/course-grid'
import { BundleGrid } from '@/components/main/bundle-grid'
import { JsonLd } from '@/components/common/json-ld'
import { resolveAppUrl } from '@/lib/app-url'
import { DEFAULT_SITE_ICON_PATH } from '@/lib/site-brand-assets'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = await resolveAppUrl()

  return {
    title: {
      absolute: 'WooMin 線上課程平台',
    },
    description: '精選線上課程與專業內容，幫助學員快速開始學習。',
    alternates: {
      canonical: appUrl,
    },
  }
}

export default async function HomePage() {
  const appUrl = await resolveAppUrl()
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'WooMin',
    url: appUrl,
    logo: `${appUrl}${DEFAULT_SITE_ICON_PATH}`,
    description: 'WooMin 線上課程平台',
  }

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'WooMin 線上課程平台',
    url: appUrl,
    description: '精選線上課程與專業內容，幫助學員快速開始學習。',
    inLanguage: 'zh-TW',
    publisher: {
      '@type': 'Organization',
      name: 'WooMin',
    },
  }

  const [courses, bundles] = await Promise.all([
    getPublishedCourses(),
    getPublishedBundles(),
  ])
  const hasProducts = courses.length > 0 || bundles.length > 0

  return (
    <main className="flex flex-col bg-white">
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />

      {courses.length > 0 ? (
        <HomeCourseCarousel courses={courses} />
      ) : (
        <section className="bg-white py-20 text-center">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold text-heading sm:text-6xl">
              精選線上課程
            </h1>
            <p className="mt-6 text-lg text-body">
              {hasProducts
                ? '挑選最適合你的課程或組合包，開始系統化學習。'
                : '目前尚未上架課程，完成初始設定後即可開始建立並販售內容。'}
            </p>
          </div>
        </section>
      )}

      <BundleGrid bundles={bundles} />

      <section id="courses" className="border-t border-surface-hover py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
              所有課程
            </h2>
            <p className="mt-4 text-lg text-body">
              瀏覽目前已發佈的課程內容，挑選最適合你的學習主題。
            </p>
          </div>

          {courses.length > 0 ? (
            <CourseGrid courses={courses} showTitle={false} />
          ) : (
            <CourseGridEmpty />
          )}
        </div>
      </section>

      <section className="mx-4 mb-20 overflow-hidden rounded-[2.5rem] bg-heading py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold sm:text-4xl">
            準備好開始建立你的課程事業了嗎
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
            從內容上架、銷售頁、付款到學員管理，整個課程平台都已經替你準備好。
          </p>
        </div>
      </section>
    </main>
  )
}
