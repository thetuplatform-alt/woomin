'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024

function getMediaType(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'IMAGE'
  if (mimeType.startsWith('video/')) return 'VIDEO'
  return 'ATTACHMENT'
}

export function AttachmentUpload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [allowDownload, setAllowDownload] = useState(true)
  const [dynamicWatermarkEnabled, setDynamicWatermarkEnabled] = useState(false)

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error('檔案大小不能超過 50MB')
      event.target.value = ''
      return
    }

    setUploading(true)
    try {
      const targetRes = await fetch(
        `/api/admin/media/upload?filename=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type || 'application/octet-stream')}`
      )
      const target = await targetRes.json()

      if (!target.success) {
        throw new Error(target.error || '取得上傳資訊失敗')
      }

      const uploadRes = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error(`檔案上傳失敗 (HTTP ${uploadRes.status})`)
      }

      const metadataRes = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: target.key,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          type: getMediaType(file.type || 'application/octet-stream'),
          sourceType: 'MANUAL',
          sourceLabel: '文件庫手動上傳',
          sourceUrl: '/admin/media/attachments',
          allowDownload,
          dynamicWatermarkEnabled:
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
              ? dynamicWatermarkEnabled
              : false,
        }),
      })
      const metadata = await metadataRes.json()

      if (!metadata.success) {
        throw new Error(metadata.error || '建立媒體記錄失敗')
      }

      toast.success('檔案已上傳')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '檔案上傳失敗')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
      />
      <div className="flex flex-col gap-2 rounded-lg border border-divider bg-white p-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-body">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={allowDownload}
              onCheckedChange={(checked) => setAllowDownload(checked === true)}
            />
            允許下載
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={dynamicWatermarkEnabled}
              onCheckedChange={(checked) =>
                setDynamicWatermarkEnabled(checked === true)
              }
            />
            PDF 動態學員浮水印
          </label>
        </div>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-cta text-white hover:bg-cta-hover"
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          上傳檔案
        </Button>
      </div>
    </>
  )
}
