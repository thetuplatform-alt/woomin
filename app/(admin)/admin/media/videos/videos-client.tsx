'use client'

import { useState, useCallback, useEffect, useRef, useTransition } from 'react'
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
import { VideoCard } from '@/components/admin/media/video-card'
import { VideoUpload } from '@/components/admin/media/video-upload'
import {
  CloudflareStreamSetupDialog,
  CloudflareStreamSetupPrompt,
} from '@/components/admin/media/cloudflare-stream-setup-dialog'
import {
  Search,
  Upload,
  Film,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { GetMediaResult } from '@/lib/actions/media'
import { shouldShowCloudflareSyncButton } from '@/lib/video-provider-ui'

interface CloudflareSyncResponse {
  success: boolean
  error?: string
  imported?: number
  updated?: number
  ready?: number
  processing?: number
  errorCount?: number
  hasProcessing?: boolean
  errors?: Array<{ uid: string; name: string; status: string; error: string }>
  importErrors?: Array<{ uid: string; name: string; error: string }>
  summary?: {
    errorVideos: number
    importFailures: number
    truncated: boolean
  }
}

interface VideosClientProps {
  initialData: GetMediaResult
  searchQuery?: string
  streamCustomerCode: string
  isCloudflareStreamConfigured: boolean
  isProviderConfigured: boolean
  provider: 'cloudflare' | 'bunny'
}

export function VideosClient({
  initialData,
  searchQuery,
  streamCustomerCode,
  isCloudflareStreamConfigured,
  isProviderConfigured,
  provider,
}: VideosClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchQuery || '')
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [data, setData] = useState(initialData)
  const [uploadCount, setUploadCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncSummary, setLastSyncSummary] = useState<string | null>(null)
  const [lastSyncErrors, setLastSyncErrors] = useState<string[]>([])
  const syncInFlightRef = useRef(false)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  const syncCloudflare = useCallback(async (options?: { silent?: boolean }) => {
    if (syncInFlightRef.current) return false
    syncInFlightRef.current = true
    setIsSyncing(true)
    try {
      const res = await fetch('/api/admin/media/sync-cloudflare', {
        method: 'POST',
        cache: 'no-store',
      })
      const json = (await res.json()) as CloudflareSyncResponse
      if (!json.success) {
        if (!options?.silent) toast.error(json.error || '同步失敗')
        return false
      }
      const errorMessages = [
        ...(json.errors ?? []).map((item) => `${item.name}: ${item.error}`),
        ...(json.importErrors ?? []).map(
          (item) => `${item.name}: 匯入失敗，${item.error}`
        ),
      ]
      setLastSyncErrors(errorMessages.slice(0, 5))
      setLastSyncSummary(
        `最近同步：新增 ${json.imported ?? 0}、更新 ${json.updated ?? 0}、就緒 ${json.ready ?? 0}、處理中 ${json.processing ?? 0}、錯誤 ${json.errorCount ?? 0}`
      )
      if (!options?.silent) {
        const imported = json.imported ?? 0
        const updated = json.updated ?? 0
        const processing = json.processing ?? 0
        const errors = json.errorCount ?? 0

        if (imported > 0 || updated > 0) {
          toast.success(
            `同步完成：新增 ${imported} 支，更新 ${updated} 支` +
              (processing > 0 ? `，仍有 ${processing} 支處理中` : '') +
              (errors > 0 ? `，${errors} 支錯誤` : '')
          )
        } else {
          toast.success(
            processing > 0
              ? `已同步，目前仍有 ${processing} 支處理中`
              : errors > 0
                ? `已同步，目前有 ${errors} 支影片處於錯誤狀態`
                : '已是最新狀態，沒有遺漏的影片'
          )
        }
      }
      router.refresh()
      return Boolean(json.hasProcessing)
    } catch (error) {
      console.error(error)
      if (!options?.silent) toast.error('同步時發生錯誤')
      return false
    } finally {
      setIsSyncing(false)
      syncInFlightRef.current = false
    }
  }, [router])

  const handleSyncCloudflare = () => {
    void syncCloudflare()
  }

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

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)

      const timeoutId = setTimeout(() => {
        startTransition(() => {
          const query = createQueryString({
            search: value || null,
            page: null,
          })
          router.push(`${pathname}?${query}`)
          router.refresh()
        })
      }, 300)

      return () => clearTimeout(timeoutId)
    },
    [createQueryString, pathname, router]
  )

  const handlePageChange = (page: number) => {
    startTransition(() => {
      const query = createQueryString({
        page: page.toString(),
      })
      router.push(`${pathname}?${query}`)
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    setData((prev) => ({
      ...prev,
      media: prev.media.filter((item) => item.id !== id),
      total: prev.total - 1,
    }))
  }

  const handleVideoSync = (updatedVideo: GetMediaResult['media'][number]) => {
    setData((prev) => ({
      ...prev,
      media: prev.media.map((item) =>
        item.id === updatedVideo.id ? updatedVideo : item
      ),
    }))
  }

  const handleUploadComplete = () => {
    setUploadCount((prev) => prev + 1)
    if (provider === 'cloudflare') void syncCloudflare({ silent: true })
  }

  const handleUploadDialogClose = (open: boolean) => {
    setShowUploadDialog(open)
    if (!open && uploadCount > 0) {
      toast.success(`已完成 ${uploadCount} 支影片上傳，正在更新列表...`)
      setUploadCount(0)
      router.refresh()
    }
  }

  const openUploadFlow = () => {
    if (isProviderConfigured) {
      setShowUploadDialog(true)
    } else if (provider === 'cloudflare') {
      setShowSetupDialog(true)
    } else {
      toast.error('請先到影音設定填寫 Bunny Stream 設定。')
    }
  }

  useEffect(() => {
    if (provider !== 'cloudflare' || !isCloudflareStreamConfigured) return

    const hasProcessingVideo = data.media.some(
      (video) =>
        video.type === 'VIDEO' &&
        video.cfStreamId &&
        video.cfStatus !== 'ready'
    )

    if (!hasProcessingVideo) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    // 最多輪詢 20 次（≈ 10 分鐘）後停止，避免老師長時間開著頁面持續打 CF API。
    // 若仍有處理中的影片，老師可手動按「同步 Cloudflare 影片」繼續。
    let attempts = 0
    const MAX_ATTEMPTS = 20

    const tick = async () => {
      attempts += 1
      const shouldContinue = await syncCloudflare({ silent: true })
      if (cancelled) return

      if (shouldContinue && attempts < MAX_ATTEMPTS) {
        timer = setTimeout(tick, 30_000)
      }
    }

    timer = setTimeout(tick, 30_000)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [data.media, isCloudflareStreamConfigured, provider, syncCloudflare])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-caption" />
          <Input
            placeholder="搜尋影片..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="bg-white pl-10 text-heading placeholder:text-caption focus:border-cta focus:ring-cta"
          />
        </div>

        {shouldShowCloudflareSyncButton(provider) && (
          <Button
            variant="outline"
            onClick={handleSyncCloudflare}
            disabled={isSyncing || !isCloudflareStreamConfigured}
            className="rounded-lg border-divider text-body hover:bg-surface hover:text-heading"
            title="從 Cloudflare 抓回直接上傳的影片"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? '同步中...' : '同步 Cloudflare 影片'}
          </Button>
        )}

        <Dialog open={showUploadDialog} onOpenChange={handleUploadDialogClose}>
          <DialogTrigger asChild>
            <Button
              className="rounded-lg bg-cta text-white hover:bg-cta-hover"
          onClick={(event) => {
                if (!isProviderConfigured) {
                  event.preventDefault()
                  openUploadFlow()
                }
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              上傳到 {provider === 'bunny' ? 'Bunny' : 'Cloudflare'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-xl border-divider bg-white">
            <DialogHeader>
              <DialogTitle className="text-heading">
                批次上傳到 {provider === 'bunny' ? 'Bunny Stream' : 'Cloudflare Stream'}
                {uploadCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-cta">
                    已完成 {uploadCount} 支
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-body">
              支援多支影片拖曳或批次上傳。上傳完成後，這些影片會出現在媒體中心，供課程單元重複使用。
            </p>
            {isProviderConfigured ? (
              <VideoUpload
                provider={provider}
                onUploadComplete={handleUploadComplete}
                onError={(error) => toast.error(error)}
              />
            ) : (
              <CloudflareStreamSetupPrompt
                onOpenSetup={() => {
                  setShowUploadDialog(false)
                  setShowSetupDialog(true)
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {(lastSyncSummary || lastSyncErrors.length > 0) && (
        <div className="rounded-lg border border-divider bg-surface p-3 text-sm">
          <div className="flex items-center gap-2 text-heading">
            {lastSyncErrors.length > 0 ? (
              <AlertCircle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <span>{lastSyncSummary}</span>
          </div>
          {lastSyncErrors.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">
              {lastSyncErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {data.media.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Film className="mb-4 h-16 w-16 text-caption" />
          <h3 className="mb-2 text-xl font-medium text-heading">
            {search ? '找不到符合條件的影片' : '目前還沒有影片'}
          </h3>
          <p className="mb-6 text-body">
            {search
              ? '試試看換個關鍵字，或清除搜尋條件。'
              : `這裡的上傳按鈕會把影片存到${provider === 'bunny' ? ' Bunny Stream' : ' Cloudflare Stream'}。`}
          </p>
          {!search && (
            <Button
              className="rounded-lg bg-cta text-white hover:bg-cta-hover"
              onClick={openUploadFlow}
            >
              <Upload className="mr-2 h-4 w-4" />
              上傳到 {provider === 'bunny' ? 'Bunny' : 'Cloudflare'}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.media.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onDelete={handleDelete}
                onSync={handleVideoSync}
                streamCustomerCode={streamCustomerCode}
              />
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-body">
                共 {data.total} 支影片，第 {data.page} / {data.totalPages} 頁
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={data.page <= 1 || isPending}
                  className="rounded-lg border-divider text-body hover:bg-surface hover:text-heading"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一頁
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={data.page >= data.totalPages || isPending}
                  className="rounded-lg border-divider text-body hover:bg-surface hover:text-heading"
                >
                  下一頁
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CloudflareStreamSetupDialog
        open={showSetupDialog}
        onOpenChange={setShowSetupDialog}
      />
    </div>
  )
}
