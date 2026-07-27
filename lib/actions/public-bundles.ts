// lib/actions/public-bundles.ts
// 前台公開組合包查詢

'use server'

import { prisma } from '@/lib/prisma'

export interface PublishedBundle {
  id: string
  title: string
  slug: string
  description: string | null
  coverImage: string | null
  price: number
  salePrice: number | null
  courseCount: number
  lessonCount: number
  totalCourseValue: number
}

export async function getPublishedBundles(): Promise<PublishedBundle[]> {
  const bundles = await prisma.bundle.findMany({
    where: {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    },
    include: {
      courses: {
        orderBy: { order: 'asc' },
        include: {
          course: {
            select: {
              price: true,
              salePrice: true,
              chapters: {
                select: {
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
    orderBy: { updatedAt: 'desc' },
  })

  return bundles.map((bundle) => ({
    id: bundle.id,
    title: bundle.title,
    slug: bundle.slug,
    description: bundle.description,
    coverImage: bundle.coverImage,
    price: bundle.price,
    salePrice: bundle.salePrice,
    courseCount: bundle.courses.length,
    lessonCount: bundle.courses.reduce(
      (sum, item) =>
        sum +
        item.course.chapters.reduce(
          (chapterSum, chapter) => chapterSum + chapter.lessons.length,
          0
        ),
      0
    ),
    totalCourseValue: bundle.courses.reduce(
      (sum, item) => sum + (item.course.salePrice ?? item.course.price),
      0
    ),
  }))
}
