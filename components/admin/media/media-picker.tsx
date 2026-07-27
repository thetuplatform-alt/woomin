'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VideoCard } from './video-card'
import { ImageCard } from './image-card'
import { VideoUpload } from './video-upload'
import { ImageUpload } from './image-upload'
import {
  CloudflareStreamSetupDialog,
  CloudflareStreamSetupPrompt,
} from './cloudflare-stream-setup-dialog'
import { Search, Film, Image as ImageIcon, Upload, Loader2 } from 'lucide-react'
import { getMediaList, type GetMediaResult } from '@/lib/actions/media'
import type { Media } from '@prisma/client'

interface MediaPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 回傳 false 表示選取被防禦層擋下（provider 不符），此時對話框不得關閉；
  // 回傳 true 或不回傳（void）視為選取成功，維持既有呼叫端相容性。
  onSelect: (media: Media) => boolean | void
  type?: 'VIDEO' | 'IMAGE' | 'ALL'
  title?: string
  description?: string
  streamCustomerCode?: string
  isCloudflareStreamConfigured?: boolean
  provider?: 'cloudflare' | 'bunny'
}

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  type = 'ALL',
  title = '選擇媒體',
  description = '從平台媒體庫選取既有素材，或直接上傳新的檔案。',
  streamCustomerCode,
  isCloudflareStreamConfigured = true,
  provider = 'cloudflare',
}: MediaPickerProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library')
  const [mediaType, setMediaType] = useState<'VIDEO' | 'IMAGE'>(
    type === 'IMAGE' ? 'IMAGE' : 'VIDEO'
  )
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mediaData, setMediaData] = useState<GetMediaResult | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)
  const [showCloudflareSetupDialog, setShowCloudflareSetupDialog] = useState(false)

  const loadMedia = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getMediaList({
        type: mediaType,
        search: search || undefined,
        pageSize: 20,
        provider: mediaType === 'VIDEO' ? provider : undefined,
      })
      setMediaData(result)
    } catch (error) {
      console.error('載入媒體列表失敗:', error)
    } finally {
      setIsLoading(false)
    }
  }, [mediaType, provider, search])

  useEffect(() => {
    if (open) {
      void loadMedia()
      setSelectedMedia(null)
    }
  }, [loadMedia, mediaType, open])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) {
        void loadMedia()
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, open, loadMedia])

  const handleSelect = (media: Media) => {
    setSelectedMedia(media)
  }

  const handleConfirm = () => {
    if (!selectedMedia) return
    const selectionResult = onSelect(selectedMedia)
    // 明確回傳 false = 被防禦層擋下，保持對話框開啟，不當作已完成選取
    if (selectionResult === false) return
    onOpenChange(false)
  }

  const handleUploadComplete = () => {
    setActiveTab('library')
    void loadMedia()
  }

  const isVideoMode = mediaType === 'VIDEO' || type === 'VIDEO'
  const providerName = provider === 'bunny' ? 'Bunny' : 'Cloudflare'
  const isProviderConfigured = provider === 'bunny' || isCloudflareStreamConfigured

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col rounded-xl border-divider bg-white">
        <DialogHeader>
          <DialogTitle className="text-heading">{title}</DialogTitle>
          <DialogDescription className="text-body">{description}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'library' | 'upload')}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="border-divider bg-surface">
            <TabsTrigger
              value="library"
              className="text-body data-[state=active]:bg-white data-[state=active]:text-heading"
            >
              媒體庫
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="text-body data-[state=active]:bg-white data-[state=active]:text-heading"
            >
              <Upload className="mr-2 h-4 w-4" />
              上傳新檔案
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-4 flex flex-1 flex-col overflow-hidden">
            <div className="mb-4 flex items-center gap-4">
              {type === 'ALL' && (
                <div className="flex items-center gap-2 rounded-lg bg-surface p-1">
                  <Button
                    variant={mediaType === 'VIDEO' ? 'default' : 'ghost'}
                    size="sm"
                    type="button"
                    onClick={() => setMediaType('VIDEO')}
                    className={
                      mediaType === 'VIDEO'
                        ? 'bg-cta text-white hover:bg-cta-hover'
                        : 'text-body hover:bg-white hover:text-heading'
                    }
                  >
                    <Film className="mr-2 h-4 w-4" />
                    影片
                  </Button>
                  <Button
                    variant={mediaType === 'IMAGE' ? 'default' : 'ghost'}
                    size="sm"
                    type="button"
                    onClick={() => setMediaType('IMAGE')}
                    className={
                      mediaType === 'IMAGE'
                        ? 'bg-cta text-white hover:bg-cta-hover'
                        : 'text-body hover:bg-white hover:text-heading'
                    }
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    圖片
                  </Button>
                </div>
              )}

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-caption" />
                <Input
                  placeholder={mediaType === 'VIDEO' ? `搜尋 ${providerName} 影片…` : '搜尋媒體…'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white pl-10 text-heading placeholder:text-caption focus:border-cta focus:ring-cta"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-caption" />
                </div>
              ) : mediaData?.media.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  {mediaType === 'VIDEO' ? (
                    <Film className="mb-4 h-12 w-12 text-caption" />
                  ) : (
                    <ImageIcon className="mb-4 h-12 w-12 text-caption" />
                  )}
                  <p className="text-body">
                    {search
                      ? mediaType === 'VIDEO'
                        ? `找不到符合條件的 ${providerName} 影片`
                        : '找不到符合條件的媒體'
                      : mediaType === 'VIDEO'
                        ? `目前還沒有任何 ${providerName} 影片`
                        : '目前還沒有任何媒體'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="mt-4 rounded-lg border-divider text-body hover:bg-surface hover:text-heading"
                    onClick={() => {
                      if (mediaType === 'VIDEO' && !isProviderConfigured) {
                        setShowCloudflareSetupDialog(true)
                        return
                      }
                      setActiveTab('upload')
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {mediaType === 'VIDEO' ? `上傳到 ${providerName}` : '上傳新檔案'}
                  </Button>
                </div>
              ) : (
                <div
                  className={
                    mediaType === 'VIDEO'
                      ? 'grid grid-cols-2 gap-4 md:grid-cols-3'
                      : 'grid grid-cols-3 gap-4 md:grid-cols-4'
                  }
                >
                  {mediaData?.media.map((media) =>
                    mediaType === 'VIDEO' ? (
                      <VideoCard
                        key={media.id}
                        video={media}
                        selectable
                        selected={selectedMedia?.id === media.id}
                        onSelect={handleSelect}
                        streamCustomerCode={streamCustomerCode}
                      />
                    ) : (
                      <ImageCard
                        key={media.id}
                        image={media}
                        selectable
                        selected={selectedMedia?.id === media.id}
                        onSelect={handleSelect}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="mt-4 flex-1 overflow-y-auto">
            {isVideoMode ? (
              isProviderConfigured ? (
                <VideoUpload provider={provider} onUploadComplete={handleUploadComplete} />
              ) : (
                <CloudflareStreamSetupPrompt
                  description="影片媒體庫只收錄 Cloudflare Stream 影片。若單元要使用 YouTube，請回到課程單元直接貼上網址。"
                  onOpenSetup={() => setShowCloudflareSetupDialog(true)}
                />
              )
            ) : (
              <ImageUpload onUploadComplete={handleUploadComplete} />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border-divider text-body hover:bg-surface hover:text-heading"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedMedia}
            className="rounded-lg bg-cta text-white hover:bg-cta-hover"
          >
            確認選取
          </Button>
        </DialogFooter>

        <CloudflareStreamSetupDialog
          open={showCloudflareSetupDialog}
          onOpenChange={setShowCloudflareSetupDialog}
        />
      </DialogContent>
    </Dialog>
  )
}
