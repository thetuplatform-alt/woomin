// components/admin/course-editor/settings-preview-panel.tsx
// 課程內容頁面的右側設定與預覽面板
// Tab 切換：編輯設定 / 預覽模式

'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Streamdown } from 'streamdown'
import type { Media } from '@prisma/client'
import { UnifiedVideoPlayer } from '@/components/main/player/unified-video-player'
import { useCourseEditor } from '@/lib/contexts/course-editor-context'
import { updateLesson } from '@/lib/actions/curriculum'
import { MediaPicker } from '@/components/admin/media/media-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  Settings,
  Eye,
  FileText,
  CalendarIcon,
  Image as ImageIcon,
  Loader2,
  Save,
  Clock,
  FileQuestion,
  ClipboardCheck,
} from 'lucide-react'

function DeferredEditorLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-24 items-center justify-center text-sm text-caption"
    >
      {label}…
    </div>
  )
}

const DeferredQuizEditor = dynamic(
  () => import('@/components/admin/quiz/quiz-editor').then((m) => m.QuizEditor),
  {
    ssr: false,
    loading: () => <DeferredEditorLoading label="正在載入測驗編輯器" />,
  }
)

const DeferredAssignmentEditor = dynamic(
  () => import('@/components/admin/assignment/assignment-editor').then((m) => m.AssignmentEditor),
  {
    ssr: false,
    loading: () => <DeferredEditorLoading label="正在載入作業編輯器" />,
  }
)

// ==================== Empty State ====================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <Settings className="h-8 w-8 text-[#D4D4D4] mb-3" />
      <p className="text-sm text-body">選擇一個單元來編輯設定</p>
    </div>
  )
}

// ==================== Preview Panel ====================

interface PreviewPanelProps {
  videoProvider: 'youtube' | 'cloudflare' | 'vimeo' | 'bunny' | null
  videoSourceId: string | null
  videoId: string | null
  content: string | null
  title: string
}

function PreviewPanel({
  videoProvider,
  videoSourceId,
  videoId,
  content,
  title,
}: PreviewPanelProps) {
  const effectiveVideoId = videoSourceId ?? videoId

  return (
    <div className="h-full overflow-y-auto">
      {/* 影片預覽 */}
      <div className="aspect-video bg-black">
        {effectiveVideoId && videoProvider ? (
            <UnifiedVideoPlayer
              videoProvider={videoProvider}
              videoSourceId={effectiveVideoId}
              title={title}
            />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white/60">
              <FileText className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">尚無影片</p>
            </div>
          </div>
        )}
      </div>

      {/* 內容預覽 */}
      <div className="p-4">
        <h2 className="text-lg font-bold text-heading mb-4">{title}</h2>
        {content ? (
          <div className="prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-cta prose-strong:text-heading prose-code:text-cta prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface prose-blockquote:border-divider prose-blockquote:text-body prose-li:text-body">
            <Streamdown>{content}</Streamdown>
          </div>
        ) : (
          <p className="text-sm text-caption">尚無內容</p>
        )}
      </div>
    </div>
  )
}

// ==================== Settings Panel ====================

interface SettingsPanelProps {
  streamCustomerCode?: string
}

