// components/main/bundle-grid.tsx
// 前台組合包列表

import { BundleCard } from '@/components/main/bundle-card'
import type { PublishedBundle } from '@/lib/actions/public-bundles'

interface BundleGridProps {
  bundles: PublishedBundle[]
}

export function BundleGrid({ bundles }: BundleGridProps) {
  if (bundles.length === 0) return null

  return (
    <section id="bundles" className="border-t border-surface-hover bg-surface py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
            精選組合包
          </h2>
          <p className="mt-4 text-lg text-body">
            一次解鎖完整學習路線，用更清楚的順序完成系統化學習。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      </div>
    </section>
  )
}
