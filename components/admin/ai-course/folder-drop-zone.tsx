// components/admin/ai-course/folder-drop-zone.tsx
// 資料夾拖放區域元件
// 支援嚴格三層結構：root → 章節 → 單元

'use client'

import { useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderOpen, Upload, AlertCircle, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseFileList, type ParsedChapter } from '@/lib/utils/folder-parser'

// 需要過濾的檔案/資料夾名稱
const IGNORED_PATTERNS = [
  /^\./, // 隱藏檔案 (.DS_Store, .git, etc.)
  /^__MACOSX$/, // macOS 壓縮檔產生的資料夾
  /^Thumbs\.db$/i, // Windows 縮圖快取
  /^desktop\.ini$/i, // Windows 桌面設定
  /^\.Spotlight-/, // macOS Spotlight 索引
  /^\.Trashes$/, // macOS 垃圾桶
  /^\.fseventsd$/, // macOS 檔案系統事件
  /^node_modules$/, // Node.js 依賴
]

// 允許的檔案副檔名
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.srt', '.md']

// 檢查是否應該忽略此檔案/資料夾
function shouldIgnore(name: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(name))
}

// 檢查檔案是否為允許的類型
function isAllowedFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
}

// 過濾檔案陣列
function filterFiles(files: File[]): File[] {
  return files.filter((file) => {
    const pathParts = file.webkitRelativePath?.split('/') || [file.name]
    const hasIgnoredPart = pathParts.some((part) => shouldIgnore(part))
    if (hasIgnoredPart) return false
    return isAllowedFile(file.name)
  })
}

interface FolderDropZoneProps {
  onFolderParsed: (chapters: ParsedChapter[], files: File[]) => void
  className?: string
}

export function FolderDropZone({
  onFolderParsed,
  className,
}: FolderDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 處理解析後的檔案
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setIsProcessing(true)
      setError(null)
      try {
        const fileArray = Array.from(files)
        const filteredFiles = filterFiles(fileArray)
        const result = parseFileList(filteredFiles)

        // 檢查是否為錯誤結果
        if ('error' in result) {
          setError(result.error)
          return
        }

        if (result.length === 0) {
          setError('沒有找到有效的章節和單元結構')
          return
        }

        onFolderParsed(result, filteredFiles)
      } catch (err) {
        console.error('解析資料夾失敗:', err)
        setError('解析資料夾時發生錯誤')
      } finally {
        setIsProcessing(false)
      }
    },
    [onFolderParsed]
  )

  // 拖放處理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const items = e.dataTransfer.items
      if (!items || items.length === 0) return

      const allFiles: File[] = []

      const readEntry = async (
        entry: FileSystemEntry,
        path: string = ''
      ): Promise<void> => {
        if (shouldIgnore(entry.name)) return

        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry
          return new Promise((resolve) => {
            fileEntry.file((file) => {
              const newFile = new File([file], file.name, { type: file.type })
              Object.defineProperty(newFile, 'webkitRelativePath', {
                value: path + file.name,
                writable: false,
              })
              allFiles.push(newFile)
              resolve()
            })
          })
        } else if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry
          const reader = dirEntry.createReader()

          return new Promise((resolve) => {
            const readEntries = () => {
              reader.readEntries(async (entries) => {
                if (entries.length === 0) {
                  resolve()
                  return
                }
                for (const childEntry of entries) {
                  await readEntry(childEntry, path + entry.name + '/')
                }
                readEntries()
              })
            }
            readEntries()
          })
        }
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          await readEntry(entry)
        }
      }

      if (allFiles.length > 0) {
        handleFiles(allFiles)
      }
    },
    [handleFiles]
  )

  // 點擊選擇資料夾
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFiles(files)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [handleFiles]
  )

  return (
    <div className={cn('space-y-4', className)}>
      <Card
        className={cn(
          'border-2 border-dashed transition-all cursor-pointer rounded-xl',
          isDragging
            ? 'border-cta bg-cta/10 scale-[1.02]'
            : 'border-divider bg-white hover:border-cta hover:bg-surface',
          isProcessing && 'opacity-50 pointer-events-none'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
            {isDragging ? (
              <Upload className="w-8 h-8 text-cta" />
            ) : (
              <FolderOpen className="w-8 h-8 text-caption" />
            )}
          </div>

          <p className="text-heading font-semibold text-base mb-1.5">
            {isProcessing ? '正在解析資料夾...' : '拖放課程資料夾到這裡'}
          </p>

          <p className="text-caption text-sm mb-4 max-w-sm">
            系統會自動識別三層資料夾結構，並匯入影片、字幕和講義
          </p>

          <Button
            variant="outline"
            size="sm"
            className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            disabled={isProcessing}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            選擇資料夾
          </Button>
        </div>
      </Card>

      {/* 錯誤提示 */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* 隱藏的檔案輸入 */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-expect-error webkitdirectory 是非標準屬性
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 資料夾格式說明 */}
      <div className="rounded-lg border border-divider bg-surface/50 p-4 text-xs">
        <p className="font-medium text-heading mb-2">
          資料夾結構說明<br />請上傳以下結構之資料夾<br />系統會自動識別三層資料夾結構，並匯入影片、字幕和講義
        </p>
        <pre className="text-caption leading-relaxed font-mono">
{`我的課程/                    ← 最外層（root）
├── 第一章 基礎概念/          ← 第二層（章節名稱）
│   ├── 1-1 環境建置/         ← 第三層（單元名稱）
│   │   ├── video.mp4         ← 影片（可以是 mp4 或 mov）
│   │   ├── subtitle.srt      ← 字幕（可選，用於 AI 生成講義）
│   │   └── notes.md          ← 講義（可選，直接作為講義使用）
│   └── 1-2 Hello World/
│       └── demo.mp4
└── 第二章 進階技巧/
    └── 2-1 狀態管理/
        ├── lesson.mov
        └── lesson.srt`}
        </pre>
        <ul className="mt-3 space-y-1 text-caption">
          <li>
            <span className="text-heading font-medium">影片：</span>
            支援 .mp4、.mov
          </li>
          <li>
            <span className="text-heading font-medium">講義：</span>
            你可以上傳 .md 檔案，直接作為講義使用，也可以使用 srt 字幕檔，AI 可以轉寫為結構化講義
          </li>
          <li>
            <span className="text-heading font-medium">排序：</span>
            可以上傳後手動調整排序
          </li>
        </ul>
        <div className="mt-3 pt-3 border-t border-divider">
          <a
            href="/範本課程.zip"
            download
            className="text-cta hover:underline inline-flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
            下載範例資料夾
          </a>
        </div>
      </div>
    </div>
  )
}
