// components/main/bundle-landing/pages/loader.ts
// 動態載入組合包銷售頁元件

import type { ComponentType } from 'react'
import type { BundleLandingProps } from './types'

// 組合包銷售頁元件 registry
// 新增專屬組合包頁時在此加入對應的 import：
// '{slug}': () => import('./{slug}'),
const bundleLandingPages: Record<
  string,
  () => Promise<{ default: ComponentType<BundleLandingProps> }>
> = {}

export async function loadBundleLandingPage(
  slug: string
): Promise<ComponentType<BundleLandingProps>> {
  const loader = bundleLandingPages[slug]

  if (loader) {
    const mod = await loader()
    return mod.default
  }

  const defaultMod = await import('./default')
  return defaultMod.default
}
