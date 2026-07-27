import { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/forms/reset-password-form'
import { AuthPageWrapper } from '@/components/auth/auth-page-wrapper'

export const metadata: Metadata = {
  title: '重設密碼 | 課程平台',
  description: '設定您的新密碼',
}

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams

  return (
    <AuthPageWrapper className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-heading">
          重設密碼
        </h1>
        <p className="text-base text-body">
          設定新密碼後即可使用 Email 登入
        </p>
      </div>

      <div className="rounded-2xl border border-divider bg-white p-8 shadow-none">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface p-4 text-sm text-body">
              重設連結無效。請從信箱中的連結重新進入，或重新申請密碼重設。
            </div>
            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-cta hover:text-cta-hover transition-colors"
              >
                重新申請密碼重設
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthPageWrapper>
  )
}
