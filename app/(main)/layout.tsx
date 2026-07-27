// app/(main)/layout.tsx
// 前台頁面佈局
// 包含 Header、Footer 和 Session Provider

import { SessionProvider } from '@/components/providers/session-provider'
import { PostHogIdentify } from '@/components/common/posthog-identify'
import { MetaPixelInit } from '@/components/common/meta-pixel-events'
import { MainHeader } from '@/components/layouts/main-header'
import { MainFooter } from '@/components/layouts/main-footer'
import { getAnalyticsSettings } from '@/lib/analytics-settings'
import { getPublicSiteSettings } from '@/lib/site-settings-public'

interface MainLayoutProps {
  children: React.ReactNode
}

export default async function MainLayout({ children }: MainLayoutProps) {
  const [analytics, siteSettings] = await Promise.all([
    getAnalyticsSettings(),
    getPublicSiteSettings(),
  ])

  return (
    <SessionProvider>
      <PostHogIdentify />
      {analytics.metaPixelId && <MetaPixelInit pixelId={analytics.metaPixelId} />}
      <div className="flex min-h-screen flex-col bg-background">
        {/* 頂部導覽列 */}
        <MainHeader
          siteName={siteSettings.siteName}
          siteLogo={siteSettings.siteLogo}
          brandDisplayName={siteSettings.brandDisplayName}
          brandSubtitle={siteSettings.brandSubtitle}
          headerLeftLinks={siteSettings.headerLeftLinks}
          headerRightLinks={siteSettings.headerRightLinks}
        />

        {/* 主要內容區域 */}
        <main className="flex-1">{children}</main>

        {/* 頁尾 */}
        <MainFooter />
      </div>
    </SessionProvider>
  )
}
