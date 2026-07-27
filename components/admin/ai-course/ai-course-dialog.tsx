// components/admin/ai-course/ai-course-dialog.tsx
// 批次建立單元 Modal

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle,
  FolderOpen,
  Eye,
  Play,
  Save,
  KeyRound,
  ExternalLink,
  SkipForward,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { FolderDropZone } from './folder-drop-zone'
import { StructurePreview } from './structure-preview'
import { ProcessingPanel } from './processing-panel'
import { LessonPreviewCard } from './lesson-preview-card'
import { useCourseProcessor } from './hooks/use-course-processor'
import { createBulkCurriculum } from '@/lib/actions/ai-course'
import { updateAISettings } from '@/lib/actions/settings'
import type { ParsedChapter, ModalStage } from './types'

type ExtendedStage = ModalStage | 'api-key-setup'

interface AICourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  isGeminiConfigured?: boolean
  onSuccess?: () => void
}

export function AICourseDialog({
  open,
  onOpenChange,
  courseId,
  isGeminiConfigured = false,
  onSuccess,
}: AICourseDialogProps) {
  const router = useRouter()

  // 階段管理
  const [stage, setStage] = useState<ExtendedStage>('drop')
  const [chapters, setChapters] = useState<ParsedChapter[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // API Key 設定狀態
  const [apiKey, setApiKey] = useState('')
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [isSavingApiKey, setIsSavingApiKey] = useState(false)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(isGeminiConfigured)

  // 檢查是否有 SRT 檔案需要 AI 生成
  const hasSrtWithoutMd = chapters.some((ch) =>
    ch.lessons.some((l) => l.folderItem.hasSrt && !l.folderItem.hasMd)
  )

  // 處理 Hook
  const {
    states,
    stats,
    isProcessing,
    startProcessing,
    retryLesson,
    updateLessonContent,
    updateLessonTitle,
  } = useCourseProcessor()

  // 重設狀態
  const resetState = useCallback(() => {
    setStage('drop')
    setChapters([])
    setApiKey('')
    setApiKeyError(null)
  }, [])

  // 關閉 Dialog
  const handleClose = useCallback(() => {
    if (isProcessing) {
      toast.error('處理中，請稍候再關閉')
      return
    }
    resetState()
    onOpenChange(false)
  }, [isProcessing, onOpenChange, resetState])

  // 資料夾解析完成
  const handleFolderParsed = useCallback(
    (parsedChapters: ParsedChapter[]) => {
      if (parsedChapters.length === 0) {
        toast.error('未找到有效的課程資料夾')
        return
      }
      setChapters(parsedChapters)
      setStage('preview')
    },
    []
  )

  // 從 preview 進入處理
  const handleStartFromPreview = useCallback(() => {
    // 如果有 SRT（無 MD）且 API Key 未設定 → 引導設定
    if (hasSrtWithoutMd && !apiKeyConfigured) {
      setStage('api-key-setup')
      return
    }
    setStage('processing')
    startProcessing(chapters).then(() => setStage('confirm'))
  }, [hasSrtWithoutMd, apiKeyConfigured, chapters, startProcessing])

  // 儲存 API Key
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setApiKeyError('請輸入 API Key')
      return
    }
    setIsSavingApiKey(true)
    setApiKeyError(null)
    try {
      const result = await updateAISettings({
        geminiApiKey: apiKey.trim(),
        geminiModel: 'gemini-2.5-flash',
      })
      if (result.success) {
        setApiKeyConfigured(true)
        toast.success('API Key 已儲存')
        // 自動開始處理
        setStage('processing')
        startProcessing(chapters).then(() => setStage('confirm'))
      } else {
        setApiKeyError(result.error ?? '儲存失敗')
      }
    } catch {
      setApiKeyError('操作失敗，請稍後再試')
    } finally {
      setIsSavingApiKey(false)
    }
  }

  // 跳過 AI 生成
  const handleSkipAI = useCallback(() => {
    setStage('processing')
    startProcessing(chapters, { skipAI: true }).then(() => setStage('confirm'))
  }, [chapters, startProcessing])

  // 寫入資料庫
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const data = {
        courseId,
        chapters: chapters.map((chapter) => ({
          title: chapter.title,
          lessons: chapter.lessons.map((lesson) => {
            const state = states.get(lesson.id)
            const finalTitle = state?.generatedTitle
              ? `${lesson.title} ${state.generatedTitle}`
              : lesson.title

            return {
              title: finalTitle,
              content: state?.generatedContent || '',
              videoProvider: state?.videoProvider || null,
              videoSourceId: state?.videoSourceId || state?.videoId || null,
              videoUrl: state?.videoUrl || null,
              videoThumbnail: state?.videoThumbnail || null,
              videoId: state?.videoId || null,
              videoDuration: state?.videoDuration || null,
            }
          }),
        })),
      }

      const result = await createBulkCurriculum(data)

      if (result.success) {
        toast.success(
          `成功建立 ${result.createdChapters} 個章節、${result.createdLessons} 個單元`
        )
        handleClose()
        router.refresh()
        onSuccess?.()
      } else {
        toast.error(result.error || '建立失敗')
      }
    } catch (error) {
      console.error('儲存失敗:', error)
      toast.error('儲存時發生錯誤')
    } finally {
      setIsSaving(false)
    }
  }, [courseId, chapters, states, handleClose, router, onSuccess])

  // 渲染階段內容
  const renderStageContent = () => {
    switch (stage) {
      case 'drop':
        return <FolderDropZone onFolderParsed={handleFolderParsed} />

      case 'preview':
        return (
          <StructurePreview
            chapters={chapters}
            onChaptersChange={setChapters}
          />
        )

      case 'api-key-setup':
        return (
          <div className="space-y-6 py-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  偵測到字幕檔案需要 AI 生成講義
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  部分單元包含 SRT 字幕但無 Markdown 講義。設定 Gemini API Key
                  後，系統可自動將字幕轉為結構化講義。
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-heading font-medium">
                Gemini API Key
              </Label>
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-white border-divider text-heading placeholder:text-caption"
              />
              <p className="text-xs text-caption">
                你可以在{' '}
                <a
                  href="https://aistudio.google.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cta hover:underline inline-flex items-center gap-0.5"
                >
                  Google AI Studio
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                中免費申請 API Key
              </p>
              {apiKeyError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {apiKeyError}
                </p>
              )}
            </div>
          </div>
        )

      case 'processing':
        return (
          <ProcessingPanel
            chapters={chapters}
            states={states}
            stats={stats}
            isProcessing={isProcessing}
            onRetry={retryLesson}
          />
        )

      case 'confirm':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">處理完成</span>
              </div>
              <p className="mt-1 text-sm text-green-600">
                成功處理 {stats.completed} 個單元
                {stats.failed > 0 && `，${stats.failed} 個失敗`}
              </p>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {chapters.map((chapter) => (
                  <div key={chapter.chapterIndex} className="space-y-2">
                    <div className="text-sm font-medium text-body sticky top-0 bg-white py-1">
                      {chapter.title}
                    </div>
                    {chapter.lessons.map((lesson) => {
                      const state = states.get(lesson.id)
                      if (!state) return null

                      return (
                        <LessonPreviewCard
                          key={lesson.id}
                          lesson={lesson}
                          state={state}
                          onContentChange={(content) =>
                            updateLessonContent(lesson.id, content)
                          }
                          onTitleChange={(title) =>
                            updateLessonTitle(lesson.id, title)
                          }
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )
    }
  }

  // 渲染按鈕
  const renderFooter = () => {
    switch (stage) {
      case 'drop':
        return (
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
        )

      case 'preview':
        return (
          <>
            <Button variant="outline" onClick={() => setStage('drop')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              重新選擇
            </Button>
            <Button
              onClick={handleStartFromPreview}
              className="bg-cta hover:bg-cta-hover text-white"
            >
              開始處理
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </>
        )

      case 'api-key-setup':
        return (
          <>
            <Button variant="outline" onClick={() => setStage('preview')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipAI}
              className="text-caption"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              跳過講義生成
            </Button>
            <Button
              onClick={handleSaveApiKey}
              disabled={isSavingApiKey || !apiKey.trim()}
              className="bg-cta hover:bg-cta-hover text-white"
            >
              {isSavingApiKey ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              儲存並開始處理
            </Button>
          </>
        )

      case 'processing':
        return (
          <Button variant="outline" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            處理中...
          </Button>
        )

      case 'confirm':
        return (
          <>
            <Button
              variant="outline"
              onClick={() => setStage('preview')}
              disabled={isSaving}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || stats.completed === 0}
              className="bg-cta hover:bg-cta-hover text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  儲存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  確認寫入 ({stats.completed} 個單元)
                </>
              )}
            </Button>
          </>
        )
    }
  }

  // 取得階段標題和描述
  const getStageInfo = () => {
    switch (stage) {
      case 'drop':
        return {
          title: '新增批次單元',
          description:
            '拖入課程資料夾，系統自動識別三層結構並匯入影片與講義',
          icon: FolderOpen,
        }
      case 'preview':
        return {
          title: '確認課程結構',
          description: '檢查識別的章節和單元，可以編輯標題',
          icon: Eye,
        }
      case 'api-key-setup':
        return {
          title: '設定 AI 講義生成',
          description: '設定 Gemini API Key 以啟用自動講義生成，或選擇跳過',
          icon: KeyRound,
        }
      case 'processing':
        return {
          title: '處理中',
          description: '正在上傳影片並處理講義內容',
          icon: Play,
        }
      case 'confirm':
        return {
          title: '確認並儲存',
          description: '檢查生成的內容，確認後寫入課程',
          icon: CheckCircle,
        }
    }
  }

  const stageInfo = getStageInfo()
  const StageIcon = stageInfo.icon

  // 階段指示器的階段列表（不含 api-key-setup，它是插入式的）
  const mainStages = ['drop', 'preview', 'processing', 'confirm'] as const
  const currentMainStageIndex = mainStages.indexOf(
    stage === 'api-key-setup' ? 'preview' : (stage as (typeof mainStages)[number])
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'bg-white border-divider rounded-xl transition-all duration-300 max-h-[90vh] flex flex-col',
          stage === 'drop' && 'sm:max-w-lg',
          stage === 'preview' && 'sm:max-w-2xl',
          stage === 'api-key-setup' && 'sm:max-w-lg',
          stage === 'processing' && 'sm:max-w-3xl',
          stage === 'confirm' && 'sm:max-w-4xl'
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-heading">
            <div className="w-8 h-8 rounded-lg bg-cta/10 flex items-center justify-center">
              <StageIcon className="w-4 h-4 text-cta" />
            </div>
            {stageInfo.title}
          </DialogTitle>
          <DialogDescription className="text-body">
            {stageInfo.description}
          </DialogDescription>
        </DialogHeader>

        {/* 階段指示器 */}
        <div className="flex items-center justify-center gap-2 py-2">
          {mainStages.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  currentMainStageIndex === i
                    ? 'bg-cta'
                    : currentMainStageIndex > i
                      ? 'bg-green-500'
                      : 'bg-[#E5E5E5]'
                )}
              />
              {i < mainStages.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-1',
                    currentMainStageIndex > i ? 'bg-green-500' : 'bg-[#E5E5E5]'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* 內容區域 */}
        <div className="min-h-0 flex-1 overflow-y-auto">{renderStageContent()}</div>

        <DialogFooter className="gap-2">{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
