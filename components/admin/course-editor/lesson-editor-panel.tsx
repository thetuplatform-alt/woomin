'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { Media } from '@prisma/client'
import { useCourseEditor } from '@/lib/contexts/course-editor-context'
import { updateLesson } from '@/lib/actions/curriculum'
import { getMediaById, getMediaByCfStreamId } from '@/lib/actions/media'
import { resolveMediaPickerSelection } from '@/lib/video-source'
import { MediaPicker } from '@/components/admin/media/media-picker'
import { VideoUpload } from '@/components/admin/media/video-upload'
import {
  CloudflareStreamSetupDialog,
  CloudflareStreamSetupPrompt,
} from '@/components/admin/media/cloudflare-stream-setup-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AINotesDialog } from '@/components/admin/course-editor/ai-notes-dialog'
import {
  getVimeoWatchUrl,
  getYouTubeEmbedUrl,
  parseVimeoVideoSource,
  parseYouTubeVideoId,
} from '@/lib/video-source'
import {
  Video,
  Upload,
  FolderOpen,
  Play,
  Trash2,
  FileText,
  Loader2,
  Save,
  Sparkles,
  FolderUp,
  Plus,
  Link2,
} from 'lucide-react'
import { UnifiedVideoPlayer } from '@/components/main/player/unified-video-player'
import { getVideoCaptionNotice } from '@/lib/video-caption-support'

// 動態載入 Milkdown 編輯器（1MB+ ProseMirror 生態）：未選取單元前不付下載/解析成本，
// 三欄編輯器外殼可即時互動。
const MilkdownMarkdownEditor = dynamic(
  () => import('@/components/admin/curriculum/milkdown-editor').then((m) => m.MilkdownMarkdownEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-caption">
        編輯器載入中…
      </div>
    ),
  }
)

type EditorVideoProvider = 'youtube' | 'cloudflare' | 'vimeo' | 'bunny' | null

interface LessonVideoState {
  provider: EditorVideoProvider
  sourceId: string | null
  url: string | null
  thumbnail: string | null
  duration: number | null
  legacyVideoId: string | null
}

interface LessonSubtitleState {
  url: string | null
  lang: string
  label: string
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface">
        <FileText className="h-10 w-10 text-[#D4D4D4]" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-heading">請先選擇單元</h3>
      <p className="mb-8 max-w-sm text-sm text-body">
        從左側大綱選一個單元後，就能設定影片、編輯內容與調整這個單元的狀態。
      </p>

      <div className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent('open-batch-dialog'))
          }
          className="group flex flex-col items-start gap-3 rounded-xl border border-divider bg-white p-5 text-left transition-all hover:border-cta hover:shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cta/10">
            <FolderUp className="h-5 w-5 text-cta" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-heading transition-colors group-hover:text-cta">
              批次建立單元
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-caption">
              上傳多支影片或批次建立課程大綱，系統會協助你快速建立章節與單元。
            </p>
          </div>
        </button>

        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent('open-chapter-dialog'))
          }
          className="group flex flex-col items-start gap-3 rounded-xl border border-divider bg-white p-5 text-left transition-all hover:border-cta hover:shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
            <Plus className="h-5 w-5 text-body" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-heading transition-colors group-hover:text-cta">
              新增章節與單元
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-caption">
              如果想從零開始編排課程，可以先新增章節，再加入單元與內容。
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}

interface VideoSectionProps {
  value: LessonVideoState
  onChange: (next: LessonVideoState) => void
  streamCustomerCode?: string
  title: string
  isCloudflareStreamConfigured: boolean
}

