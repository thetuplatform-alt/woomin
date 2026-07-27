// components/admin/ai-course/structure-preview.tsx
// 課程結構預覽元件

'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileVideo,
  FileText,
  AlertCircle,
  CheckCircle,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParsedChapter, ParsedLesson } from './types'
import { getParseStats, validateParsedChapters } from '@/lib/utils/folder-parser'

interface StructurePreviewProps {
  chapters: ParsedChapter[]
  onChaptersChange: (chapters: ParsedChapter[]) => void
  className?: string
}

export function StructurePreview({
  chapters,
  onChaptersChange,
  className,
}: StructurePreviewProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(
    new Set(chapters.map((_, i) => i))
  )
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)

  const stats = getParseStats(chapters)
  const warnings = validateParsedChapters(chapters)

  // 切換章節展開狀態
  const toggleChapter = (index: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // 更新章節標題
  const updateChapterTitle = (chapterIndex: number, title: string) => {
    const newChapters = [...chapters]
    newChapters[chapterIndex] = { ...newChapters[chapterIndex], title }
    onChaptersChange(newChapters)
  }

  // 更新單元標題
  const updateLessonTitle = (
    chapterIndex: number,
    lessonIndex: number,
    title: string
  ) => {
    const newChapters = [...chapters]
    const newLessons = [...newChapters[chapterIndex].lessons]
    newLessons[lessonIndex] = { ...newLessons[lessonIndex], title }
    newChapters[chapterIndex] = { ...newChapters[chapterIndex], lessons: newLessons }
    onChaptersChange(newChapters)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 統計資訊 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-white border-divider rounded-lg">
          <div className="text-xs text-caption mb-1">章節數</div>
          <div className="text-2xl font-bold text-heading">{stats.totalChapters}</div>
        </Card>
        <Card className="p-3 bg-white border-divider rounded-lg">
          <div className="text-xs text-caption mb-1">單元數</div>
          <div className="text-2xl font-bold text-heading">{stats.totalLessons}</div>
        </Card>
        <Card className="p-3 bg-white border-divider rounded-lg">
          <div className="text-xs text-caption mb-1">有影片</div>
          <div className="text-2xl font-bold text-heading">{stats.lessonsWithVideo}</div>
        </Card>
        <Card className="p-3 bg-white border-divider rounded-lg">
          <div className="text-xs text-caption mb-1">有講義/字幕</div>
          <div className="text-2xl font-bold text-heading">
            {stats.lessonsWithMd + stats.lessonsWithSrt}
          </div>
        </Card>
      </div>

      {/* 警告訊息 */}
      {warnings.length > 0 && (
        <Card className="p-3 bg-amber-50 border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">發現 {warnings.length} 個問題：</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                {warnings.slice(0, 5).map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
                {warnings.length > 5 && (
                  <li className="text-amber-600">還有 {warnings.length - 5} 個問題...</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* 章節列表 */}
      <div className="space-y-2">
        {chapters.map((chapter, chapterIndex) => (
          <Card
            key={chapterIndex}
            className="bg-white border-divider rounded-lg overflow-hidden"
          >
            <Collapsible
              open={expandedChapters.has(chapterIndex)}
              onOpenChange={() => toggleChapter(chapterIndex)}
            >
              {/* 章節標題 */}
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 p-3 hover:bg-surface cursor-pointer">
                  {expandedChapters.has(chapterIndex) ? (
                    <ChevronDown className="w-4 h-4 text-caption" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-caption" />
                  )}
                  <Folder className="w-4 h-4 text-cta" />

                  {editingChapterId === chapterIndex ? (
                    <Input
                      value={chapter.title}
                      onChange={(e) => updateChapterTitle(chapterIndex, e.target.value)}
                      onBlur={() => setEditingChapterId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingChapterId(null)
                      }}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="font-medium text-heading flex-1">
                        {chapter.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-caption hover:text-heading"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingChapterId(chapterIndex)
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </>
                  )}

                  <span className="text-xs text-caption">
                    {chapter.lessons.length} 個單元
                  </span>
                </div>
              </CollapsibleTrigger>

              {/* 單元列表 */}
              <CollapsibleContent>
                <div className="border-t border-divider">
                  {chapter.lessons.map((lesson, lessonIndex) => (
                    <LessonItem
                      key={lesson.id}
                      lesson={lesson}
                      isEditing={editingLessonId === lesson.id}
                      onEditStart={() => setEditingLessonId(lesson.id)}
                      onEditEnd={() => setEditingLessonId(null)}
                      onTitleChange={(title) =>
                        updateLessonTitle(chapterIndex, lessonIndex, title)
                      }
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  )
}

interface LessonItemProps {
  lesson: ParsedLesson
  isEditing: boolean
  onEditStart: () => void
  onEditEnd: () => void
  onTitleChange: (title: string) => void
}

function LessonItem({
  lesson,
  isEditing,
  onEditStart,
  onEditEnd,
  onTitleChange,
}: LessonItemProps) {
  const { folderItem } = lesson
  const isComplete =
    folderItem.hasVideo && (folderItem.hasMd || folderItem.hasSrt)

  return (
    <div className="flex items-center gap-2 px-3 py-2 pl-10 border-b last:border-b-0 border-divider hover:bg-surface">
      {/* 狀態圖示 */}
      {isComplete ? (
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
      )}

      {/* 標題 */}
      {isEditing ? (
        <Input
          value={lesson.title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onEditEnd}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditEnd()
          }}
          className="h-7 text-sm flex-1"
          autoFocus
        />
      ) : (
        <>
          <span className="text-sm text-heading flex-1">{lesson.title}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-caption hover:text-heading"
            onClick={onEditStart}
          >
            <Pencil className="w-3 h-3" />
          </Button>
        </>
      )}

      {/* 檔案狀態 */}
      <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
        <span
          className={cn(
            'flex items-center gap-0.5',
            folderItem.hasVideo ? 'text-blue-500' : 'text-[#D4D4D4]'
          )}
        >
          <FileVideo className="w-3.5 h-3.5" />
        </span>
        {folderItem.hasMd ? (
          <span className="flex items-center gap-0.5 text-green-500">
            <FileText className="w-3.5 h-3.5" />
            <span>MD</span>
          </span>
        ) : (
          <span
            className={cn(
              'flex items-center gap-0.5',
              folderItem.hasSrt ? 'text-amber-500' : 'text-[#D4D4D4]'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            {folderItem.hasSrt && <span>SRT</span>}
          </span>
        )}
      </div>
    </div>
  )
}
