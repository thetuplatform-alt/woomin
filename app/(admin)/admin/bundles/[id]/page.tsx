// app/(admin)/admin/bundles/[id]/page.tsx
// 編輯組合包頁面

import { notFound } from 'next/navigation'
import { getBundleById, getCoursesForBundle } from '@/lib/actions/bundles'
import { BundleForm } from '@/components/admin/bundles/bundle-form'

export const metadata = {
  title: '編輯組合包 | 後台管理',
}

interface EditBundlePageProps {
  params: Promise<{ id: string }>
}

export default async function EditBundlePage({ params }: EditBundlePageProps) {
  const { id } = await params
  const [bundle, courses] = await Promise.all([
    getBundleById(id),
    getCoursesForBundle(),
  ])

  if (!bundle) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">編輯組合包</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          調整組合包內容、價格與銷售狀態。
        </p>
      </div>
      <BundleForm bundle={bundle} courses={courses} />
    </div>
  )
}
