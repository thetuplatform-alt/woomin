// components/admin/media/image-card.tsx
// 圖片卡片元件
// 顯示圖片預覽和操作按鈕

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Copy,
  Trash2,
  MoreVertical,
  Calendar,
  CheckCircle,
  Loader2,
  ExternalLink,
  ImageIcon,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { deleteMedia, renameMedia } from '@/lib/actions/media'
import { cn } from '@/lib/utils'
import type { Media } from '@prisma/client'

interface ImageCardProps {
  image: Media
  onDelete?: (id: string) => void
  onSelect?: (image: Media) => void
  selectable?: boolean
  selected?: boolean
}

export function ImageCard({
  image,
  onDelete,
  onSelect,
  selectable = false,
  selected = false,
}: ImageCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [currentImage, setCurrentImage] = useState(image)
  const [imageError, setImageError] = useState(false)

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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

  // 複製圖片 URL
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentImage.url)
    toast.success('已複製圖片 URL')
  }

  // 在新視窗開啟
  const handleOpenInNewTab = () => {
    window.open(currentImage.url, '_blank')
  }

  // 重新命名圖片
  const handleRename = async () => {
    if (!renameName.trim()) return
    setIsRenaming(true)
    try {
      const result = await renameMedia(currentImage.id, renameName.trim())
      if (result.success && result.media) {
        setCurrentImage(result.media)
        toast.success('圖片已重新命名')
        setShowRenameDialog(false)
      } else {
        toast.error(result.error || '重新命名失敗')
      }
    } catch {
      toast.error('重新命名時發生錯誤')
    } finally {
      setIsRenaming(false)
    }
  }

  // 刪除圖片
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteMedia(currentImage.id)
      if (result.success) {
        toast.success('圖片已刪除')
        onDelete?.(currentImage.id)
      } else {
        toast.error(result.error || '刪除失敗')
      }
    } catch {
      toast.error('刪除時發生錯誤')
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // 處理點擊（選擇模式）
  const handleClick = () => {
    if (selectable) {
      onSelect?.(image)
    }
  }

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden bg-white border-divider rounded-xl transition-all group',
          selectable && 'cursor-pointer hover:border-cta',
          selected && 'ring-2 ring-cta border-cta'
        )}
        onClick={handleClick}
      >
        {/* 預覽圖 */}
        <div className="aspect-square relative bg-surface">
          {!imageError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={currentImage.url}
              alt={currentImage.originalName}
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-caption" />
            </div>
          )}

          {/* 選中標記 */}
          {selectable && selected && (
            <div className="absolute top-2 right-2">
              <div className="w-6 h-6 rounded-full bg-cta flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            </div>
          )}

          {/* 操作按鈕（懸停顯示） */}
          {!selectable && (
            <div className="absolute inset-0 bg-heading/0 group-hover:bg-heading/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="bg-white hover:bg-surface text-heading"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopyUrl()
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="bg-white hover:bg-surface text-heading"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenInNewTab()
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 資訊 */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-heading text-sm font-medium truncate">
                {currentImage.originalName}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-caption text-xs">
                <span>{formatFileSize(currentImage.size)}</span>
                <span>.</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(currentImage.createdAt)}
                </span>
              </div>
            </div>

            {/* 操作選單 */}
            {!selectable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon-sm" className="text-body hover:text-heading hover:bg-surface">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-divider rounded-lg">
                  <DropdownMenuItem
                    onClick={() => {
                      setRenameName(currentImage.originalName)
                      setShowRenameDialog(true)
                    }}
                    className="text-body hover:text-heading hover:bg-surface"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    重新命名
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyUrl} className="text-body hover:text-heading hover:bg-surface">
                    <Copy className="w-4 h-4 mr-2" />
                    複製 URL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenInNewTab} className="text-body hover:text-heading hover:bg-surface">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    在新視窗開啟
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 hover:bg-red-50"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    刪除圖片
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </Card>

      {/* 重新命名對話框 */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="bg-white border-divider rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-heading">重新命名圖片</DialogTitle>
            <DialogDescription className="text-body">
              輸入新的圖片名稱
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="輸入圖片名稱"
            className="bg-white border-divider text-heading placeholder:text-caption"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isRenaming}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
            <Button
              onClick={handleRename}
              disabled={isRenaming || !renameName.trim()}
              className="bg-cta hover:bg-cta-hover text-white rounded-lg"
            >
              {isRenaming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  儲存中...
                </>
              ) : (
                '確認'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認刪除圖片</DialogTitle>
            <DialogDescription className="text-body">
              確定要刪除圖片「{currentImage.originalName}」嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  刪除中...
                </>
              ) : (
                '確認刪除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
