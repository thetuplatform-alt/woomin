// components/admin/bundles/bundle-list.tsx
// 組合包列表

'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Archive, Copy, ExternalLink, Package, Pencil, Plus } from 'lucide-react'
import { archiveBundle, type BundleListItem } from '@/lib/actions/bundles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface BundleListProps {
  bundles: BundleListItem[]
}

const statusConfig = {
  DRAFT: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  PUBLISHED: { label: '已發佈', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ARCHIVED: { label: '已停用', className: 'bg-amber-50 text-amber-700 border-amber-200' },
} as const

function formatPrice(price: number): string {
  return price === 0 ? '免費' : `NT$ ${price.toLocaleString('zh-TW')}`
}

export function BundleList({ bundles }: BundleListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleCopy(slug: string) {
    const url = `${window.location.origin}/bundles/${slug}`
    await navigator.clipboard.writeText(url)
    toast.success('組合包連結已複製')
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archiveBundle(id)
      if (!result.success) {
        toast.error(result.error || '停用失敗')
        return
      }
      toast.success('組合包已停用')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">組合包管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            建立多門課程的獨立銷售頁與一次性購買入口。
          </p>
        </div>
        <Button data-tour="bundles-new-btn" asChild>
          <Link href="/admin/bundles/new">
            <Plus className="mr-2 h-4 w-4" />
            新增組合包
          </Link>
        </Button>
      </div>

      {bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border p-12 text-center">
          <Package className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">尚未建立組合包</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            建立第一個組合包後，即可把多門課程綁定成一個可購買商品。
          </p>
        </div>
      ) : (
        <div data-tour="bundles-table" className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名稱</TableHead>
                <TableHead data-tour="bundles-status-column">狀態</TableHead>
                <TableHead>課程數</TableHead>
                <TableHead className="text-right">價格</TableHead>
                <TableHead>更新時間</TableHead>
                <TableHead data-tour="bundles-actions-column" className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((bundle) => {
                const status = statusConfig[bundle.status]
                return (
                  <TableRow key={bundle.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{bundle.title}</p>
                        <p className="text-xs text-muted-foreground">/bundles/{bundle.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{bundle._count.courses}</TableCell>
                    <TableCell className="text-right">
                      {bundle.salePrice != null ? (
                        <div>
                          <p className="font-semibold text-foreground">
                            {formatPrice(bundle.salePrice)}
                          </p>
                          <p className="text-xs text-muted-foreground line-through">
                            {formatPrice(bundle.price)}
                          </p>
                        </div>
                      ) : (
                        <span className="font-semibold text-foreground">
                          {formatPrice(bundle.price)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(bundle.updatedAt).toLocaleDateString('zh-TW')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/bundles/${bundle.slug}`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(bundle.slug)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/bundles/${bundle.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        {bundle.status !== 'ARCHIVED' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            onClick={() => handleArchive(bundle.id)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