function VideoSection({
  value,
  onChange,
  streamCustomerCode,
  title,
  isCloudflareStreamConfigured,
}: VideoSectionProps) {
  const [showUploader, setShowUploader] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [youtubeInput, setYoutubeInput] = useState(value.url ?? value.sourceId ?? '')
  const [youtubeError, setYoutubeError] = useState<string | null>(null)
  const [vimeoInput, setVimeoInput] = useState(value.url ?? value.sourceId ?? '')
  const [vimeoError, setVimeoError] = useState<string | null>(null)
  const [isPollingDuration, setIsPollingDuration] = useState(false)
  const [showCloudflareSetupDialog, setShowCloudflareSetupDialog] = useState(false)
  const pollAbortRef = useRef(false)
  const isPollingRef = useRef(false)
  const mediaIdRef = useRef<string | null>(null)

  const pollForDuration = useCallback(
    async (mediaId: string, cfStreamId: string) => {
      if (isPollingRef.current) return

      isPollingRef.current = true
      pollAbortRef.current = false
      setIsPollingDuration(true)

      try {
        for (let attempt = 0; attempt < 60; attempt++) {
          if (pollAbortRef.current) break

          const response = await fetch(`/api/admin/media/${mediaId}/status`)
          const data = await response.json()

          if (data.success && data.media?.duration && data.media.duration > 0) {
            onChange({
              provider: 'cloudflare',
              sourceId: cfStreamId,
              url: null,
              thumbnail: data.media.thumbnail ?? null,
              duration: data.media.duration,
              legacyVideoId: cfStreamId,
            })
            return
          }

          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      } catch (error) {
        console.error('輪詢影片長度失敗:', error)
      } finally {
        setIsPollingDuration(false)
        isPollingRef.current = false
      }
    },
    [onChange]
  )

  useEffect(() => {
    if (value.provider === 'youtube') {
      setYoutubeInput(value.url ?? value.sourceId ?? '')
    }
  }, [value.provider, value.sourceId, value.url])

  useEffect(() => {
    if (value.provider === 'vimeo') {
      setVimeoInput(value.url ?? value.sourceId ?? '')
    }
  }, [value.provider, value.sourceId, value.url])

  useEffect(() => {
    if (
      value.provider !== 'cloudflare' ||
      !value.sourceId ||
      (value.duration && value.duration > 0) ||
      isPollingRef.current
    ) {
      return
    }

    const sourceId = value.sourceId

    const startPolling = async () => {
      if (mediaIdRef.current) {
        pollForDuration(mediaIdRef.current, sourceId)
        return
      }

      try {
        const media = await getMediaByCfStreamId(sourceId)
        if (media) {
          mediaIdRef.current = media.id
          if (media.duration && media.duration > 0) {
            onChange({
              ...value,
              provider: 'cloudflare',
              sourceId,
              duration: media.duration,
              legacyVideoId: sourceId,
            })
          } else {
            pollForDuration(media.id, sourceId)
          }
        }
      } catch {
        // ignore transient lookup failures
      }
    }

    startPolling()
  }, [onChange, pollForDuration, value])

  useEffect(() => {
    return () => {
      pollAbortRef.current = true
    }
  }, [])

  const handleProviderChange = (provider: Exclude<EditorVideoProvider, null>) => {
    setYoutubeError(null)
    setVimeoError(null)
    if (provider === 'youtube') {
      onChange({
        provider: 'youtube',
        sourceId: null,
        url: null,
        thumbnail: null,
        duration: null,
        legacyVideoId: null,
      })
      setShowUploader(false)
      setShowPicker(false)
      return
    }

    if (provider === 'vimeo') {
      onChange({
        provider: 'vimeo',
        sourceId: null,
        url: null,
        thumbnail: null,
        duration: null,
        legacyVideoId: null,
      })
      setShowUploader(false)
      setShowPicker(false)
      return
    }

    if (provider === 'bunny') {
      onChange({
        provider: 'bunny',
        sourceId: null,
        url: null,
        thumbnail: null,
        duration: null,
        legacyVideoId: null,
      })
      setShowUploader(false)
      setShowPicker(false)
      return
    }

    onChange({
      provider: 'cloudflare',
      sourceId: null,
      url: null,
      thumbnail: null,
      duration: null,
      legacyVideoId: null,
    })
  }

  const handleYouTubeApply = () => {
    const videoId = parseYouTubeVideoId(youtubeInput)
    if (!videoId) {
      setYoutubeError('請貼上有效的 YouTube 影片網址或 11 碼影片 ID')
      return
    }

    setYoutubeError(null)
    onChange({
      provider: 'youtube',
      sourceId: videoId,
      url: getYouTubeEmbedUrl(videoId),
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: null,
      legacyVideoId: null,
    })
  }

  const handleVimeoApply = () => {
    const video = parseVimeoVideoSource(vimeoInput)
    if (!video) {
      setVimeoError('請貼上有效的 Vimeo 影片網址或影片 ID')
      return
    }

    setVimeoError(null)
    onChange({
      provider: 'vimeo',
      sourceId: video.id,
      url: video.url,
      thumbnail: null,
      duration: null,
      legacyVideoId: null,
    })
  }

  const handleSelectFromLibrary = (media: Media): boolean => {
    const provider = value.provider === 'bunny' ? 'bunny' : 'cloudflare'
    const selection = resolveMediaPickerSelection(
      { bunnyVideoId: media.bunnyVideoId, cfStreamId: media.cfStreamId },
      provider
    )

    if (!selection.accepted) {
      toast.error(selection.error)
      return false
    }

    if (provider === 'bunny') {
      onChange({
        provider: 'bunny',
        sourceId: selection.sourceId,
        url: null,
        thumbnail: media.thumbnail ?? null,
        duration: media.duration ?? null,
        legacyVideoId: null,
      })
      return true
    }

    mediaIdRef.current = media.id
    onChange({
      provider: 'cloudflare',
      sourceId: selection.sourceId,
      url: null,
      thumbnail: media.thumbnail ?? null,
      duration: media.duration ?? null,
      legacyVideoId: selection.sourceId,
    })

    if (!media.duration) {
      pollForDuration(media.id, selection.sourceId)
    }
    return true
  }

  const handleUploadComplete = async (uploadResult: {
    id: string
    uid: string
    originalName: string
  }) => {
    const media = await getMediaById(uploadResult.id)
    if (media?.bunnyVideoId) {
      mediaIdRef.current = media.id
      onChange({
        provider: 'bunny',
        sourceId: media.bunnyVideoId,
        url: null,
        thumbnail: media.thumbnail ?? null,
        duration: media.duration ?? null,
        legacyVideoId: null,
      })
      setShowUploader(false)
      return
    }

    if (media?.cfStreamId) {
      mediaIdRef.current = media.id
      onChange({
        provider: 'cloudflare',
        sourceId: media.cfStreamId,
        url: null,
        thumbnail: media.thumbnail ?? null,
        duration: media.duration ?? null,
        legacyVideoId: media.cfStreamId,
      })

      if (!media.duration) {
        pollForDuration(media.id, media.cfStreamId)
      }
    }
    setShowUploader(false)
  }

  const handleRemoveVideo = () => {
    setYoutubeInput('')
    setYoutubeError(null)
    setVimeoInput('')
    setVimeoError(null)
    onChange({
      provider: null,
      sourceId: null,
      url: null,
      thumbnail: null,
      duration: null,
      legacyVideoId: null,
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const effectiveSourceId = value.sourceId ?? value.legacyVideoId
  const previewVideo = value.provider && effectiveSourceId
  const vimeoPreviewSource =
    value.provider === 'vimeo' && effectiveSourceId
      ? parseVimeoVideoSource(value.url ?? effectiveSourceId)
      : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-heading">影片設定</h3>
        {previewVideo && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleRemoveVideo}
            className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            移除影片
          </Button>
        )}
      </div>

      <label className="space-y-2" data-tour="video-provider-select">
        <span className="text-sm font-medium text-heading">影片來源</span>
        <select
          aria-label="影片來源"
          className="w-full rounded-md border border-divider bg-white px-3 py-2 text-sm"
          value={value.provider ?? ''}
          onChange={(event) => handleProviderChange(event.target.value as Exclude<EditorVideoProvider, null>)}
        >
          <option value="">請選擇影片來源</option>
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
          <option value="cloudflare">Cloudflare Stream</option>
          <option value="bunny">Bunny Stream</option>
        </select>
      </label>
      <div className="hidden" data-tour="video-provider-cards">
        <button
          type="button"
          onClick={() => handleProviderChange('youtube')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            value.provider === 'youtube'
              ? 'border-cta bg-cta/5'
              : 'border-divider bg-white hover:border-cta/50'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <Play className="h-4 w-4 text-cta" />
            <span className="text-sm font-medium text-heading">YouTube</span>
          </div>
          <p className="text-xs text-caption">
            最快上線。直接貼網址即可使用，不會進入媒體中心。
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleProviderChange('vimeo')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            value.provider === 'vimeo'
              ? 'border-cta bg-cta/5'
              : 'border-divider bg-white hover:border-cta/50'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <Play className="h-4 w-4 text-cta" />
            <span className="text-sm font-medium text-heading">Vimeo</span>
          </div>
          <p className="text-xs text-caption">
            直接貼 Vimeo 網址，適合已把影片託管在 Vimeo 的課程。
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleProviderChange('cloudflare')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            value.provider === 'cloudflare'
              ? 'border-cta bg-cta/5'
              : 'border-divider bg-white hover:border-cta/50'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <Video className="h-4 w-4 text-cta" />
            <span className="text-sm font-medium text-heading">
              Cloudflare Stream
            </span>
          </div>
          <p className="text-xs text-caption">
            可受保護播放，並會出現在媒體中心供其他單元重複使用。
          </p>
        </button>
      </div>

      {value.provider === 'youtube' && (
        <div className="space-y-3 rounded-xl border border-divider bg-white p-4">
          <div className="space-y-2">
            <Label htmlFor="youtube-input" className="text-xs text-body">
              YouTube 網址或影片 ID
            </Label>
            <p className="text-xs text-caption">
              適合快速上線。這類影片只綁定在目前單元，不會建立媒體庫項目。
            </p>
            <div className="flex gap-2">
              <Input
                id="youtube-input"
                value={youtubeInput}
                onChange={(event) => setYoutubeInput(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="bg-white"
              />
              <Button onClick={handleYouTubeApply} type="button">
                套用
              </Button>
            </div>
            {youtubeError && (
              <p className="text-xs text-red-500">{youtubeError}</p>
            )}
          </div>

          {effectiveSourceId ? (
            <div className="space-y-3">
              <div className="aspect-video overflow-hidden rounded-lg bg-black">
                <UnifiedVideoPlayer
                  videoProvider="youtube"
                  videoSourceId={effectiveSourceId}
                  title={title}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-body">
                <Link2 className="h-3 w-3" />
                <span>YouTube ID: {effectiveSourceId}</span>
              </div>
              <p className="text-xs text-amber-700">{getVideoCaptionNotice('youtube')}</p>
            </div>
          ) : null}
        </div>
      )}

      {value.provider === 'vimeo' && (
        <div className="space-y-3 rounded-xl border border-divider bg-white p-4">
          <div className="space-y-2">
            <Label htmlFor="vimeo-input" className="text-xs text-body">
              Vimeo 網址或影片 ID
            </Label>
            <p className="text-xs text-caption">
              若 Vimeo 影片是 Unlisted，請貼上含有 h 參數的完整網址，系統會保留播放所需資訊。
            </p>
            <div className="flex gap-2">
              <Input
                id="vimeo-input"
                value={vimeoInput}
                onChange={(event) => setVimeoInput(event.target.value)}
                placeholder="https://vimeo.com/123456789?h=..."
                className="bg-white"
              />
              <Button onClick={handleVimeoApply} type="button">
                套用
              </Button>
            </div>
            {vimeoError && (
              <p className="text-xs text-red-500">{vimeoError}</p>
            )}
          </div>

          {effectiveSourceId ? (
            <div className="space-y-3">
              <div className="aspect-video overflow-hidden rounded-lg bg-black">
                <UnifiedVideoPlayer
                  videoProvider="vimeo"
                  videoSourceId={effectiveSourceId}
                  title={title}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-body">
                <Link2 className="h-3 w-3" />
                <a
                  href={
                    vimeoPreviewSource
                      ? getVimeoWatchUrl(
                          vimeoPreviewSource.id,
                          vimeoPreviewSource.hash
                        )
                      : getVimeoWatchUrl(effectiveSourceId)
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="truncate underline underline-offset-2"
                >
                  Vimeo ID: {effectiveSourceId}
                </a>
              </div>
              <p className="text-xs text-amber-700">{getVideoCaptionNotice('vimeo')}</p>
            </div>
          ) : null}
        </div>
      )}

      {value.provider === 'cloudflare' && (
        <div className="space-y-3">
          {effectiveSourceId ? (
            <div className="space-y-3">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                {isPollingDuration || (!value.duration || value.duration <= 0) ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-heading">
                    <Loader2 className="mb-3 h-10 w-10 animate-spin text-cta" />
                    <p className="text-sm text-white">影片處理中...</p>
                    <p className="mt-1 text-xs text-caption">
                      Cloudflare 轉檔完成後會自動顯示預覽
                    </p>
                  </div>
                ) : (
                  <UnifiedVideoPlayer
                    videoProvider="cloudflare"
                    videoSourceId={effectiveSourceId}
                    title={title}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-body">
                <div className="flex items-center gap-1">
                  <Video className="h-3 w-3" />
                  <span>影片 ID: {effectiveSourceId.slice(0, 8)}...</span>
                </div>
                {formatDuration(value.duration) ? (
                  <div className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    <span>長度: {formatDuration(value.duration)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-cta">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>正在取得長度...</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {!isCloudflareStreamConfigured ? (
                <CloudflareStreamSetupPrompt
                  description="要使用 Cloudflare Stream 作為課程影片來源，請先完成 Cloudflare Stream 設定，再回來上傳影片或從媒體中心選取。YouTube 影片則可直接在這個單元貼上網址。"
                  onOpenSetup={() => setShowCloudflareSetupDialog(true)}
                />
              ) : showUploader ? (
                <div className="space-y-3">
                  <VideoUpload onUploadComplete={handleUploadComplete} />
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setShowUploader(false)}
                    className="text-xs text-body"
                  >
                    取消上傳
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setShowUploader(true)}
                    className="flex h-20 flex-1 flex-col gap-2 border-dashed border-divider text-body hover:border-cta hover:bg-surface hover:text-heading"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-xs">上傳到 Cloudflare</span>
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="flex h-20 flex-1 flex-col gap-2 border-dashed border-divider text-body hover:border-cta hover:bg-surface hover:text-heading"
                  >
                    <FolderOpen className="h-5 w-5" />
                    <span className="text-xs">從 Cloudflare 影片庫選擇</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {value.provider === 'bunny' && (
        <div className="space-y-3 rounded-xl border border-divider bg-white p-4">
          {showUploader ? (
            <div className="space-y-3">
              <VideoUpload provider="bunny" onUploadComplete={handleUploadComplete} />
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowUploader(false)} className="text-xs text-body">取消上傳</Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={() => setShowUploader(true)} className="flex h-20 flex-1 flex-col gap-2 border-dashed border-divider">
                <Upload className="h-5 w-5" /><span className="text-xs">上傳到 Bunny</span>
              </Button>
              <Button variant="outline" type="button" onClick={() => setShowPicker(true)} className="flex h-20 flex-1 flex-col gap-2 border-dashed border-divider">
                <FolderOpen className="h-5 w-5" /><span className="text-xs">從 Bunny 影片庫選擇</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {value.provider === 'bunny' && effectiveSourceId && (
        <div className="space-y-3 rounded-xl border border-divider bg-white p-4">
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <UnifiedVideoPlayer
              videoProvider="bunny"
              videoSourceId={effectiveSourceId}
              title={title}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-body">
            <Video className="h-3 w-3" />
            <span>Bunny Video ID: {effectiveSourceId}</span>
          </div>
          <p className="text-xs text-amber-700">{getVideoCaptionNotice('bunny')}</p>
        </div>
      )}

      <MediaPicker
        open={showPicker}
        onOpenChange={setShowPicker}
        onSelect={handleSelectFromLibrary}
        type="VIDEO"
        title="選擇影片"
        provider={value.provider === 'bunny' ? 'bunny' : 'cloudflare'}
        description={`從既有 ${value.provider === 'bunny' ? 'Bunny' : 'Cloudflare Stream'} 影片庫中挑選一支影片綁定到這個單元。若要使用 YouTube 或 Vimeo，請回到上一層直接貼上網址。`}
        streamCustomerCode={streamCustomerCode}
        isCloudflareStreamConfigured={isCloudflareStreamConfigured}
      />
      <CloudflareStreamSetupDialog
        open={showCloudflareSetupDialog}
        onOpenChange={setShowCloudflareSetupDialog}
      />
    </div>
  )
}

function mapLessonVideo(selectedLesson: {
  videoProvider: string | null
  videoSourceId: string | null
  videoUrl: string | null
  videoThumbnail: string | null
  videoId: string | null
  videoDuration: number | null
}): LessonVideoState {
  const provider =
    selectedLesson.videoProvider?.toLowerCase() === 'youtube'
      ? 'youtube'
      : selectedLesson.videoProvider?.toLowerCase() === 'cloudflare'
        ? 'cloudflare'
        : selectedLesson.videoProvider?.toLowerCase() === 'vimeo'
          ? 'vimeo'
          : selectedLesson.videoProvider?.toLowerCase() === 'bunny'
            ? 'bunny'
          : selectedLesson.videoId
            ? 'cloudflare'
            : null

  return {
    provider,
    sourceId: selectedLesson.videoSourceId ?? selectedLesson.videoId ?? null,
    url: selectedLesson.videoUrl ?? null,
    thumbnail: selectedLesson.videoThumbnail ?? null,
    duration: selectedLesson.videoDuration ?? null,
    legacyVideoId: selectedLesson.videoId ?? null,
  }
}

function SubtitleSection({
  lessonId,
  provider,
  value,
  onChange,
}: {
  lessonId: string
  provider: EditorVideoProvider
  value: LessonSubtitleState
  onChange: (value: LessonSubtitleState) => void
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setError(null)
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('lang', value.lang)
      formData.append('label', value.label)
      const response = await fetch(`/api/admin/lessons/${lessonId}/subtitle`, { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(result.error || '字幕上傳失敗')
        return
      }
      onChange({
        url: result.subtitle.subtitleUrl,
        lang: result.subtitle.subtitleLang,
        label: result.subtitle.subtitleLabel,
      })
      toast.success('字幕已上傳')
    } catch {
      setError('字幕上傳失敗')
    } finally {
      setIsUploading(false)
    }
  }

  const remove = async () => {
    setError(null)
    const response = await fetch(`/api/admin/lessons/${lessonId}/subtitle`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok || !result.success) {
      setError(result.error || '移除字幕失敗')
      return
    }
    onChange({ url: null, lang: 'zh-TW', label: '繁體中文' })
    toast.success('字幕已移除')
  }

  return (
    <div className="space-y-3 rounded-xl border border-divider bg-white p-4">
      <div>
        <h3 className="text-sm font-medium text-heading">自訂字幕</h3>
        <p className="mt-1 text-xs text-caption">接受 .vtt 或 .srt，檔案上限 5MB。</p>
      </div>
      {provider === 'bunny' ? (
        <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">Bunny 目前不支援自訂字幕，因為影片使用嵌入播放器。</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-body">語言代碼<Input value={value.lang} onChange={(event) => onChange({ ...value, lang: event.target.value })} placeholder="zh-TW" /></label>
            <label className="space-y-1 text-xs text-body">顯示名稱<Input value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} placeholder="繁體中文" /></label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-dashed border-divider px-3 py-2 text-xs text-body hover:border-cta">
              <Upload className="mr-2 h-4 w-4" />{isUploading ? '上傳中…' : '選擇字幕檔'}
              <input type="file" accept=".vtt,.srt,text/vtt,application/x-subrip" className="sr-only" disabled={isUploading} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void upload(file) }} />
            </label>
            {value.url ? <><a href={value.url} target="_blank" rel="noreferrer" className="text-xs text-cta underline">目前字幕檔</a><Button type="button" variant="ghost" size="sm" onClick={() => void remove()} className="text-xs text-red-500">移除</Button></> : null}
          </div>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
        </>
      )}
    </div>
  )
}

interface LessonEditorPanelProps {
  streamCustomerCode?: string
  isGeminiConfigured?: boolean
  isCloudflareStreamConfigured?: boolean
}

export function LessonEditorPanel({
  streamCustomerCode,
  isGeminiConfigured = false,
  isCloudflareStreamConfigured = false,
}: LessonEditorPanelProps) {
  const {
    selectedLesson,
    selectedLessonId,
    course,
    updateLessonInCurriculum,
    setIsDirty,
  } = useCourseEditor()
  const [isPending, startTransition] = useTransition()
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [video, setVideo] = useState<LessonVideoState>({
    provider: null,
    sourceId: null,
    url: null,
    thumbnail: null,
    duration: null,
    legacyVideoId: null,
  })
  const [content, setContent] = useState('')
  const [subtitle, setSubtitle] = useState<LessonSubtitleState>({ url: null, lang: 'zh-TW', label: '繁體中文' })
  const prevLessonIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (selectedLessonId !== prevLessonIdRef.current) {
      prevLessonIdRef.current = selectedLessonId

      if (selectedLesson) {
        setVideo(mapLessonVideo(selectedLesson))
        setContent(selectedLesson.content ?? '')
        setSubtitle({ url: selectedLesson.subtitleUrl, lang: selectedLesson.subtitleLang ?? 'zh-TW', label: selectedLesson.subtitleLabel ?? '繁體中文' })
      } else {
        setVideo({
          provider: null,
          sourceId: null,
          url: null,
          thumbnail: null,
          duration: null,
          legacyVideoId: null,
        })
        setContent('')
        setSubtitle({ url: null, lang: 'zh-TW', label: '繁體中文' })
      }
    }
  }, [selectedLesson, selectedLessonId])

  const handleVideoChange = (next: LessonVideoState) => {
    setVideo(next)
    setIsDirty(true)

    if (!selectedLessonId) return

    updateLessonInCurriculum(selectedLessonId, {
      videoProvider: next.provider?.toUpperCase() as 'YOUTUBE' | 'CLOUDFLARE' | 'VIMEO' | 'BUNNY' | undefined,
      videoSourceId: next.sourceId,
      videoUrl: next.url,
      videoThumbnail: next.thumbnail,
      videoId: next.legacyVideoId,
        videoDuration: next.duration,
        subtitleUrl: subtitle.url,
        subtitleLang: subtitle.lang,
        subtitleLabel: subtitle.label,
    })
  }

  const handleSave = () => {
    if (!selectedLesson) return

    if (video.provider === 'vimeo' && !video.sourceId) {
      toast.error('請先套用有效的 Vimeo 影片網址，或使用移除影片清空影片設定')
      return
    }

    startTransition(async () => {
      const result = await updateLesson(selectedLesson.id, {
        title: selectedLesson.title,
        videoProvider: video.provider ?? undefined,
        videoSourceId: video.sourceId ?? undefined,
        videoUrl: video.url ?? undefined,
        videoThumbnail: video.thumbnail ?? undefined,
        videoId: video.legacyVideoId ?? undefined,
        videoDuration: video.duration ?? undefined,
        subtitleUrl: subtitle.url,
        subtitleLang: subtitle.lang,
        subtitleLabel: subtitle.label,
        content: content || undefined,
        isFree: selectedLesson.isFree,
        status: selectedLesson.status as 'PUBLISHED' | 'COMING_SOON',
        comingSoonTitle: selectedLesson.comingSoonTitle ?? undefined,
        comingSoonDescription: selectedLesson.comingSoonDescription ?? undefined,
        comingSoonImage: selectedLesson.comingSoonImage ?? undefined,
        comingSoonDate: selectedLesson.comingSoonDate ?? undefined,
      })

      if (result.success && result.lesson) {
        updateLessonInCurriculum(selectedLesson.id, {
          videoProvider: result.lesson.videoProvider,
          videoSourceId: result.lesson.videoSourceId,
          videoUrl: result.lesson.videoUrl,
          videoThumbnail: result.lesson.videoThumbnail,
          videoId: result.lesson.videoId,
          videoDuration: result.lesson.videoDuration,
          content: result.lesson.content,
          subtitleUrl: result.lesson.subtitleUrl,
          subtitleLang: result.lesson.subtitleLang,
          subtitleLabel: result.lesson.subtitleLabel,
        })
        setIsDirty(false)
        toast.success('單元已儲存')
      } else {
        toast.error(result.error ?? '儲存失敗')
      }
    })
  }

  if (!selectedLesson) {
    return <EmptyState />
  }

  const aiSupportedVideoId =
    video.provider === 'cloudflare' ? video.sourceId ?? video.legacyVideoId : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-divider bg-white px-6 py-4">
        <div>
          <h2 className="text-lg font-medium text-heading">
            {selectedLesson.title}
          </h2>
          <p className="mt-0.5 text-xs text-caption">編輯單元影片與內容</p>
        </div>
        <Button
          data-tour="save-lesson-btn"
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="bg-cta text-white hover:bg-cta-hover"
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          儲存變更
        </Button>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        <VideoSection
          value={video}
          onChange={handleVideoChange}
          streamCustomerCode={streamCustomerCode}
          title={selectedLesson.title}
          isCloudflareStreamConfigured={isCloudflareStreamConfigured}
        />

        <SubtitleSection
          lessonId={selectedLesson.id}
          provider={video.provider}
          value={subtitle}
          onChange={(next) => {
            setSubtitle(next)
            setIsDirty(true)
            updateLessonInCurriculum(selectedLesson.id, {
              subtitleUrl: next.url,
              subtitleLang: next.lang,
              subtitleLabel: next.label,
            })
          }}
        />

        <div className="border-t border-divider" />

        <div className="space-y-4" data-tour="lesson-content-editor">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-heading">單元內容</h3>
              {video.provider && video.provider !== 'cloudflare' && (
                <p className="mt-1 text-xs text-caption">
                  AI 講義目前只支援 Cloudflare Stream 影片或手動上傳 SRT。
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAiDialogOpen(true)}
              className="h-7 border-cta/30 text-xs text-cta hover:bg-cta/10 hover:text-cta-hover"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI 生成講義
            </Button>
          </div>
          <MilkdownMarkdownEditor
            value={content}
            onChange={(nextContent) => {
              setContent(nextContent)
              setIsDirty(true)
            }}
            placeholder="撰寫這個單元的內容..."
            editorKey={selectedLesson.id}
            mediaSourceId={selectedLesson.id}
            mediaSourceUrl={course ? `/admin/courses/${course.id}/curriculum` : undefined}
          />
        </div>
      </div>

      <AINotesDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        videoId={aiSupportedVideoId}
        isApiKeyConfigured={isGeminiConfigured}
        onGenerated={(generatedContent) => {
          setContent(generatedContent)
          setIsDirty(true)
        }}
      />
    </div>
  )
}
