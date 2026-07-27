// app/layout.tsx
// 根佈局
// 設定全域 metadata 和樣式

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import { Toaster } from '@/components/ui/sonner'
import { getPublicSiteSettings } from '@/lib/site-settings-public'
import { getAnalyticsSettings } from '@/lib/analytics-settings'
import { resolveAppUrl } from '@/lib/app-url'
import { resolveSiteIconPath } from '@/lib/site-brand-assets'
import { PostHogInitializer } from '@/components/common/posthog-initializer'
import '@blocknote/core/fonts/inter.css'
import '@mantine/core/styles.css'
import '@blocknote/mantine/style.css'
import './globals.css'

// Meta Pixel ID 現在從 getAnalyticsSettings() 讀取（DB 優先，env fallback）

// 載入字體
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// 網站 metadata
export async function generateMetadata(): Promise<Metadata> {
  const appUrl = await resolveAppUrl()
  const {
    siteName,
    siteLogo,
    shareTitle,
    shareDescription,
    shareLogo,
    shareImage,
  } = await getPublicSiteSettings()
  const title = shareTitle || siteName || '線上課程平台'
  const description = shareDescription || '一個可自訂品牌與課程內容的線上課程平台。'
  const siteIcon = resolveSiteIconPath(siteLogo, appUrl)
  const image = shareImage || shareLogo || siteIcon || ''

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: siteName || '線上課程平台',
      template: `%s | ${siteName || '線上課程平台'}`,
    },
    description,
    keywords: ['線上課程', '課程平台', '教學平台'],
    authors: [{ name: siteName || 'WooMin' }],
    creator: siteName || 'WooMin',
    openGraph: {
      type: 'website',
      locale: 'zh_TW',
      url: appUrl,
      siteName: siteName || '線上課程平台',
      title,
      description,
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
    icons: {
      icon: siteIcon,
      shortcut: siteIcon,
      apple: siteIcon,
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: appUrl,
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const analytics = await getAnalyticsSettings()

  return (
    <html lang="zh-TW">
      <head>
        {analytics.metaPixelId && (
          <>
            <Script
              id="meta-pixel-sdk"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  !function(f,b,e,v,n,t,s)
                  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                  n.queue=[];t=b.createElement(e);t.async=!0;
                  t.src=v;s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s)}(window, document,'script',
                  'https://connect.facebook.net/en_US/fbevents.js');
                `,
              }}
            />
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${analytics.metaPixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
        {/* Google Analytics 4 */}
        {analytics.gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${analytics.gaId}`}
              strategy="afterInteractive"
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${analytics.gaId}');
                `,
              }}
            />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* PostHog 動態初始化（從資料庫設定） */}
        {analytics.posthogKey && (
          <PostHogInitializer
            apiKey={analytics.posthogKey}
            apiHost={analytics.posthogHost}
          />
        )}
        {children}
        <Toaster />
      </body>
    </html>
  )
}
