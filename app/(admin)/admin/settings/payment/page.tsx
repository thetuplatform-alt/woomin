// app/(admin)/admin/settings/payment/page.tsx
// 舊路由 — 重導向到新的金流收款頁面

import { redirect } from 'next/navigation'

export default function PaymentSettingsRedirect() {
  redirect('/admin/payments')
}
