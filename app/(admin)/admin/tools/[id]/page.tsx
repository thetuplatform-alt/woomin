import { notFound } from 'next/navigation'
import { ToolForm } from '@/components/admin/tools/tool-form'
import { getAdminToolById, getToolFormOptions } from '@/lib/actions/admin-tools'
import { requireOnlyAdminAuth } from '@/lib/require-admin'

export const metadata = { title: '編輯 Tool | 後台管理' }

interface EditToolPageProps {
  params: Promise<{ id: string }>
}
export default async function EditToolPage({ params }: EditToolPageProps) {
  await requireOnlyAdminAuth()
  const { id } = await params
  const [tool, options] = await Promise.all([getAdminToolById(id), getToolFormOptions()])
  if (!tool) notFound()

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">編輯 Tool</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理內容、發布狀態、權限、Launch 與排序。</p>
      </div>
      <ToolForm options={options} tool={tool} />
    </div>
  )
}
