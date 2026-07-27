// middleware.ts
// Next.js Middleware
// 保護需要認證的路由，檢查用戶權限

import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

// 使用 Edge-compatible 配置建立 auth 函數
const { auth } = NextAuth(authConfig)

// 需要追蹤的 UTM 參數
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const UTM_COOKIE_NAME = '__utm'
const UTM_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 天

// 檢查是否為課程內容頁面（需要登入）
// 匹配 /courses/[slug]/lessons/* 路徑
const isLessonPage = (pathname: string) => {
  const lessonPattern = /^\/courses\/[^/]+\/lessons\/.+$/
  return lessonPattern.test(pathname)
}

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth?.user

  // 初始化頁面 /admin/setup 不需要 ADMIN 角色（僅需登入）
  if (nextUrl.pathname === '/admin/setup') {
    // 初始化頁面不做角色檢查，讓 page.tsx 自行處理
    // 但未登入仍導向登入
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', nextUrl)
      loginUrl.searchParams.set('callbackUrl', '/admin/setup')
      return Response.redirect(loginUrl)
    }
    return
  }

  // 保護 /admin 路由：middleware 只檢查登入狀態。
  // 角色權限交給 admin layout / server actions 直接查 DB，避免 JWT 角色快取導致已是管理員仍被擋下。
  if (nextUrl.pathname.startsWith('/admin')) {
    // 未登入，導向登入頁面
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', nextUrl)
      loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
      return Response.redirect(loginUrl)
    }
  }

  // 保護課程內容頁面（需要登入）
  if (isLessonPage(nextUrl.pathname)) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', nextUrl)
      loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
      return Response.redirect(loginUrl)
    }
  }

  // 已登入用戶訪問登入/註冊/忘記密碼頁面，導向首頁
  // 注意：/reset-password 不可攔截。使用者可能已用其他身分登入（例如原本用 OAuth
  // 登入的帳號），但仍是透過信件連結來設定/重設密碼，攔截會導致 token 永遠無法被消費。
  if (isLoggedIn && (
    nextUrl.pathname === '/login' ||
    nextUrl.pathname === '/register' ||
    nextUrl.pathname === '/forgot-password'
  )) {
    return Response.redirect(new URL('/', nextUrl))
  }

  // UTM 歸因追蹤：當 URL 含有 utm_* 參數時，存入 cookie（首次觸及歸因）
  const hasUtmParams = UTM_PARAMS.some((p) => nextUrl.searchParams.has(p))
  if (hasUtmParams) {
    const utmData: Record<string, string> = {}
    for (const param of UTM_PARAMS) {
      const value = nextUrl.searchParams.get(param)
      if (value) utmData[param] = value
    }

    const response = NextResponse.next()
    response.cookies.set(UTM_COOKIE_NAME, JSON.stringify(utmData), {
      maxAge: UTM_COOKIE_MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })
    return response
  }

  return
})

// 配置 Middleware 匹配路徑
export const config = {
  matcher: [
    // 保護 admin 路由
    '/admin/:path*',
    // 保護課程內容頁面
    '/courses/:path*/lessons/:path*',
    // 認證相關頁面
    '/login',
    '/register',
    // 排除靜態資源和 API
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2|ttf|otf)$).*)',
  ],
}
