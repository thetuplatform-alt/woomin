import { DEFAULT_SITE_ICON_PATH } from '@/lib/site-brand-assets'

export interface NavLink {
  label: string
  url: string
  openInNewTab: boolean
}

export interface FooterLink {
  label: string
  url: string
  icon?: string
}

export interface FooterSection {
  title: string
  links: FooterLink[]
}

export interface PublicSiteSettings {
  siteName: string
  siteLogo: string
  shareTitle: string
  shareDescription: string
  shareLogo: string
  shareImage: string
  contactEmail: string
  brandDisplayName: string
  brandSubtitle: string
  googleLoginEnabled: boolean
  appleLoginEnabled: boolean
  headerLeftLinks: NavLink[]
  headerRightLinks: NavLink[]
  footerDescription: string
  footerSections: FooterSection[]
}

export const PUBLIC_SITE_DEFAULTS: PublicSiteSettings = {
  siteName: 'WooMin',
  siteLogo: DEFAULT_SITE_ICON_PATH,
  shareTitle: '',
  shareDescription: '一個可自訂品牌與課程內容的線上課程平台。',
  shareLogo: '',
  shareImage: '',
  contactEmail: 'support@example.com',
  brandDisplayName: 'WooMin',
  brandSubtitle: 'Learning System',
  googleLoginEnabled: false,
  appleLoginEnabled: false,
  headerLeftLinks: [],
  headerRightLinks: [],
  footerDescription: '',
  footerSections: [
    {
      title: '法律資訊',
      links: [
        { label: '服務條款', url: '/terms' },
        { label: '隱私權政策', url: '/privacy' },
      ],
    },
  ],
}
