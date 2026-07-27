// components/admin/ai-course/processing-panel.tsx
// 處理進度面板元件

'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Upload,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  FileVideo,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  ParsedChapter,
  LessonProcessState,
  ProcessingStats,
} from './types'

interface ProcessingPanelProps {
  chapters: ParsedChapter[]
  states: Map<string, LessonProcessState>
  stats: ProcessingStats
  isProcessing: boolean
  onRetry?: (lessonId: string, chapter: ParsedChapter) => void
  className?: string
}

export function ProcessingPanel({
  chapters,
  states,
  stats,
  // isProcessing is kept in props for future use (e.g., disabling retry during processing)
  isProcessing: _isProcessing,
  onRetry,
  className,
}: ProcessingPanelProps) {
  void _isProcessing // Suppress unused variable warning
  // 計算整體進度
  const overallProgress =
    stats.total > 0 ? Math.round(((stats.completed + stats.failed) / stats.total) * 100) : 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* 整體進度 */}
      <Card className="p-4 bg-white border-divider rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-heading">整體進度</span>
          <span className="text-sm text-caption">
            {stats.completed + stats.failed} / {stats.total}
          </span>
        </div>
        <Progress value={overallProgress} className="h-2" />
        <div className="flex items-center justify-between mt-2 text-xs text-caption">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Upload className="w-3 h-3" />
              上傳中: {stats.uploading}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              生成中: {stats.generating}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-3 h-3" />
              完成: {stats.completed}
            </span>
            {stats.failed > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="w-3 h-3" />
                失敗: {stats.failed}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* 單元處理列表 */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {chapters.map((chapter) => (
            <div key={chapter.chapterIndex} className="space-y-1">
              {/* 章節標題 */}
              <div className="text-xs font-medium text-caption px-2 py-1 sticky top-0 bg-white">
                {chapter.title}
              </div>

              {/* 單元列表 */}
              {chapter.lessons.map((lesson) => {
                const state = states.get(lesson.id)
                if (!state) return null

                return (
                  <LessonProgressCard
                    key={lesson.id}
                    title={lesson.title}
                    state={state}
                    hasVideo={lesson.folderItem.hasVideo}
                    hasSrt={lesson.folderItem.hasSrt}
                    onRetry={onRetry ? () => onRetry(lesson.id, chapter) : undefined}
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

interface LessonProgressCardProps {
  title: string
  state: LessonProcessState
  hasVideo: boolean
  hasSrt: boolean
  onRetry?: () => void
}

function LessonProgressCard({
  title,
  state,
  hasVideo,
  hasSrt,
  onRetry,
}: LessonProgressCardProps) {
  const getStatusIcon = () => {
    switch (state.status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-divider" />
      case 'uploading':
        return <Upload className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'generating':
        return <Sparkles className="w-4 h-4 text-cta animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusText = () => {
    switch (state.status) {
      case 'pending':
        return '等待中'
      case 'uploading':
        return `上傳中 ${state.uploadProgress}%`
      case 'generating':
        return 'AI 生成中...'
      case 'completed':
        return '已完成'
      case 'error':
        return state.error || '處理失敗'
    }
  }

  return (
    <Card
      className={cn(
        'p-3 border rounded-lg transition-colors',
        state.status === 'error'
          ? 'border-red-200 bg-red-50'
          : state.status === 'completed'
            ? 'border-green-200 bg-green-50'
            : 'border-divider bg-white'
      )}
    >
      <div className="flex items-start gap-3">
        {/* 狀態圖示 */}
        <div className="mt-0.5 shrink-0">{getStatusIcon()}</div>

        {/* 內容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-heading truncate">{title}</span>
            <div className="flex items-center gap-1 shrink-0">
              <FileVideo
                className={cn('w-3 h-3', hasVideo ? 'text-blue-500' : 'text-[#E5E5E5]')}
              />
              <FileText
                className={cn('w-3 h-3', hasSrt ? 'text-green-500' : 'text-[#E5E5E5]')}
              />
            </div>
          </div>

          {/* 狀態文字 */}
          <div className="text-xs text-caption">{getStatusText()}</div>

          {/* 上傳進度條 */}
          {state.status === 'uploading' && (
            <Progress value={state.uploadProgress} className="h-1 mt-2" />
          )}

          {/* AI 生成預覽 */}
          {state.status === 'generating' && state.generatedContent && (
            <div className="mt-2 p-2 bg-white rounded text-xs text-body line-clamp-2 border border-divider">
              {state.generatedContent.slice(0, 150)}...
            </div>
          )}

          {/* 生成的標題 */}
          {state.status === 'completed' && state.generatedTitle && (
            <div className="mt-1 text-xs text-body">
              建議標題：{state.generatedTitle}
            </div>
          )}
        </div>

        {/* 重試按鈕 */}
        {state.status === 'error' && onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-caption hover:text-heading shrink-0"
            onClick={onRetry}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}

        {/* 處理中動畫 */}
        {(state.status === 'uploading' || state.status === 'generating') && (
          <Loader2 className="w-4 h-4 text-caption animate-spin shrink-0" />
        )}
      </div>
    </Card>
  )
}
