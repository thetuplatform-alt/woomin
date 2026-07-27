// app/(admin)/admin/media/videos/page.tsx
// 影片管理頁面
// 顯示所有影片列表，支援上傳、搜尋和刪除

import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getMediaList } from '@/lib/actions/media'
import { getActiveCloudVideoProvider } from '@/lib/actions/settings'
import { getCloudflareStreamConfigStatus } from '@/lib/cloudflare-stream-config'
import { getBunnyStreamConfigStatus } from '@/lib/bunny-stream-config'
import { Film, ArrowLeft, Loader2 } from 'lucide-react'
import { VideosClient } from './videos-client'

export const metadata = {
  title: '影片庫',
}

interface VideosPageProps {
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}

// 影片列表區塊
async function VideoListSection({
  search,
  page,
  isCloudflareStreamConfigured,
  isProviderConfigured,
  provider,
  streamCustomerCode,
}: {
  search?: string
  page?: string
  isCloudflareStreamConfigured: boolean
  isProviderConfigured: boolean
  provider: 'cloudflare' | 'bunny'
  streamCustomerCode: string
}) {
  const currentPage = page ? parseInt(page, 10) : 1
  const pageSize = 12

  const result = await getMediaList({
    type: 'VIDEO',
    search,
    page: currentPage,
    pageSize,
    provider,
  })

  return (
    <VideosClient
      initialData={result}
      searchQuery={search}
      streamCustomerCode={streamCustomerCode}
      isCloudflareStreamConfigured={isCloudflareStreamConfigured}
      isProviderConfigured={isProviderConfigured}
      provider={provider}
    />
  )
}

// 載入中狀態
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-caption" />
    </div>
  )
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const params = await searchParams
  const activeProvider = (await getActiveCloudVideoProvider()) ?? 'cloudflare'
  const cloudflareStream = await getCloudflareStreamConfigStatus()
  const bunnyStream = await getBunnyStreamConfigStatus()
  const isCloudflareStreamConfigured =
    cloudflareStream.hasUploadConfig && cloudflareStream.hasPlaybackConfig
  const isProviderConfigured = activeProvider === 'cloudflare'
    ? isCloudflareStreamConfigured
    : bunnyStream.isConfigured

  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="text-body hover:text-heading hover:bg-surface">
            <Link href="/admin/media">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-bold text-heading">影片庫</h2>
            <p className="text-body mt-1">
              管理上傳到平台、可重複綁定到課程單元的 Cloudflare Stream 與 Bunny Stream 影片
            </p>
          </div>
        </div>
      </div>

      {/* 影片列表卡片 */}
      <Card className="bg-white border-divider rounded-xl">
        <CardHeader>
          <CardTitle className="text-heading flex items-center gap-2">
            <Film className="w-5 h-5 text-cta" />
            影片列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingState />}>
            <VideoListSection
              search={params.search}
              page={params.page}
              isCloudflareStreamConfigured={isCloudflareStreamConfigured}
              isProviderConfigured={isProviderConfigured}
              provider={activeProvider}
              streamCustomerCode={cloudflareStream.customerCode}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
