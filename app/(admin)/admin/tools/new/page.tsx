import { ToolForm } from '@/components/admin/tools/tool-form'
import { getToolFormOptions } from '@/lib/actions/admin-tools'
import { requireOnlyAdminAuth } from '@/lib/require-admin'

export const metadata = { title: '新增 Tool | 後台管理' }

export default async function NewToolPage() {
  await requireOnlyAdminAuth()
  const options = await getToolFormOptions()

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">新增 Tool</h1>
        <p className="mt-1 text-sm text-muted-foreground">新增後預設可保持草稿；發布前會在 server 端重新驗證權限與 Launch 設定。</p>
      </div>
      <ToolForm options={options} />
    </div>
  )
}