function SettingsPanel({ streamCustomerCode }: SettingsPanelProps) {
  const { selectedLesson, updateLessonInCurriculum, setIsDirty } =
    useCourseEditor()
  const [isPending, startTransition] = useTransition()

  // 本地狀態
  const [title, setTitle] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [status, setStatus] = useState<'PUBLISHED' | 'COMING_SOON'>('PUBLISHED')
  const [comingSoonTitle, setComingSoonTitle] = useState('')
  const [comingSoonDescription, setComingSoonDescription] = useState('')
  const [comingSoonImage, setComingSoonImage] = useState('')
  const [comingSoonDate, setComingSoonDate] = useState<Date | undefined>()
  const [imagePickerOpen, setImagePickerOpen] = useState(false)

  // 初始化表單
  useEffect(() => {
    if (selectedLesson) {
      setTitle(selectedLesson.title)
      setIsFree(selectedLesson.isFree)
      setStatus(
        (selectedLesson.status as 'PUBLISHED' | 'COMING_SOON') ?? 'PUBLISHED'
      )
      setComingSoonTitle(selectedLesson.comingSoonTitle ?? '')
      setComingSoonDescription(selectedLesson.comingSoonDescription ?? '')
      setComingSoonImage(selectedLesson.comingSoonImage ?? '')
      setComingSoonDate(
        selectedLesson.comingSoonDate
          ? new Date(selectedLesson.comingSoonDate)
          : undefined
      )
    }
  }, [selectedLesson])

  // 儲存設定
  const handleSave = useCallback(() => {
    if (!selectedLesson) return

    startTransition(async () => {
      const result = await updateLesson(selectedLesson.id, {
        title,
        isFree,
        status,
        comingSoonTitle: comingSoonTitle || undefined,
        comingSoonDescription: comingSoonDescription || undefined,
        comingSoonImage: comingSoonImage || undefined,
        comingSoonDate: comingSoonDate ?? undefined,
        videoId: selectedLesson.videoId ?? undefined,
        videoProvider:
          selectedLesson.videoProvider?.toLowerCase() === 'youtube'
            ? 'youtube'
            : selectedLesson.videoProvider?.toLowerCase() === 'cloudflare'
              ? 'cloudflare'
              : selectedLesson.videoProvider?.toLowerCase() === 'vimeo'
                ? 'vimeo'
                : selectedLesson.videoProvider?.toLowerCase() === 'bunny'
                  ? 'bunny'
                : undefined,
        videoSourceId: selectedLesson.videoSourceId ?? undefined,
        videoUrl: selectedLesson.videoUrl ?? undefined,
        videoThumbnail: selectedLesson.videoThumbnail ?? undefined,
        videoDuration: selectedLesson.videoDuration ?? undefined,
        content: selectedLesson.content ?? undefined,
      })

      if (result.success && result.lesson) {
        updateLessonInCurriculum(selectedLesson.id, {
          title: result.lesson.title,
          isFree: result.lesson.isFree,
          status: result.lesson.status,
          comingSoonTitle: result.lesson.comingSoonTitle,
          comingSoonDescription: result.lesson.comingSoonDescription,
          comingSoonImage: result.lesson.comingSoonImage,
          comingSoonDate: result.lesson.comingSoonDate,
        })
        setIsDirty(false)
        toast.success('設定已儲存')
      } else {
        toast.error(result.error ?? '儲存失敗')
      }
    })
  }, [
    selectedLesson,
    title,
    isFree,
    status,
    comingSoonTitle,
    comingSoonDescription,
    comingSoonImage,
    comingSoonDate,
    updateLessonInCurriculum,
    setIsDirty,
  ])

  // 處理圖片選擇
  const handleImageSelect = (media: Media) => {
    setComingSoonImage(media.url)
    setIsDirty(true)
  }

  if (!selectedLesson) {
    return <EmptyState />
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <h3 className="text-sm font-medium text-heading">單元設定</h3>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="h-7 bg-cta hover:bg-cta-hover text-white text-xs"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Save className="h-3 w-3 mr-1" />
          )}
          儲存
        </Button>
      </div>

      {/* 設定表單 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 標題 */}
        <div className="space-y-2">
          <Label className="text-xs text-body">單元標題</Label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setIsDirty(true)
            }}
            placeholder="輸入單元標題"
            className="h-9 text-sm bg-white border-divider"
          />
        </div>

        {/* 試閱開關 */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label className="text-xs text-heading">免費試閱</Label>
            <p className="text-[10px] text-caption">
              未購買者可觀看此單元
            </p>
          </div>
          <Switch
            checked={isFree}
            onCheckedChange={(checked) => {
              setIsFree(checked)
              setIsDirty(true)
            }}
          />
        </div>

        {/* 狀態選擇 */}
        <div className="space-y-2">
          <Label className="text-xs text-body">發布狀態</Label>
          <Select
            value={status}
            onValueChange={(value: 'PUBLISHED' | 'COMING_SOON') => {
              setStatus(value)
              setIsDirty(true)
            }}
          >
            <SelectTrigger className="h-9 text-sm bg-white border-divider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-divider">
              <SelectItem value="PUBLISHED">已發布</SelectItem>
              <SelectItem value="COMING_SOON">即將上線</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 即將上線設定 */}
        {status === 'COMING_SOON' && (
          <>
            <div className="border-t border-divider pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-cta" />
                <span className="text-xs font-medium text-heading">
                  即將上線設定
                </span>
              </div>

              {/* 彈窗標題 */}
              <div className="space-y-2 mb-4">
                <Label className="text-xs text-body">彈窗標題</Label>
                <Input
                  value={comingSoonTitle}
                  onChange={(e) => {
                    setComingSoonTitle(e.target.value)
                    setIsDirty(true)
                  }}
                  placeholder="即將上線"
                  className="h-9 text-sm bg-white border-divider"
                />
              </div>

              {/* 彈窗描述 */}
              <div className="space-y-2 mb-4">
                <Label className="text-xs text-body">彈窗描述</Label>
                <Textarea
                  value={comingSoonDescription}
                  onChange={(e) => {
                    setComingSoonDescription(e.target.value)
                    setIsDirty(true)
                  }}
                  placeholder="此單元正在製作中..."
                  className="text-sm bg-white border-divider resize-none"
                  rows={3}
                />
              </div>

              {/* 預覽圖片 */}
              <div className="space-y-2 mb-4">
                <Label className="text-xs text-body">預覽圖片</Label>
                {comingSoonImage ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-divider">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={comingSoonImage}
                      alt="Preview"
                      className="object-cover"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setImagePickerOpen(true)}
                      className="absolute bottom-2 right-2 h-7 text-xs"
                    >
                      更換圖片
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setImagePickerOpen(true)}
                    className="w-full h-16 border-dashed border-divider text-body"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    選擇圖片
                  </Button>
                )}
              </div>

              {/* 預計上線日期 */}
              <div className="space-y-2">
                <Label className="text-xs text-body">預計上線日期</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full h-9 justify-start text-left text-sm font-normal border-divider',
                        !comingSoonDate && 'text-caption'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {comingSoonDate
                        ? format(comingSoonDate, 'yyyy/MM/dd', { locale: zhTW })
                        : '選擇日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-divider">
                    <Calendar
                      mode="single"
                      selected={comingSoonDate}
                      onSelect={(date) => {
                        setComingSoonDate(date)
                        setIsDirty(true)
                      }}
                      locale={zhTW}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 圖片選擇器 */}
      <MediaPicker
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        onSelect={handleImageSelect}
        type="IMAGE"
        title="選擇預覽圖片"
        description="選擇一張圖片作為即將上線的預覽"
        streamCustomerCode={streamCustomerCode}
      />
    </div>
  )
}

