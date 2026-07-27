// app/(admin)/admin/settings/email/page.tsx
// 舊路由 — 重導向到主設定頁面

import { redirect } from 'next/navigation'

export default function EmailSettingsRedirect() {
  redirect('/admin/settings')
}
