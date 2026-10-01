// app/(auth)/layout.tsx
// 認證頁面佈局
// 簡單的置中佈局，用於登入和註冊頁面

import Link from 'next/link'
import { BestAppStoreBrand } from '@/components/shared/bestappstore-brand'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Link href="/" aria-label="BestAppStore home">
            <BestAppStoreBrand />
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}
