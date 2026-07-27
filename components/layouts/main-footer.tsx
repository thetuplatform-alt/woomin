// components/layouts/main-footer.tsx
// 前台網站 Footer 元件
// 極簡黑白灰設計，支援後台動態設定

import Link from 'next/link'
import { icons } from 'lucide-react'
import { Logo } from '@/components/shared/logo'
import { getPublicSiteSettings } from '@/lib/site-settings-public'
import type { FooterSection } from '@/lib/site-settings-public-types'

function getIcon(iconName?: string): React.ReactNode | null {
  if (!iconName) return null
  // 支援 Lucide icon 名稱（PascalCase，如 "Facebook"、"Instagram"）
  const Icon = icons[iconName as keyof typeof icons]
  if (!Icon) return null
  return <Icon className="h-4 w-4" aria-hidden="true" />
}

// 預設的法律連結區塊
const DEFAULT_LEGAL_SECTION: FooterSection = {
  title: '法律資訊',
  links: [
    { label: '用戶條款', url: '/terms' },
    { label: '隱私權政策', url: '/privacy' },
  ],
}

export async function MainFooter() {
  const currentYear = new Date().getFullYear()
  const {
    siteName,
    siteLogo,
    brandDisplayName,
    brandSubtitle,
    footerDescription,
    footerSections,
  } = await getPublicSiteSettings()

  // 如果沒有設定任何 footer section，使用預設的法律連結
  const sections = footerSections.length > 0 ? footerSections : [DEFAULT_LEGAL_SECTION]

  return (
    <footer data-main-footer="true" className="border-t border-divider bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Logo 和品牌介紹 */}
          <div className="space-y-4">
            <Logo
              siteLogo={siteLogo}
              brandDisplayName={brandDisplayName}
              brandSubtitle={brandSubtitle}
            />
            {footerDescription && (
              <p className="max-w-xs text-sm text-body">
                {footerDescription}
              </p>
            )}
          </div>

          {/* 右側區塊 */}
          <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-4">
                <h3 className="text-sm font-semibold text-heading">
                  {section.title}
                </h3>
                <nav className="flex flex-col space-y-3">
                  {section.links.map((link, linkIndex) => {
                    const icon = getIcon(link.icon)
                    const isInternal = link.url.startsWith('/')

                    if (isInternal) {
                      return (
                        <Link
                          key={linkIndex}
                          href={link.url}
                          className="flex items-center gap-2 text-sm text-body transition-colors hover:text-heading"
                        >
                          {icon}
                          {link.label}
                        </Link>
                      )
                    }

                    return (
                      <a
                        key={linkIndex}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-body transition-colors hover:text-heading"
                      >
                        {icon}
                        {link.label}
                      </a>
                    )
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* 版權聲明 */}
        <div className="mt-12 border-t border-divider pb-20 pt-8 lg:pb-0">
          <p className="text-center text-sm text-caption">
            &copy; {currentYear} {siteName}. 保留所有權利。
          </p>
        </div>
      </div>
    </footer>
  )
}
