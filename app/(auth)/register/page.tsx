// app/(auth)/register/page.tsx
// 註冊頁面
// 使用電子郵件和密碼註冊新帳號

import { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/components/forms/register-form'
import { AuthPageWrapper } from '@/components/auth/auth-page-wrapper'

export const metadata: Metadata = {
  title: '註冊 | 課程平台',
  description: '建立新帳號開始學習線上課程',
}

interface RegisterPageProps {
  searchParams: Promise<{
    callbackUrl?: string
  }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { callbackUrl } = await searchParams

  return (
    <AuthPageWrapper className="space-y-8">
      {/* 標題區塊 */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-heading">
          建立新帳號
        </h1>
        <p className="text-base text-body">
          註冊以開始您的學習之旅
        </p>
      </div>

      {/* 註冊表單 */}
      <RegisterForm callbackUrl={callbackUrl} />

      {/* 登入連結 */}
      <div className="text-center text-sm text-body">
        已經有帳號？{' '}
        <Link
          href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login'}
          className="font-semibold text-cta hover:text-cta-hover transition-colors"
        >
          立即登入
        </Link>
      </div>
    </AuthPageWrapper>
  )
}
