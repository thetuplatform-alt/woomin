// app/(admin)/admin/media/images/images-client.tsx
// 圖片管理客戶端元件
// 處理搜尋、上傳和刪除操作

'use client'

import { useState, useCallback, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ImageCard } from '@/components/admin/media/image-card'
import { ImageUpload } from '@/components/admin/media/image-upload'
import { Search, Upload, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { GetMediaResult } from '@/lib/actions/media'

interface ImagesClientProps {
  initialData: GetMediaResult
  searchQuery?: string
}

export function ImagesClient({ initialData, searchQuery }: ImagesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchQuery || '')
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [data, setData] = useState(initialData)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  // 建立查詢字串
  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const current = new URLSearchParams(searchParams.toString())

      Object.entries(params).forEach(([key, value]) => {
        if (value === null) {
          current.delete(key)
        } else {
          current.set(key, value)
        }
      })

      return current.toString()
    },
    [searchParams]
  )

  // 處理搜尋
  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)

      const timeoutId = setTimeout(() => {
        startTransition(() => {
          const query = createQueryString({
            search: value || null,
            page: null, // 重置頁碼
          })
          router.push(`${pathname}?${query}`)
        })
      }, 300)

      return () => clearTimeout(timeoutId)
    },
    [createQueryString, pathname, router]
  )

  // 處理分頁
  const handlePageChange = (page: number) => {
    startTransition(() => {
      const query = createQueryString({
        page: page.toString(),
      })
      router.push(`${pathname}?${query}`)
    })
  }

  // 處理刪除
  const handleDelete = (id: string) => {
    setData((prev) => ({
      ...prev,
      media: prev.media.filter((item) => item.id !== id),
      total: prev.total - 1,
    }))
  }

  // 追蹤批量上傳數量
  const [uploadCount, setUploadCount] = useState(0)

  // 處理單張圖片上傳完成
  const handleUploadComplete = () => {
    setUploadCount((prev) => prev + 1)
  }

  // 關閉上傳對話框時重新整理
  const handleUploadDialogClose = (open: boolean) => {
    setShowUploadDialog(open)
    if (!open && uploadCount > 0) {
      toast.success(`${uploadCount} 張圖片上傳成功`)
      setUploadCount(0)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* 工具列 */}
      <div className="flex items-center gap-4">
        {/* 搜尋 */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-caption" />
          <Input
            placeholder="搜尋圖片..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus:ring-cta"
          />
        </div>

        {/* 上傳按鈕 */}
        <Dialog open={showUploadDialog} onOpenChange={handleUploadDialogClose}>
          <DialogTrigger asChild>
            <Button className="bg-cta hover:bg-cta-hover text-white rounded-lg">
              <Upload className="w-4 h-4 mr-2" />
              上傳圖片
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-divider max-w-2xl rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-heading">
                批量上傳圖片
                {uploadCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-cta">
                    （已完成 {uploadCount} 張）
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-body">
              支援一次選取或拖放多張圖片
            </p>
            <ImageUpload
              onUploadComplete={handleUploadComplete}
              onError={(error) => toast.error(error)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* 圖片列表 */}
      {data.media.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="w-16 h-16 text-caption mb-4" />
          <h3 className="text-xl font-medium text-heading mb-2">
            {search ? '沒有找到符合的圖片' : '還沒有上傳任何圖片'}
          </h3>
          <p className="text-body mb-6">
            {search ? '請嘗試其他搜尋關鍵字' : '點擊上方按鈕開始上傳您的第一張圖片'}
          </p>
          {!search && (
            <Button
              className="bg-cta hover:bg-cta-hover text-white rounded-lg"
              onClick={() => setShowUploadDialog(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              上傳圖片
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* 圖片網格 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {data.media.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* 分頁 */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-body text-sm">
                共 {data.total} 張圖片，第 {data.page} / {data.totalPages} 頁
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={data.page <= 1 || isPending}
                  className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一頁
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={data.page >= data.totalPages || isPending}
                  className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
                >
                  下一頁
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
