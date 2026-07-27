// lib/tours/registry.ts
// Tour 註冊表 + 由路徑解析出對應 Tour。
// 每頁一份獨立 Tour;新增頁面教學時,在 definitions/ 加檔並在此註冊即可。

import type { Tour } from './types'

// 課程編輯區(/admin/courses/...)
import courseList from './definitions/course-list.tour'
import courseNew from './definitions/course-new.tour'
import courseInfo from './definitions/course-info.tour'
import coursePricing from './definitions/course-pricing.tour'
import courseInvites from './definitions/course-invites.tour'
import courseContent from './definitions/course-content.tour'
import courseAssignments from './definitions/course-assignments.tour'
import courseComments from './definitions/course-comments.tour'
import courseMessages from './definitions/course-messages.tour'
import courseReviews from './definitions/course-reviews.tour'
import courseAnalytics from './definitions/course-analytics.tour'

// 後台主要頁面(側邊欄各分頁)
import dashboard from './definitions/dashboard.tour'
import bundles from './definitions/bundles.tour'
import media from './definitions/media.tour'
import users from './definitions/users.tour'
import comments from './definitions/comments.tour'
import messages from './definitions/messages.tour'
import orders from './definitions/orders.tour'
import subscriptions from './definitions/subscriptions.tour'
import coupons from './definitions/coupons.tour'
import payments from './definitions/payments.tour'
import analytics from './definitions/analytics.tour'
import instructors from './definitions/instructors.tour'
import settings from './definitions/settings.tour'
import privacy from './definitions/privacy.tour'
import terms from './definitions/terms.tour'

export const tours: Record<string, Tour> = {
  // 課程編輯區
  'course-list': courseList,
  'course-new': courseNew,
  'course-info': courseInfo,
  'course-pricing': coursePricing,
  'course-invites': courseInvites,
  'course-content': courseContent,
  'course-assignments': courseAssignments,
  'course-comments': courseComments,
  'course-messages': courseMessages,
  'course-reviews': courseReviews,
  'course-analytics': courseAnalytics,
  // 後台主要頁面
  dashboard,
  bundles,
  media,
  users,
  comments,
  messages,
  orders,
  subscriptions,
  coupons,
  payments,
  analytics,
  instructors,
  settings,
  privacy,
  terms,
}

/** 後台主要頁面的精確路徑 → Tour id(以路徑前綴比對,涵蓋子頁) */
const STATIC_ROUTES: Array<[string, string]> = [
  ['/admin/courses/new', 'course-new'],
  ['/admin/courses', 'course-list'],
  ['/admin/bundles', 'bundles'],
  ['/admin/media', 'media'],
  ['/admin/users', 'users'],
  ['/admin/comments', 'comments'],
  ['/admin/messages', 'messages'],
  ['/admin/orders', 'orders'],
  ['/admin/subscriptions', 'subscriptions'],
  ['/admin/coupons', 'coupons'],
  ['/admin/payments', 'payments'],
  ['/admin/analytics', 'analytics'],
  ['/admin/instructors', 'instructors'],
  ['/admin/settings', 'settings'],
  ['/admin/privacy', 'privacy'],
  ['/admin/terms', 'terms'],
]

/** 課程編輯區的分頁 → Tour id */
const TAB_TO_TOUR: Record<string, string> = {
  info: 'course-info',
  'welcome-email': 'course-info',
  pricing: 'course-pricing',
  invites: 'course-invites',
  content: 'course-content',
  assignments: 'course-assignments',
  comments: 'course-comments',
  messages: 'course-messages',
  reviews: 'course-reviews',
  analytics: 'course-analytics',
}

export function getTour(id: string | null | undefined): Tour | null {
  if (!id) return null
  return tours[id] ?? null
}

/**
 * 由目前路徑解析出該頁的 Tour id。找不到對應教學時回傳 null。
 */
export function resolveTourId(pathname: string | null | undefined): string | null {
  if (!pathname) return null

  // 課程編輯區的分頁(/admin/courses/{id}/{tab})優先比對
  const tabMatch = pathname.match(/^\/admin\/courses\/[^/]+\/([\w-]+)/)
  if (tabMatch) return TAB_TO_TOUR[tabMatch[1]] ?? null

  // 後台主要頁面:精確或前綴比對(/admin/courses 與 /admin/courses/new 已在上方處理)
  for (const [route, id] of STATIC_ROUTES) {
    if (pathname === route || pathname.startsWith(route + '/')) return id
  }

  // 後台首頁(儀表板)
  if (pathname === '/admin') return 'dashboard'

  return null
}
