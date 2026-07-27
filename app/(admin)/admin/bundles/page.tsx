// app/(admin)/admin/bundles/page.tsx
// 組合包列表頁

import { getBundles } from '@/lib/actions/bundles'
import { BundleList } from '@/components/admin/bundles/bundle-list'
import { requireOnlyAdminAuth } from '@/lib/require-admin'

export const metadata = {
  title: '組合包管理 | 後台管理',
}

export default async function BundlesPage() {
  await requireOnlyAdminAuth()
  const bundles = await getBundles()

  return (
    <div className="space-y-6 p-6">
      <BundleList bundles={bundles} />
    </div>
  )
}
