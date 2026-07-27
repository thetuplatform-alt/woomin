// components/main/bundle-card.tsx
// 前台組合包卡片

'use client'

import Link from 'next/link'
import { ArrowRight, Boxes, BookOpen, Layers } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils/price'
import type { PublishedBundle } from '@/lib/actions/public-bundles'

interface BundleCardProps {
  bundle: PublishedBundle
}

export function BundleCard({ bundle }: BundleCardProps) {
  const finalPrice = bundle.salePrice ?? bundle.price
  const isOnSale = bundle.salePrice != null && bundle.salePrice < bundle.price
  const hasValueAnchor = bundle.totalCourseValue > finalPrice

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link href={`/bundles/${bundle.slug}`} className="group block h-full">
        <Card className="h-full overflow-hidden border-divider bg-white transition-all duration-300 hover:border-cta/50 hover:shadow-xl hover:shadow-cta/5">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-hover">
            {bundle.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bundle.coverImage}
                alt={bundle.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface">
                <Boxes className="h-10 w-10 text-[#D4D4D4]" />
              </div>
            )}
            <div className="absolute left-4 top-4">
              <span className="rounded-full bg-heading px-3 py-1 text-xs font-bold text-white shadow-sm">
                組合包
              </span>
            </div>
          </div>

          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-2">
              <h3 className="line-clamp-2 text-xl font-bold text-heading transition-colors group-hover:text-cta">
                {bundle.title}
              </h3>
              {bundle.description && (
                <p className="line-clamp-2 text-sm leading-relaxed text-body">
                  {bundle.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-caption">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                {bundle.courseCount} 門課
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                {bundle.lessonCount} 單元
              </span>
            </div>

            <div className="h-px bg-surface-hover" />

            <div className="flex items-center justify-between pt-2">
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-cta">
                    {formatPrice(finalPrice)}
                  </span>
                  {isOnSale && (
                    <span className="text-sm text-caption line-through">
                      {formatPrice(bundle.price)}
                    </span>
                  )}
                </div>
                {hasValueAnchor && (
                  <span className="mt-1 text-xs text-caption">
                    單買合計 {formatPrice(bundle.totalCourseValue)}
                  </span>
                )}
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-heading transition-colors group-hover:bg-cta group-hover:text-white">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
