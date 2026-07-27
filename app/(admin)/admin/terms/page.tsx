// app/(admin)/admin/terms/page.tsx
// 服務條款獨立編輯頁面

import { getLegalSettings, getSiteSettings } from '@/lib/actions/settings'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { TermsEditorClient } from '../settings/terms/client'

export const metadata = {
  title: '服務條款 | 後台管理',
}

export default async function TermsPage() {
  await requireOnlyAdminAuth()
  const [legal, siteSettings] = await Promise.all([
    getLegalSettings(),
    getSiteSettings(),
  ])

  const defaultSiteName = siteSettings[SETTING_KEYS.SITE_NAME] || ''
  const defaultContactEmail = siteSettings[SETTING_KEYS.CONTACT_EMAIL] || ''

  return (
    <div className="space-y-6 p-6">
      <div data-tour="terms-header">
        <h1 className="text-xl font-bold text-heading">服務條款</h1>
        <p className="text-body mt-1">
          編輯服務條款內容，使用 Markdown 語法。儲存後將顯示在 /terms 頁面。
        </p>
      </div>

      <TermsEditorClient
        initialContent={legal.termsMd}
        defaultSiteName={defaultSiteName}
        defaultContactEmail={defaultContactEmail}
      />
    </div>
  )
}
