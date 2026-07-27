// app/(admin)/admin/bundles/new/page.tsx
// 新增組合包頁面

import { getCoursesForBundle } from '@/lib/actions/bundles'
import { BundleForm } from '@/components/admin/bundles/bundle-form'

export const metadata = {
  title: '新增組合包 | 後台管理',
}

export default async function NewBundlePage() {
  const courses = await getCoursesForBundle()

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">新增組合包</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          選擇多門課程並設定獨立價格，建立可單獨分享的組合包銷售頁。
        </p>
      </div>
      <BundleForm courses={courses} />
    </div>
  )
}
