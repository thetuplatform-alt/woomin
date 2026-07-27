// app/(admin)/admin/settings/privacy/page.tsx
// 舊路由 — 重導向到獨立隱私權政策頁面

import { redirect } from 'next/navigation'

export default function PrivacySettingsRedirect() {
  redirect('/admin/privacy')
}
