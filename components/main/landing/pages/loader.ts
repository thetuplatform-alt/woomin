// components/main/landing/pages/loader.ts
// 動態載入課程銷售頁元件

import type { ComponentType } from 'react'
import type { LandingPageProps } from './types'

// 銷售頁元件 registry
// 新增課程時在此加入對應的 import
const landingPages: Record<string, () => Promise<{ default: ComponentType<LandingPageProps> }>> = {
  'ios-vibe-coding': () => import('./ios-vibe-coding'),
  'online-courses-logic': () => import('./online-courses-logic'),
  'react-beginner': () => import('./react-beginner'),
  'test-course': () => import('./test-course'),
}

/**
 * 根據 slug 載入對應的銷售頁元件
 * 找不到則回傳 default 元件
 */
export async function loadLandingPage(
  slug: string
): Promise<ComponentType<LandingPageProps>> {
  const loader = landingPages[slug]

  if (loader) {
    const mod = await loader()
    return mod.default
  }

  // Fallback: 使用預設銷售頁
  const defaultMod = await import('./default')
  return defaultMod.default
}
