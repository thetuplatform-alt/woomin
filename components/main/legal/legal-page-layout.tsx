// components/main/legal/legal-page-layout.tsx
// 法律頁面共用 Layout
// 統一的標題、最後更新日期、內容區域樣式

import { ReactNode } from 'react'

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header 區域 */}
      <div className="border-b border-white/10 bg-[#1C1C1E]">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm text-[#EBEBF5]/60">
            最後更新日期：{lastUpdated}
          </p>
        </div>
      </div>

      {/* 內容區域 */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-[#EBEBF5]/80 prose-p:leading-relaxed prose-li:text-[#EBEBF5]/80 prose-li:marker:text-[#007AFF] prose-strong:text-white prose-a:text-[#007AFF] prose-a:no-underline hover:prose-a:underline">
          {children}
        </article>
      </div>
    </div>
  )
}
