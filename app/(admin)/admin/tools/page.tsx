import { ToolList } from '@/components/admin/tools/tool-list'
import { getAdminTools, getToolFormOptions, type AdminToolFilters } from '@/lib/actions/admin-tools'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { toolLifecycleEnum, toolTypeEnum } from '@/lib/validations/tool'

export const metadata = { title: 'Tool Management | 後台管理' }

interface ToolsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ToolsPage({ searchParams }: ToolsPageProps) {
  await requireOnlyAdminAuth()
  const params = await searchParams
  const rawType = first(params.type)
  const rawLifecycle = first(params.lifecycle)
  const filters: AdminToolFilters = {
    search: first(params.search),
    seriesId: first(params.seriesId),
    type: toolTypeEnum.safeParse(rawType).success ? rawType as AdminToolFilters['type'] : undefined,
    lifecycle: toolLifecycleEnum.safeParse(rawLifecycle).success
      ? rawLifecycle as AdminToolFilters['lifecycle']
      : undefined,
  }
  const [tools, options] = await Promise.all([getAdminTools(filters), getToolFormOptions()])

  return (
    <div className="space-y-6 p-6">
      <ToolList
        filters={{
          search: filters.search,
          seriesId: filters.seriesId,
          type: filters.type,
          lifecycle: filters.lifecycle,
        }}
        options={options}
        tools={tools}
      />
    </div>
  )
}
