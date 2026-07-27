// components/admin/media/image-upload.tsx
// 圖片上傳元件
// 上傳到 Cloudflare R2

'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  onUploadComplete?: (media: {
    id: string
    url: string
    originalName: string
  }) => void
  onError?: (error: string) => void
  multiple?: boolean
  maxSize?: number // in MB
  className?: string
}

interface UploadingFile {
  id: string
  file: File
  preview: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
  mediaId?: string
  url?: string
}

export function ImageUpload({
  onUploadComplete,
  onError,
  multiple = true,
  maxSize = 10, // 10MB default
  className,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 處理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    )

    if (files.length > 0) {
      handleUpload(multiple ? files : [files[0]])
    }
  }

  // 處理檔案選擇
  const handleFileSelect =
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      if (files.length > 0) {
        handleUpload(files)
      }
      // 清空 input 以便再次選擇相同檔案
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }

  // 上傳單一檔案（presigned URL 方式：前端直傳 S3/R2）
  const uploadSingleFile = async (file: File, uploadId: string) => {
    try {
      // Step 1: 取得 presigned URL 和 key
      const presignRes = await fetch(
        `/api/admin/media/upload?filename=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type)}`
      )
      const presignData = await presignRes.json()

      if (!presignData.success) {
        throw new Error(presignData.error || '取得上傳 URL 失敗')
      }

      // Step 2: 使用 presigned URL 直傳到 S3/R2
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error(`上傳失敗 (HTTP ${uploadRes.status})`)
      }

      // Step 3: 回報 metadata 建立 Media 記錄
      const metadataRes = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: presignData.key,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          type: 'IMAGE',
        }),
      })

      const data = await metadataRes.json()

      if (!data.success) {
        throw new Error(data.error || '建立媒體記錄失敗')
      }

      setUploadingFiles((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? {
                ...item,
                status: 'completed',
                progress: 100,
                mediaId: data.media.id,
                url: data.url,
              }
            : item
        )
      )

      onUploadComplete?.({
        id: data.media.id,
        url: data.url,
        originalName: file.name,
      })
    } catch (error) {
      console.error('上傳失敗:', error)
      setUploadingFiles((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? {
                ...item,
                status: 'error',
                error: error instanceof Error ? error.message : '上傳失敗',
              }
            : item
        )
      )
      onError?.(error instanceof Error ? error.message : '上傳失敗')
    }
  }

  // 上傳檔案（先全部顯示在列表，再限制並發數上傳）
  const handleUpload = (files: File[]) => {
    // 先過濾超過大小限制的檔案
    const validFiles: { file: File; uploadId: string; preview: string }[] = []

    for (const file of files) {
      if (file.size > maxSize * 1024 * 1024) {
        onError?.(`檔案 ${file.name} 超過 ${maxSize}MB 限制`)
        continue
      }
      validFiles.push({
        file,
        uploadId: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        preview: URL.createObjectURL(file),
      })
    }

    if (validFiles.length === 0) return

    // 一次把所有檔案加入列表
    setUploadingFiles((prev) => [
      ...prev,
      ...validFiles.map(({ file, uploadId, preview }) => ({
        id: uploadId,
        file,
        preview,
        progress: 0,
        status: 'uploading' as const,
      })),
    ])

    // 最多同時上傳 3 個
    const MAX_CONCURRENT = 3
    let running = 0
    let index = 0

    const runNext = () => {
      while (running < MAX_CONCURRENT && index < validFiles.length) {
        const { file, uploadId } = validFiles[index]
        index++
        running++
        uploadSingleFile(file, uploadId).finally(() => {
          running--
          runNext()
        })
      }
    }

    runNext()
  }

  // 移除上傳項目
  const removeUploadItem = (uploadId: string) => {
    setUploadingFiles((prev) => {
      const item = prev.find((i) => i.id === uploadId)
      if (item?.preview) {
        URL.revokeObjectURL(item.preview)
      }
      return prev.filter((i) => i.id !== uploadId)
    })
  }

  // 格式化檔案大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 拖放區域 */}
      <Card
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer rounded-xl',
          isDragging
            ? 'border-cta bg-cta/10'
            : 'border-divider bg-white hover:border-cta'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-caption" />
          </div>
          <p className="text-heading font-medium mb-2">
            拖放圖片檔案到這裡上傳
          </p>
          <p className="text-caption text-sm mb-4">
            支援 JPG、PNG、GIF、WebP 等格式，單檔最大 {maxSize}MB
          </p>
          <Button variant="outline" size="sm" className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg">
            選擇圖片
          </Button>
        </div>
      </Card>

      {/* 隱藏的檔案輸入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 上傳列表 */}
      {uploadingFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {uploadingFiles.map((item) => (
            <Card
              key={item.id}
              className="relative overflow-hidden bg-white border-divider rounded-xl"
            >
              {/* 預覽圖 */}
              <div className="aspect-square relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className="object-cover"
                />

                {/* 上傳中遮罩 */}
                {item.status === 'uploading' && (
                  <div className="absolute inset-0 bg-heading/60 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-cta animate-spin mx-auto mb-2" />
                      <p className="text-white text-sm">上傳中...</p>
                    </div>
                  </div>
                )}

                {/* 完成狀態 */}
                {item.status === 'completed' && (
                  <div className="absolute top-2 right-2">
                    <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                {/* 錯誤狀態 */}
                {item.status === 'error' && (
                  <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
                    <div className="text-center p-2">
                      <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                      <p className="text-red-600 text-xs">{item.error}</p>
                    </div>
                  </div>
                )}

                {/* 移除按鈕 */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-2 left-2 bg-heading/50 hover:bg-heading/70"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeUploadItem(item.id)
                  }}
                >
                  <X className="w-4 h-4 text-white" />
                </Button>
              </div>

              {/* 資訊 */}
              <div className="p-3">
                <p className="text-heading text-sm truncate">{item.file.name}</p>
                <p className="text-caption text-xs">
                  {formatFileSize(item.file.size)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
