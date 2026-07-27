// app/(admin)/admin/privacy/page.tsx
// 隱私權政策獨立編輯頁面

import { getLegalSettings, getSiteSettings } from '@/lib/actions/settings'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { PrivacyEditorClient } from '../settings/privacy/client'

export const metadata = {
  title: '隱私權政策 | 後台管理',
}

export default async function PrivacyPage() {
  await requireOnlyAdminAuth()
  const [legal, siteSettings] = await Promise.all([
    getLegalSettings(),
    getSiteSettings(),
  ])

  const defaultSiteName = siteSettings[SETTING_KEYS.SITE_NAME] || ''
  const defaultContactEmail = siteSettings[SETTING_KEYS.CONTACT_EMAIL] || ''

  return (
    <div className="space-y-6 p-6">
      <div data-tour="privacy-header">
        <h1 className="text-xl font-bold text-heading">隱私權政策</h1>
        <p className="text-body mt-1">
          編輯隱私權政策內容，使用 Markdown 語法。儲存後將顯示在 /privacy 頁面。
        </p>
      </div>

      <PrivacyEditorClient
        initialContent={legal.privacyMd}
        defaultSiteName={defaultSiteName}
        defaultContactEmail={defaultContactEmail}
      />
    </div>
  )
}
