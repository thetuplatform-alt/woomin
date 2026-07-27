// components/main/landing/pages/types.ts
// 銷售頁元件共用型別

import type {
  CourseDetail,
  PurchaseStatus,
  PlanOption,
} from '@/lib/actions/public-courses'
import type { ReviewStats, ReviewData, UserReview } from '@/lib/validations/review'

export type { PlanOption }

export interface LandingPageProps {
  course: CourseDetail
  purchaseStatus: PurchaseStatus
  isLoggedIn: boolean
  isFree: boolean
  finalPrice: number
  originalPrice: number
  isOnSale: boolean
  saleEndAt: Date | null
  saleLabel: string
  countdownTarget: Date | null
  saleCycleEnabled: boolean
  saleCycleDays: number | null
  showCountdown: boolean
  shouldAutoEnroll: boolean
  inviteToken?: string | null
  // 評價相關
  reviewStats: ReviewStats
  reviews: ReviewData[]
  reviewsHasMore: boolean
  userReview: UserReview | null
  enableReviews: boolean  // 評價功能總開關
  showReviews: boolean    // 銷售頁顯示評價區塊
  currentUserId?: string | null
  // 訂閱方案（AC-16：全部 optional，客戶站客製頁升級編譯相容）
  // 僅在「有啟用方案且 gateway 支援」時由 dispatcher 填入；否則為 undefined
  subscriptionPlans?: PlanOption[]
}