// ==================== 主元件 ====================

interface SettingsPreviewPanelProps {
  streamCustomerCode?: string
}

export function SettingsPreviewPanel({
  streamCustomerCode,
}: SettingsPreviewPanelProps) {
  const { selectedLesson, course } = useCourseEditor()
  const [activeTab, setActiveTab] = useState<'settings' | 'preview' | 'quiz' | 'assignment'>('settings')

  if (!selectedLesson) {
    return <EmptyState />
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab 切換 */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'settings' | 'preview' | 'quiz' | 'assignment')}
        className="h-full flex flex-col"
      >
        <div className="border-b border-divider">
          <TabsList className="w-full h-10 bg-transparent rounded-none p-0">
            <TabsTrigger
              value="settings"
              data-tour="lesson-settings-tab"
              className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-cta data-[state=active]:bg-transparent data-[state=active]:text-cta text-body text-xs"
            >
              <Settings className="h-3.5 w-3.5 mr-1" />
              編輯
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-cta data-[state=active]:bg-transparent data-[state=active]:text-cta text-body text-xs"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              預覽
            </TabsTrigger>
            <TabsTrigger
              value="quiz"
              className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-cta data-[state=active]:bg-transparent data-[state=active]:text-cta text-body text-xs"
            >
              <FileQuestion className="h-3.5 w-3.5 mr-1" />
              測驗
            </TabsTrigger>
            <TabsTrigger
              value="assignment"
              className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-cta data-[state=active]:bg-transparent data-[state=active]:text-cta text-body text-xs"
            >
              <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
              作業
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="settings" forceMount className="flex-1 m-0 overflow-hidden">
          <SettingsPanel streamCustomerCode={streamCustomerCode} />
        </TabsContent>

        <TabsContent value="preview" forceMount className="flex-1 m-0 overflow-hidden">
          <PreviewPanel
            videoProvider={
              selectedLesson.videoProvider?.toLowerCase() === 'youtube'
                ? 'youtube'
                : selectedLesson.videoProvider?.toLowerCase() === 'cloudflare'
                  ? 'cloudflare'
                : selectedLesson.videoProvider?.toLowerCase() === 'vimeo'
                  ? 'vimeo'
                  : selectedLesson.videoProvider?.toLowerCase() === 'bunny'
                    ? 'bunny'
                  : null
            }
            videoSourceId={selectedLesson.videoSourceId ?? null}
            videoId={selectedLesson.videoId}
            content={selectedLesson.content}
            title={selectedLesson.title}
          />
        </TabsContent>

        <TabsContent value="quiz" className="flex-1 m-0 overflow-y-auto p-4">
          <DeferredQuizEditor
            lessonId={selectedLesson.id}
            courseId={course?.id ?? ''}
          />
        </TabsContent>

        <TabsContent value="assignment" className="flex-1 m-0 overflow-y-auto p-4">
          <DeferredAssignmentEditor
            lessonId={selectedLesson.id}
            courseId={course?.id ?? ''}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
