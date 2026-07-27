'use client'

// components/main/player/assignment/file-upload-zone.tsx
// 可複用的檔案上傳區域元件

import { useRef, useState, useCallback } from 'react'
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  validateFileExtension,
  BLOCKED_EXTENSIONS,
} from '@/lib/validations/assignment'

export interface UploadedFile {
  id: string
  filename: string
  mimeType: string
  size: number
  url: string
  type: 'IMAGE' | 'FILE'
}

interface FileUploadZoneProps {
  assignmentId: string
  fileType: 'image' | 'file'
  maxCount: number
  maxSize: number
  allowedExtensions?: string[]
  existingFiles: UploadedFile[]
  onFilesChanged: (files: UploadedFile[]) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FileUploadZone({
  assignmentId,
  fileType,
  maxCount,
  maxSize,
  allowedExtensions,
  existingFiles,
  onFilesChanged,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set())

  const isImage = fileType === 'image'
  const canAddMore = existingFiles.length < maxCount

  const validateFile = useCallback(
    (file: File): string | null => {
      // 副檔名驗證
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        return `不允許上傳 .${ext} 格式的檔案`
      }
      const extCheck = validateFileExtension(file.name, allowedExtensions ?? null)
      if (!extCheck.valid) return extCheck.error ?? '不允許的檔案類型'

      // 大小驗證
      if (file.size > maxSize) {
        return `檔案大小超過上限 ${formatBytes(maxSize)}`
      }

      // 數量驗證
      if (existingFiles.length >= maxCount) {
        return `最多只能上傳 ${maxCount} 個${isImage ? '圖片' : '檔案'}`
      }

      return null
    },
    [allowedExtensions, existingFiles.length, maxCount, maxSize, isImage]
  )

