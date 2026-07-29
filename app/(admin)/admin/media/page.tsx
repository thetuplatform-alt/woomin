// app/(admin)/admin/media/page.tsx
// 媒體中心主頁
// 顯示所有媒體類型的概覽和快速操作

import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getMediaStats, getMediaList } from '@/lib/actions/media'
import { getActiveCloudVideoProvider } from '@/lib/actions/settings'
import { getCloudflareStreamConfig } from '@/lib/cloudflare-stream-config'
import { normalizeVideoStatus } from '@/lib/video-source'
import { Film, Image as ImageIcon, FileText, HardDrive, ArrowRight, Loader2 } from 'lucide-react'

export const metadata = {
  title: '媒體中心',
}

// 格式化檔案大小
function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 統計卡片
async function StatsCards() {
  const stats = await getMediaStats()

  const statItems = [
    {
      title: '影片',
      value: stats.totalVideos,
      icon: Film,
      color: 'text-cta',
      bgColor: 'bg-cta/10',
      href: '/admin/media/videos',
    },
    {
      title: '圖片',
      value: stats.totalImages,
      icon: ImageIcon,
      color: 'text-cta',
      bgColor: 'bg-cta/10',
      href: '/admin/media/images',
    },
    {
      title: '附件',
      value: stats.totalAttachments,
      icon: FileText,
      color: 'text-cta',
      bgColor: 'bg-cta/10',
      href: '/admin/media/attachments',
    },
    {
      title: '總儲存空間',
      value: formatFileSize(stats.totalSize),
      icon: HardDrive,
      color: 'text-cta',
      bgColor: 'bg-cta/10',
    },
  ]

  return (
    <div data-tour="media-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <Card key={index} className="rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{item.title}</p>
                <p className="text-2xl font-bold mt-1">
                  {item.value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function RecentAttachments() {
  const result = await getMediaList({ type: 'ATTACHMENT', pageSize: 5 })

  if (result.media.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-caption mx-auto mb-4" />
        <p className="text-body">還沒有任何文件或附件</p>
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-lg border-divider text-heading hover:bg-surface">
          <Link href="/admin/media/attachments">前往文件庫</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {result.media.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-lg bg-surface p-3 transition-colors hover:bg-surface-hover"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
            <FileText className="h-5 w-5 text-cta" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-heading">
              {item.originalName}
            </p>
            <p className="mt-1 truncate text-xs text-caption">
              {item.sourceLabel || item.mimeType}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// 根據 cfStreamId 動態生成縮圖 URL
function getVideoThumbnailUrl(
  video: { cfStreamId: string | null; thumbnail: string | null },
  streamCustomerCode?: string
) {
  if (video.cfStreamId && streamCustomerCode) {
    return `https://customer-${streamCustomerCode}.cloudflarestream.com/${video.cfStreamId}/thumbnails/thumbnail.jpg?height=270`
  }
  return video.thumbnail
}

// 最近上傳的影片
async function RecentVideos() {
  const activeProvider = (await getActiveCloudVideoProvider()) ?? 'cloudflare'
  const cloudflareStream = await getCloudflareStreamConfig()
  const result = await getMediaList({ type: 'VIDEO', pageSize: 4, provider: activeProvider })

  if (result.media.length === 0) {
    return (
      <div className="text-center py-8">
        <Film className="w-12 h-12 text-caption mx-auto mb-4" />
        <p className="text-body">還沒有上傳任何影片</p>
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-lg border-divider text-heading hover:bg-surface">
          <Link href="/admin/media/videos">前往影片庫</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {result.media.map((video) => {
        const thumbnailUrl = getVideoThumbnailUrl(video, cloudflareStream.customerCode)
        return (
          <div
            key={video.id}
            className="flex items-center gap-4 p-3 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
          >
            {/* 縮圖 */}
            <div className="w-20 h-12 rounded-lg bg-divider flex items-center justify-center shrink-0 overflow-hidden">
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt={video.originalName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Film className="w-6 h-6 text-caption" />
              )}
            </div>

            {/* 資訊 */}
            <div className="flex-1 min-w-0">
              <p className="text-heading text-sm font-medium truncate">
                {video.originalName}
              </p>
              <p className="text-caption text-xs mt-1">
                {video.duration && video.duration > 0 ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                <span className="mx-2">.</span>
                {new Date(video.createdAt).toLocaleDateString('zh-TW')}
              </p>
            </div>

            {/* 狀態（依實際 provider 判斷，Bunny 影片走 bunnyStatus） */}
            <div className="shrink-0">
              {normalizeVideoStatus(video.bunnyStatus, video.cfStatus) === 'ready' ? (
                <span className="text-xs text-green-600">就緒</span>
              ) : normalizeVideoStatus(video.bunnyStatus, video.cfStatus) === 'error' ? (
                <span className="text-xs text-red-600">錯誤</span>
              ) : (
                <span className="text-xs text-cta">處理中</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 最近上傳的圖片
async function RecentImages() {
  const result = await getMediaList({ type: 'IMAGE', pageSize: 8 })

  if (result.media.length === 0) {
    return (
      <div className="text-center py-8">
        <ImageIcon className="w-12 h-12 text-caption mx-auto mb-4" />
        <p className="text-body">還沒有上傳任何圖片</p>
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-lg border-divider text-heading hover:bg-surface">
          <Link href="/admin/media/images">上傳圖片</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {result.media.map((image) => (
        <div
          key={image.id}
          className="aspect-square rounded-lg bg-surface overflow-hidden hover:ring-2 hover:ring-cta transition-all"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.originalName}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  )
}

// 載入中狀態
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-caption" />
    </div>
  )
}

export default function MediaPage() {
  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div>
        <h2 className="text-xl font-bold text-heading">媒體中心</h2>
        <p className="text-body mt-1">
          管理平台託管的影片、圖片與附件檔案
        </p>
      </div>

      <Card data-tour="media-youtube-notice" className="rounded-xl border-divider bg-surface/50">
        <CardContent className="pt-6">
          <p className="text-sm text-body">
            這裡的影片庫顯示上傳到平台的 Cloudflare Stream 與 Bunny Stream 影片。若課程使用
            YouTube，請到課程單元內直接貼上影片網址，不會出現在媒體中心。
          </p>
        </CardContent>
      </Card>

      {/* 統計卡片 */}
      <Suspense fallback={<LoadingState />}>
        <StatsCards />
      </Suspense>

      {/* 快速操作 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 影片區塊 */}
        <Card data-tour="media-videos-card" className="bg-white border-divider rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-heading text-lg">最近影片</CardTitle>
              <CardDescription className="text-body">
                最近上傳的影片
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-body hover:text-heading hover:bg-surface">
              <Link href="/admin/media/videos">
                查看全部
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<LoadingState />}>
              <RecentVideos />
            </Suspense>
          </CardContent>
        </Card>

        {/* 圖片區塊 */}
        <Card data-tour="media-images-card" className="bg-white border-divider rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-heading text-lg">最近圖片</CardTitle>
              <CardDescription className="text-body">
                最近上傳的圖片檔案
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-body hover:text-heading hover:bg-surface">
              <Link href="/admin/media/images">
                查看全部
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<LoadingState />}>
              <RecentImages />
            </Suspense>
          </CardContent>
        </Card>

        <Card data-tour="media-attachments-card" className="bg-white border-divider rounded-xl md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-heading text-lg">最近文件</CardTitle>
              <CardDescription className="text-body">
                PDF、作業附件與其他可下載文件
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-body hover:text-heading hover:bg-surface">
              <Link href="/admin/media/attachments">
                查看全部
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<LoadingState />}>
              <RecentAttachments />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
