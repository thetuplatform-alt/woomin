// app/(auth)/login/page.tsx
// 登入頁面
// 支援電子郵件密碼登入和 OAuth 登入

import { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/forms/login-form'
import { AuthPageWrapper } from '@/components/auth/auth-page-wrapper'
import { getPublicSiteSettings } from '@/lib/site-settings-public'

export const metadata: Metadata = {
  title: '登入 | 課程平台',
  description: '登入您的帳號以開始學習線上課程',
}

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string
    error?: string
    reset?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error, reset } = await searchParams
  const resetSuccess = reset === 'true'
  const { googleLoginEnabled, appleLoginEnabled } = await getPublicSiteSettings()

  const oauthErrorMessage = (() => {
    switch (error) {
      case 'AccessDenied':
      case 'OAuthAccountNotLinked':
        return '此帳號已使用 Email 啟用，請改用 Email 與密碼登入。'
      case 'ProviderDisabled':
        return '此社群登入目前已停用，請改用其他方式登入。'
      default:
        return undefined
    }
  })()

  return (
    <AuthPageWrapper className="space-y-8">
      {/* 標題區塊 */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-heading">
          會員登入
        </h1>
        <p className="text-base text-body">
          登入您的帳號以開始學習
        </p>
      </div>

      {/* 登入表單 */}
      <LoginForm
        callbackUrl={callbackUrl}
        oauthErrorMessage={oauthErrorMessage}
        resetSuccess={resetSuccess}
        googleEnabled={googleLoginEnabled}
        appleEnabled={appleLoginEnabled}
      />

      {/* 註冊連結 */}
      <div className="text-center text-sm text-body">
        還沒有帳號？{' '}
        <Link
          href={callbackUrl ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/register'}
          className="font-semibold text-cta hover:text-cta-hover transition-colors"
        >
          立即註冊
        </Link>
      </div>
    </AuthPageWrapper>
  )
}
