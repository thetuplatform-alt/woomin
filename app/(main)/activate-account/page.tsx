import type { Metadata } from 'next'
import Link from 'next/link'
import { ActivateAccountClient } from './activate-account-client'

export const metadata: Metadata = {
  title: '啟用帳號 | 課程平台',
  description: '設定密碼並啟用您的課程帳號',
}

interface ActivateAccountPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function ActivateAccountPage({ searchParams }: ActivateAccountPageProps) {
  const { token } = await searchParams

  return (
    <div className="min-h-screen bg-white py-12 sm:py-24">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-2xl border border-divider bg-white p-8 sm:p-10">
          <h1 className="text-2xl font-bold text-heading">啟用您的帳號</h1>
          <p className="mt-3 text-sm leading-relaxed text-body">
            設定密碼後即可使用 Email 登入並開始學習。
          </p>

          {token ? (
            <ActivateAccountClient token={token} />
          ) : (
            <div className="mt-6 rounded-xl bg-surface p-4 text-sm text-body">
              啟用連結無效。請回到付款成功頁或使用信箱中的啟用連結。
            </div>
          )}

          <div className="mt-8 text-center text-sm text-caption">
            <Link href="/" className="hover:text-body">返回首頁</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
