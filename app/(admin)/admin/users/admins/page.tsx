// app/(admin)/admin/users/admins/page.tsx
// 舊「管理員設定」頁已整併為「講師管理」（/admin/instructors），此處永久轉址保留舊連結相容
import { redirect } from 'next/navigation'

export default function LegacyAdminsPage() {
  redirect('/admin/instructors')
}
