'use client'

import type { Media } from '@prisma/client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { updatePdfSecuritySettings } from '@/lib/actions/media'
import { Download, ExternalLink, FileText, ShieldCheck } from 'lucide-react'

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const sourceLabels: Record<string, string> = {
  MANUAL: '手動上傳',
  LESSON_CONTENT: '講義內容',
  ASSIGNMENT: '作業上傳',
  COMMENT: '留言附件',
  PRIVATE_MESSAGE: '私訊附件',
  CLOUDFLARE_SYNC: 'Cloudflare 同步',
}

function confirmDownload(event: React.MouseEvent<HTMLAnchorElement>) {
  const ok = window.confirm(
    '下載前請確認檔案來源可信。學生上傳或外部來源的檔案可能含有病毒，請使用防毒軟體掃描後再開啟。'
  )
  if (!ok) {
    event.preventDefault()
  }
}

export function AttachmentsClient({ media }: { media: Media[] }) {
  const [items, setItems] = useState(media)
  const [isPending, startTransition] = useTransition()

  function handlePdfSettingChange(
    id: string,
    field: 'allowDownload' | 'dynamicWatermarkEnabled',
    value: boolean
  ) {
    const previous = items
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )

    startTransition(async () => {
      const result = await updatePdfSecuritySettings(id, { [field]: value })
      if (!result.success || !result.media) {
        setItems(previous)
        toast.error(result.error || '更新 PDF 安全設定失敗')
        return
      }

      setItems((current) =>
        current.map((item) => (item.id === id ? result.media! : item))
      )
      toast.success('PDF 安全設定已更新')
    })
  }

  if (media.length === 0) {
    return (
      <Card className="rounded-xl border-divider">
        <CardContent className="py-14 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-caption" />
          <p className="text-body">目前還沒有附件或文件</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isPdf = item.mimeType === 'application/pdf'
        const protectedPdfUrl = `/api/lesson/pdf?mediaId=${encodeURIComponent(item.id)}`
        const downloadUrl = isPdf && item.sourceId ? `${protectedPdfUrl}&download=1` : item.url

        return (
          <Card key={item.id} className="rounded-xl border-divider">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface">
                <FileText className="h-5 w-5 text-cta" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-heading">
                  {item.originalName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-caption">
                  <span>{item.mimeType}</span>
                  <span>{formatFileSize(item.size)}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString('zh-TW')}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-body">
                    {sourceLabels[item.sourceType] ?? item.sourceType}
                  </span>
                  {item.sourceLabel && (
                    <span className="truncate text-xs text-body">
                      {item.sourceLabel}
                    </span>
                  )}
                  {isPdf && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-body">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {item.allowDownload ? '可下載' : '僅線上閱讀'}
                      {item.dynamicWatermarkEnabled ? ' · 動態浮水印' : ''}
                    </span>
                  )}
                </div>
                {isPdf && (
                  <div className="mt-3 grid gap-2 text-xs text-body sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-divider px-3 py-2">
                      <span>允許下載/新分頁</span>
                      <Switch
                        checked={item.allowDownload}
                        disabled={isPending}
                        onCheckedChange={(checked) =>
                          handlePdfSettingChange(item.id, 'allowDownload', checked)
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-divider px-3 py-2">
                      <span>動態學員浮水印</span>
                      <Switch
                        checked={item.dynamicWatermarkEnabled}
                        disabled={isPending}
                        onCheckedChange={(checked) =>
                          handlePdfSettingChange(
                            item.id,
                            'dynamicWatermarkEnabled',
                            checked
                          )
                        }
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {item.sourceUrl && (
                  <Button asChild variant="outline" size="sm" className="rounded-lg">
                    <Link href={item.sourceUrl}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      來源
                    </Link>
                  </Button>
                )}
                {(!isPdf || item.allowDownload) && (
                  <Button asChild size="sm" className="rounded-lg bg-cta text-white hover:bg-cta-hover">
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={confirmDownload}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      下載
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
