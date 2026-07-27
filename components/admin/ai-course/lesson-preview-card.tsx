// components/admin/ai-course/lesson-preview-card.tsx
// 單元內容預覽/編輯卡片

'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Pencil,
  FileVideo,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParsedLesson, LessonProcessState } from './types'

interface LessonPreviewCardProps {
  lesson: ParsedLesson
  state: LessonProcessState
  onContentChange: (content: string) => void
  onTitleChange: (title: string) => void
  className?: string
}

export function LessonPreviewCard({
  lesson,
  state,
  onContentChange,
  onTitleChange,
  className,
}: LessonPreviewCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [localTitle, setLocalTitle] = useState(
    state.generatedTitle ? `${lesson.title} ${state.generatedTitle}` : lesson.title
  )

  const isError = state.status === 'error'
  const isCompleted = state.status === 'completed'

  // 格式化時長
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card
      className={cn(
        'border rounded-lg overflow-hidden transition-colors',
        isError
          ? 'border-red-200'
          : isCompleted
            ? 'border-divider'
            : 'border-amber-200',
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* 標題列 */}
        <CollapsibleTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 p-3 cursor-pointer hover:bg-surface',
              isError && 'bg-red-50'
            )}
          >
            {/* 展開/收合圖示 */}
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-caption shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-caption shrink-0" />
            )}

            {/* 狀態圖示 */}
            {isError ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : isCompleted ? (
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-amber-400 shrink-0" />
            )}

            {/* 標題 */}
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <Input
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditingTitle(false)
                    onTitleChange(localTitle)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTitle(false)
                      onTitleChange(localTitle)
                    }
                  }}
                  className="h-7 text-sm"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="font-medium text-sm text-heading truncate block">
                  {localTitle}
                </span>
              )}
            </div>

            {/* 編輯標題按鈕 */}
            {!isEditingTitle && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-caption hover:text-heading shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditingTitle(true)
                }}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}

            {/* 影片資訊 */}
            <div className="flex items-center gap-2 text-xs text-caption shrink-0">
              {(state.videoSourceId || state.videoId) && (
                <>
                  <FileVideo className="w-3 h-3 text-blue-500" />
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(state.videoDuration)}
                  </span>
                </>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {/* 內容區域 */}
        <CollapsibleContent>
          <div className="border-t border-divider p-3 bg-surface">
            {/* 錯誤訊息 */}
            {isError && state.error && (
              <div className="mb-3 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
                錯誤：{state.error}
              </div>
            )}

            {/* 影片資訊 */}
            {(state.videoSourceId || state.videoId) && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded text-sm text-blue-700 flex items-center gap-2">
                <FileVideo className="w-4 h-4" />
                <span>
                  影片來源: {state.videoProvider || 'cloudflare'} / ID: {state.videoSourceId || state.videoId}
                </span>
                {state.videoDuration && (
                  <span className="ml-auto">時長: {formatDuration(state.videoDuration)}</span>
                )}
              </div>
            )}

            {/* 內容編輯區 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-body">單元內文 (Markdown)</label>
              <Textarea
                value={state.generatedContent}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder="AI 生成的內容將顯示在這裡，您可以手動編輯..."
                className="min-h-[200px] font-mono text-sm bg-white"
              />
            </div>

            {/* 內容統計 */}
            <div className="mt-2 text-xs text-caption flex items-center justify-between">
              <span>{state.generatedContent.length} 字元</span>
              <span>{state.generatedContent.split('\n').length} 行</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
