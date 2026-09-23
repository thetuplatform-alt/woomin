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
  siteName: 'BestAppStore',
  siteLogo: DEFAULT_SITE_ICON_PATH,
  shareTitle: '',
  shareDescription: '整合數位應用、專業服務與精選內容的多系列會員服務平台。',
  shareLogo: '',
  shareImage: '',
  contactEmail: 'service@bestappstore.co.uk',
  brandDisplayName: 'BestAppStore',
  brandSubtitle: 'Member Services',
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
