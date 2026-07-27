// components/main/bundle-landing/pages/default.tsx
// 預設組合包銷售頁

import Link from 'next/link'
import { CheckCircle2, Layers, Lock, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils/price'
import type { BundleLandingProps } from './types'

export default function DefaultBundleLandingPage({
  bundle,
  ownedCourseIds,
  ownsAllCourses,
  finalPrice,
  originalPrice,
  isOnSale,
  totalCourseValue,
  totalLessons,
  checkoutHref,
}: BundleLandingProps) {
  const ownedSet = new Set(ownedCourseIds)

  return (
    <main className="min-h-screen bg-white">
      <section className="border-b border-divider bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <Badge className="mb-5 w-fit rounded-full bg-primary text-primary-foreground">
              組合包
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-heading sm:text-5xl">
              {bundle.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-body">
              {bundle.description ||
                `一次解鎖 ${bundle.courses.length} 門完整課程，適合想系統化學習並一次取得所有內容的學員。`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-body">
              <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-white px-4 py-2">
                <Layers className="h-4 w-4 text-primary" />
                {bundle.courses.length} 門課程
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-white px-4 py-2">
                <PlayCircle className="h-4 w-4 text-primary" />
                {totalLessons} 個單元
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-white px-4 py-2">
                <Lock className="h-4 w-4 text-primary" />
                付款成功後自動開通
              </span>
            </div>
          </div>

          <aside className="rounded-lg border border-divider bg-white p-6 shadow-sm">
            <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted">
              {bundle.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bundle.coverImage}
                  alt={bundle.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Layers className="h-12 w-12" />
                </div>
              )}
            </div>
            <div className="mt-6">
              <p className="text-sm text-caption">組合包價格</p>
              <div className="mt-2 flex items-end gap-3">
                <span className="text-4xl font-bold text-heading">
                  {formatPrice(finalPrice)}
                </span>
                {isOnSale && (
                  <span className="pb-1 text-lg text-caption line-through">
                    {formatPrice(originalPrice)}
                  </span>
                )}
              </div>
              {totalCourseValue > finalPrice && (
                <p className="mt-2 text-sm text-body">
                  單買課程合計 {formatPrice(totalCourseValue)}
                </p>
              )}
            </div>
            <div className="mt-6">
              {ownsAllCourses ? (
                <Button asChild className="w-full rounded-full py-6 text-base font-semibold">
                  <Link href="/my-courses">前往我的課程</Link>
                </Button>
              ) : (
                <Button asChild className="w-full rounded-full py-6 text-base font-semibold">
                  <Link href={checkoutHref}>購買組合包</Link>
                </Button>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-heading">內含課程</h2>
          <p className="mt-2 text-body">
            購買成功後，以下課程會一次加入學員的「我的課程」。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {bundle.courses.map((item, index) => (
            <article
              key={item.id}
              className="rounded-lg border border-divider bg-white p-5"
            >
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-heading">{item.course.title}</h3>
                    {ownedSet.has(item.course.id) && (
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                        已擁有
                      </Badge>
                    )}
                  </div>
                  {item.course.subtitle && (
                    <p className="mt-1 text-sm text-body">{item.course.subtitle}</p>
                  )}
                  <p className="mt-3 text-sm text-caption">
                    {item.course.chapters.length} 個章節，
                    {item.course.chapters.reduce(
                      (sum, chapter) => sum + chapter.lessons.length,
                      0
                    )}{' '}
                    個單元
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!ownsAllCourses && (
          <div className="mt-12 rounded-lg border border-divider bg-surface p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="text-2xl font-bold text-heading">一次完成購買與開通</h2>
            <p className="mx-auto mt-3 max-w-2xl text-body">
              結帳成功後，系統會自動為帳號授權組合包內所有課程，不需要逐門手動加入。
            </p>
            <Button asChild className="mt-6 rounded-full px-8 py-6 text-base font-semibold">
              <Link href={checkoutHref}>前往結帳</Link>
            </Button>
          </div>
        )}
      </section>
    </main>
  )
}
