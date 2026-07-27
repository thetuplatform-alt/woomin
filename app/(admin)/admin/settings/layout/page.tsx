// app/(admin)/admin/settings/layout/page.tsx
// 舊路由 — 重導向到主設定頁面

import { redirect } from 'next/navigation'

export default function LayoutSettingsRedirect() {
  redirect('/admin/settings')
}