  const uploadFile = useCallback(
    async (file: File) => {
      const tempId = `uploading-${Date.now()}-${Math.random()}`
      setUploadingFiles((prev) => new Set(prev).add(tempId))

      try {
        // Step 1: 取得上傳目標
        const params = new URLSearchParams({
          assignmentId,
          filename: file.name,
          mimeType: file.type,
          fileSize: String(file.size),
          fileType,
        })

        const targetRes = await fetch(`/api/assignment/upload?${params}`)
        const targetData = await targetRes.json()

        if (!targetData.success) {
          toast.error(targetData.error ?? '取得上傳資訊失敗')
          return
        }

        const { driver, uploadUrl, key } = targetData

        let attachment: UploadedFile | null = null

        if (driver === 'local') {
          // 本地儲存：POST multipart
          const formData = new FormData()
          formData.append('file', file)
          formData.append('assignmentId', assignmentId)
          formData.append('fileType', fileType)

          const uploadRes = await fetch('/api/assignment/upload', {
            method: 'POST',
            body: formData,
          })
          const uploadData = await uploadRes.json()
          if (!uploadData.success) {
            toast.error(uploadData.error ?? '上傳失敗')
            return
          }
          attachment = {
            id: uploadData.data.id,
            filename: uploadData.data.filename,
            mimeType: uploadData.data.mimeType,
            size: uploadData.data.size,
            url: uploadData.data.url,
            type: uploadData.data.type,
          }
        } else {
          // S3：PUT to presigned URL
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          })
          if (!putRes.ok) {
            toast.error('上傳至雲端儲存失敗')
            return
          }

          // 記錄附件到 DB
          const recordRes = await fetch('/api/assignment/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assignmentId,
              key,
              filename: file.name,
              mimeType: file.type,
              size: file.size,
              fileType,
            }),
          })
          const recordData = await recordRes.json()
          if (!recordData.success) {
            toast.error(recordData.error ?? '記錄附件失敗')
            return
          }
          attachment = {
            id: recordData.data.id,
            filename: recordData.data.filename,
            mimeType: recordData.data.mimeType,
            size: recordData.data.size,
            url: recordData.data.url,
            type: recordData.data.type,
          }
        }

        if (attachment) {
          onFilesChanged([...existingFiles, attachment])
          toast.success(`${file.name} 上傳成功`)
        }
      } catch {
        toast.error('上傳時發生錯誤，請重試')
      } finally {
        setUploadingFiles((prev) => {
          const next = new Set(prev)
          next.delete(tempId)
          return next
        })
      }
    },
    [assignmentId, existingFiles, fileType, onFilesChanged]
  )

  const compressImage = useCallback(
    async (file: File): Promise<File> => {
      if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        return file
      }
      // 小於 2MB 且不需要縮放的直接回傳
      const MAX_SIZE = 2 * 1024 * 1024
      const MAX_DIMENSION = 2000

      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const { width, height } = img
          const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION
          const needsCompress = file.size > MAX_SIZE

          if (!needsResize && !needsCompress) {
            resolve(file)
            return
          }

          let newWidth = width
          let newHeight = height
          if (needsResize) {
            const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
            newWidth = Math.round(width * ratio)
            newHeight = Math.round(height * ratio)
          }

          const canvas = document.createElement('canvas')
          canvas.width = newWidth
          canvas.height = newHeight
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, newWidth, newHeight)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }))
              } else {
                resolve(file)
              }
            },
            'image/jpeg',
            0.85
          )
        }
        img.onerror = () => resolve(file)
        img.src = URL.createObjectURL(file)
      })
    },
    []
  )

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      for (let file of fileArray) {
        const error = validateFile(file)
        if (error) {
          toast.error(`${file.name}：${error}`)
          continue
        }
        // 圖片類型自動壓縮
        if (fileType === 'image') {
          file = await compressImage(file)
        }
        await uploadFile(file)
      }
    },
    [validateFile, uploadFile, compressImage, fileType]
  )

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      setDeletingFiles((prev) => new Set(prev).add(attachmentId))
      try {
        const res = await fetch('/api/assignment/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attachmentId }),
        })
        const data = await res.json()
        if (!data.success) {
          toast.error(data.error ?? '刪除失敗')
          return
        }
        onFilesChanged(existingFiles.filter((f) => f.id !== attachmentId))
        toast.success('已刪除')
      } catch {
        toast.error('刪除時發生錯誤')
      } finally {
        setDeletingFiles((prev) => {
          const next = new Set(prev)
          next.delete(attachmentId)
          return next
        })
      }
    },
    [existingFiles, onFilesChanged]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (!canAddMore) {
        toast.error(`最多只能上傳 ${maxCount} 個${isImage ? '圖片' : '檔案'}`)
        return
      }
      handleFiles(e.dataTransfer.files)
    },
    [canAddMore, handleFiles, isImage, maxCount]
  )

  const isUploading = uploadingFiles.size > 0

  return (
    <div className="space-y-3">
      {/* 上傳區域 */}
      {canAddMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && inputRef.current?.click()}
          className={[
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/60 hover:bg-muted/50',
            isUploading ? 'opacity-60 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
          <div className="text-center text-sm text-muted-foreground">
            {isUploading ? (
              <span>上傳中，請稍候...</span>
            ) : (
              <>
                <span className="font-medium text-foreground">點擊上傳</span>
                {' 或拖曳檔案到這裡'}
                <br />
                <span className="text-xs">
                  上限 {formatBytes(maxSize)}，最多 {maxCount} 個
                  {isImage ? '圖片' : '檔案'}
                  {allowedExtensions && allowedExtensions.length > 0 && (
                    <>（允許：{allowedExtensions.join(', ')}）</>
                  )}
                </span>
              </>
            )}
          </div>
          {isImage && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              建議上傳前先壓縮圖片（長邊 ≤ 2000px、≤ 2MB）
            </p>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={
          isImage
            ? 'image/*'
            : allowedExtensions
              ? allowedExtensions.map((e) => `.${e}`).join(',')
              : undefined
        }
        multiple={maxCount > 1}
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(e.target.files)
            e.target.value = ''
          }
        }}
      />

      {/* 已上傳檔案列表 */}
      {existingFiles.length > 0 && (
        <div className={isImage ? 'grid grid-cols-3 gap-2 sm:grid-cols-4' : 'space-y-2'}>
          {existingFiles.map((file) => (
            isImage ? (
              <div key={file.id} className="relative group rounded-md overflow-hidden border border-border aspect-square bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.url}
                  alt={file.filename}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingFiles.has(file.id)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                  aria-label="刪除圖片"
                >
                  {deletingFiles.has(file.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1 py-0.5 text-[10px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.filename}
                </div>
              </div>
            ) : (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{file.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingFiles.has(file.id)}
                  aria-label="刪除檔案"
                >
                  {deletingFiles.has(file.id) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )
          ))}
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs text-muted-foreground text-center">
          已達上傳數量上限（{maxCount} 個{isImage ? '圖片' : '檔案'}）
        </p>
      )}

      {/* 說明圖示 */}
      {existingFiles.length === 0 && !canAddMore && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          <span className="text-sm">尚未上傳任何{isImage ? '圖片' : '檔案'}</span>
        </div>
      )}
    </div>
  )
}
