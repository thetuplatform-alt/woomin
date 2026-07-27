// app/(main)/bundles/[slug]/page.tsx
// 組合包前台銷售頁

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveAppUrl } from '@/lib/app-url'
import { resolveAssetUrl } from '@/lib/asset-url'
import { getPublicSiteSettings } from '@/lib/site-settings-public'
import { loadBundleLandingPage } from '@/components/main/bundle-landing/pages/loader'

interface BundlePageProps {
  params: Promise<{ slug: string }>
}

async function getPublishedBundle(slug: string) {
  return prisma.bundle.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
      visibility: { in: ['PUBLIC', 'UNLISTED'] },
    },
    include: {
      courses: {
        orderBy: { order: 'asc' },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              subtitle: true,
              slug: true,
              description: true,
              coverImage: true,
              price: true,
              salePrice: true,
              chapters: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  title: true,
                  lessons: {
                    where: { status: 'PUBLISHED' },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}

export async function generateMetadata({
  params,
}: BundlePageProps): Promise<Metadata> {
  const { slug } = await params
  const bundle = await getPublishedBundle(slug)

  if (!bundle) {
    return { title: '找不到組合包' }
  }

  const baseUrl = await resolveAppUrl()
  const { siteName, shareImage } = await getPublicSiteSettings()
  const title = `${bundle.title} | ${siteName}`
  const description =
    bundle.description ||
    `一次購買 ${bundle.courses.length} 門課程，完整解鎖組合包內容。`
  const ogImage = resolveAssetUrl(bundle.coverImage || shareImage, baseUrl)

  return {
    title,
    description,
    robots:
      bundle.visibility === 'PUBLIC'
        ? undefined
        : {
            index: false,
            follow: false,
          },
    openGraph: {
      type: 'website',
      url: `${baseUrl}/bundles/${slug}`,
      siteName,
      title,
      description,
      images: ogImage ? [{ url: ogImage, alt: bundle.title }] : undefined,
    },
  }
}

export default async function BundlePage({ params }: BundlePageProps) {
  const { slug } = await params
  const [bundle, session] = await Promise.all([
    getPublishedBundle(slug),
    auth(),
  ])

  if (!bundle || bundle.courses.length === 0) {
    notFound()
  }

  const courseIds = bundle.courses.map((item) => item.course.id)
  const ownedCourseIds = session?.user?.id
    ? await prisma.purchase.findMany({
        where: {
          userId: session.user.id,
          courseId: { in: courseIds },
          revokedAt: null,
        },
        select: { courseId: true },
      })
    : []
  const ownedSet = new Set(ownedCourseIds.map((purchase) => purchase.courseId))
  const ownsAllCourses = ownedSet.size === courseIds.length
  const finalPrice = bundle.salePrice ?? bundle.price
  const isOnSale = bundle.salePrice != null && bundle.salePrice < bundle.price
  const totalCourseValue = bundle.courses.reduce((sum, item) => {
    const coursePrice = item.course.salePrice ?? item.course.price
    return sum + coursePrice
  }, 0)
  const totalLessons = bundle.courses.reduce(
    (sum, item) =>
      sum +
      item.course.chapters.reduce(
        (chapterSum, chapter) => chapterSum + chapter.lessons.length,
        0
      ),
    0
  )
  const BundleLandingPage = await loadBundleLandingPage(bundle.slug)

  return (
    <BundleLandingPage
      bundle={bundle}
      isLoggedIn={!!session?.user?.id}
      ownedCourseIds={ownedCourseIds.map((purchase) => purchase.courseId)}
      ownsAllCourses={ownsAllCourses}
      finalPrice={finalPrice}
      originalPrice={bundle.price}
      isOnSale={isOnSale}
      totalCourseValue={totalCourseValue}
      totalLessons={totalLessons}
      checkoutHref={`/checkout?bundleId=${bundle.id}`}
    />
  )
}
