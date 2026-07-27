// app/(admin)/admin/settings/terms/page.tsx
// 舊路由 — 重導向到獨立服務條款頁面

import { redirect } from 'next/navigation'

export default function TermsSettingsRedirect() {
  redirect('/admin/terms')
}
