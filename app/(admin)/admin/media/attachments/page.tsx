import Link from 'next/link'
import { getMediaList } from '@/lib/actions/media'
import { Button } from '@/components/ui/button'
import { AttachmentsClient } from './attachments-client'
import { AttachmentUpload } from '@/components/admin/media/attachment-upload'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '文件庫',
}

export default async function MediaAttachmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Number(params?.page ?? '1') || 1
  const result = await getMediaList({
    type: 'ATTACHMENT',
    page,
    pageSize: 20,
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 rounded-lg">
            <Link href="/admin/media">
              <ArrowLeft className="mr-2 h-4 w-4" />
              回媒體中心
            </Link>
          </Button>
          <h2 className="text-xl font-bold text-heading">文件庫</h2>
          <p className="mt-1 text-body">
            管理 PDF、作業附件與其他文件，並追蹤每個檔案的來源。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-caption">
            共 {result.total} 個文件
          </div>
          <AttachmentUpload />
        </div>
      </div>

      <AttachmentsClient media={result.media} />

      {result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={page <= 1}
            className="rounded-lg"
          >
            <Link href={`/admin/media/attachments?page=${Math.max(1, page - 1)}`}>
              上一頁
            </Link>
          </Button>
          <span className="text-sm text-caption">
            {page} / {result.totalPages}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={page >= result.totalPages}
            className="rounded-lg"
          >
            <Link
              href={`/admin/media/attachments?page=${Math.min(
                result.totalPages,
                page + 1
              )}`}
            >
              下一頁
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
