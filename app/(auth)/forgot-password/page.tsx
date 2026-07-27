import { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/forms/forgot-password-form'
import { AuthPageWrapper } from '@/components/auth/auth-page-wrapper'

export const metadata: Metadata = {
  title: '忘記密碼 | 課程平台',
  description: '重設您的密碼',
}

export default function ForgotPasswordPage() {
  return (
    <AuthPageWrapper className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-heading">
          忘記密碼
        </h1>
        <p className="text-base text-body">
          我們將協助您重設密碼
        </p>
      </div>

      <ForgotPasswordForm />
    </AuthPageWrapper>
  )
}
