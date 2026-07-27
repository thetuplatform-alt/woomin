// components/main/bundle-landing/pages/types.ts
// 組合包銷售頁元件共用型別

export interface BundleLandingCourse {
  id: string
  title: string
  subtitle: string | null
  slug: string
  description: string | null
  coverImage: string | null
  price: number
  salePrice: number | null
  chapters: {
    id: string
    title: string
    lessons: { id: string }[]
  }[]
}

export interface BundleLandingBundleCourse {
  id: string
  order: number
  course: BundleLandingCourse
}

export interface BundleLandingBundle {
  id: string
  title: string
  slug: string
  description: string | null
  coverImage: string | null
  price: number
  salePrice: number | null
  status: string
  visibility: string
  courses: BundleLandingBundleCourse[]
}

export interface BundleLandingProps {
  bundle: BundleLandingBundle
  isLoggedIn: boolean
  ownedCourseIds: string[]
  ownsAllCourses: boolean
  finalPrice: number
  originalPrice: number
  isOnSale: boolean
  totalCourseValue: number
  totalLessons: number
  checkoutHref: string
}
