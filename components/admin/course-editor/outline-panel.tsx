// components/admin/course-editor/outline-panel.tsx
// 課程內容頁面的左側大綱導覽面板
// 顯示章節與單元列表，支援拖拽排序

'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Chapter } from '@prisma/client'
import type { LessonWithFlags } from '@/lib/actions/curriculum'
import {
  deleteChapter,
  reorderChapters,
  deleteLesson,
  reorderLessons,
  toggleLessonFree,
} from '@/lib/actions/curriculum'
import { useCourseEditor } from '@/lib/contexts/course-editor-context'
import { ChapterDialog } from '@/components/admin/curriculum/chapter-dialog'
import { LessonDialog } from '@/components/admin/curriculum/lesson-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { AICourseDialog } from '@/components/admin/ai-course'
import {
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  ChevronRight,
  FolderOpen,
  Loader2,
  Video,
  FileText,
  Eye,
  EyeOff,
  Clock,
  Layers,
  BookOpen,
  FolderUp,
  FileQuestion,
  ClipboardCheck,
} from 'lucide-react'

// ==================== 統計區塊 ====================

function StatsSection() {
  const { stats } = useCourseEditor()

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="p-4 border-b border-divider">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4 text-caption" />
          <span className="text-body">{stats.chapterCount} 章節</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4 text-caption" />
          <span className="text-body">{stats.lessonCount} 單元</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-caption" />
          <span className="text-body">{stats.freeLessonCount} 試閱</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-caption" />
          <span className="text-body">
            {formatDuration(stats.totalDuration)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ==================== 單元項目 ====================

interface SortableLessonItemProps {
  lesson: LessonWithFlags
  courseId: string
  isSelected: boolean
  onSelect: () => void
  onDelete: (lesson: LessonWithFlags) => void
  onToggleFree: (lesson: LessonWithFlags) => void
}

function SortableLessonItem({
  lesson,
  isSelected,
  onSelect,
  onDelete,
  onToggleFree,
}: SortableLessonItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2 group cursor-pointer transition-colors',
        isDragging ? 'opacity-50 z-50' : '',
        isSelected
          ? 'bg-cta/10 border-l-2 border-cta'
          : 'hover:bg-surface border-l-2 border-transparent'
      )}
      onClick={onSelect}
    >
      {/* 拖曳把手 */}
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 text-caption hover:text-body cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* 圖標 */}
      <div className="flex-shrink-0">
        {lesson.videoProvider || lesson.videoSourceId || lesson.videoId ? (
          <Video className="h-3.5 w-3.5 text-cta" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-body" />
        )}
      </div>

      {/* 標題和標籤 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs truncate',
              isSelected ? 'text-heading font-medium' : 'text-body'
            )}
          >
            {lesson.title}
          </span>
          {lesson.isFree && (
            <Badge
              variant="secondary"
              className="bg-cta/10 text-cta text-[10px] px-1 py-0"
            >
              試閱
            </Badge>
          )}
          {lesson.quiz && (
            <FileQuestion className="h-3 w-3 text-purple-500 flex-shrink-0" />
          )}
          {lesson.assignment && (
            <ClipboardCheck className="h-3 w-3 text-blue-500 flex-shrink-0" />
          )}
        </div>
        {lesson.videoDuration && lesson.videoDuration > 0 && (
          <div className="text-[10px] text-caption">
            {Math.floor(lesson.videoDuration / 60)}:
            {String(lesson.videoDuration % 60).padStart(2, '0')}
          </div>
        )}
      </div>

      {/* 操作選單 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-body hover:text-heading opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-white border-divider"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onClick={() => onToggleFree(lesson)}
            className="flex items-center gap-2 text-heading focus:bg-surface focus:text-heading text-xs"
          >
            {lesson.isFree ? (
              <>
                <EyeOff className="h-3 w-3" />
                取消試閱
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                設為試閱
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-heading" />
          <DropdownMenuItem
            onClick={() => onDelete(lesson)}
            className="flex items-center gap-2 text-red-500 focus:bg-red-50 focus:text-red-500 text-xs"
          >
            <Trash2 className="h-3 w-3" />
            刪除單元
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ==================== 章節項目 ====================

interface SortableChapterItemProps {
  chapter: Chapter & { lessons: LessonWithFlags[] }
  courseId: string
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  onEdit: (chapter: Chapter) => void
  onDelete: (chapter: Chapter) => void
  onAddLesson: (chapterId: string) => void
  onDeleteLesson: (lesson: LessonWithFlags) => void
  onToggleLessonFree: (lesson: LessonWithFlags) => void
  onReorderLessons: (
    chapterId: string,
    lessons: LessonWithFlags[],
    orders: { id: string; order: number }[]
  ) => void
}

function SortableChapterItem({
  chapter,
  courseId,
  selectedLessonId,
  onSelectLesson,
  onEdit,
  onDelete,
  onAddLesson,
  onDeleteLesson,
  onToggleLessonFree,
  onReorderLessons,
}: SortableChapterItemProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [lessons, setLessons] = useState(chapter.lessons)

  // 當 chapter.lessons 變化時同步
  useEffect(() => {
    setLessons(chapter.lessons)
  }, [chapter.lessons])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // 單元 DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleLessonDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = lessons.findIndex((l) => l.id === active.id)
      const newIndex = lessons.findIndex((l) => l.id === over.id)
      const newLessons = arrayMove(lessons, oldIndex, newIndex)
      setLessons(newLessons)
      const orders = newLessons.map((l, i) => ({ id: l.id, order: i }))
      onReorderLessons(chapter.id, newLessons, orders)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('border-b border-divider', isDragging ? 'opacity-50' : '')}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* 章節標題 */}
        <div className="flex items-center gap-1 px-3 py-2 group hover:bg-surface">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 text-caption hover:text-body cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-body hover:text-heading hover:bg-transparent"
            >
              <ChevronRight
                className={cn(
                  'h-3 w-3 transition-transform',
                  isOpen ? 'rotate-90' : ''
                )}
              />
            </Button>
          </CollapsibleTrigger>

          <FolderOpen className="h-4 w-4 text-cta flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-heading truncate block">
              {chapter.title}
            </span>
          </div>

          <span className="text-[10px] text-caption mr-1">
            {chapter.lessons.length}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-body hover:text-heading opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-white border-divider"
            >
              <DropdownMenuItem
                onClick={() => onEdit(chapter)}
                className="flex items-center gap-2 text-heading text-xs"
              >
                <Pencil className="h-3 w-3" />
                編輯章節
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAddLesson(chapter.id)}
                className="flex items-center gap-2 text-heading text-xs"
              >
                <Plus className="h-3 w-3" />
                新增單元
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-heading" />
              <DropdownMenuItem
                onClick={() => onDelete(chapter)}
                className="flex items-center gap-2 text-red-500 text-xs"
              >
                <Trash2 className="h-3 w-3" />
                刪除章節
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 單元列表 */}
        <CollapsibleContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLessonDragEnd}
          >
            <SortableContext
              items={lessons}
              strategy={verticalListSortingStrategy}
            >
              <div className="pl-6">
                {lessons.map((lesson) => (
                  <SortableLessonItem
                    key={lesson.id}
                    lesson={lesson}
                    courseId={courseId}
                    isSelected={selectedLessonId === lesson.id}
                    onSelect={() => onSelectLesson(lesson.id)}
                    onDelete={onDeleteLesson}
                    onToggleFree={onToggleLessonFree}
                  />
                ))}
                {lessons.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-caption">
                    尚無單元
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ==================== 主元件 ====================

interface OutlinePanelProps {
  courseId: string
  isGeminiConfigured?: boolean
}

export function OutlinePanel({ courseId, isGeminiConfigured = false }: OutlinePanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    curriculum,
    setCurriculum,
    selectedLessonId,
    setSelectedLessonId,
    updateLessonInCurriculum,
  } = useCourseEditor()

  const [chapters, setChapters] = useState(curriculum)
  const [isPending, startTransition] = useTransition()

  // 對話框狀態
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false)
  const [chapterToEdit, setChapterToEdit] = useState<Chapter | null>(null)
  const [deleteChapterDialogOpen, setDeleteChapterDialogOpen] = useState(false)
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null)
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false)
  const [selectedChapterIdForLesson, setSelectedChapterIdForLesson] = useState<
    string | null
  >(null)
  const [deleteLessonDialogOpen, setDeleteLessonDialogOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState<LessonWithFlags | null>(null)
  const [aiCourseDialogOpen, setAiCourseDialogOpen] = useState(false)
  // 同步 curriculum 變化
  useEffect(() => {
    setChapters(curriculum)
  }, [curriculum])

  // 監聽來自 Empty State 的自訂事件
  useEffect(() => {
    const handleOpenBatch = () => setAiCourseDialogOpen(true)
    const handleOpenChapter = () => {
      setChapterToEdit(null)
      setChapterDialogOpen(true)
    }
    window.addEventListener('open-batch-dialog', handleOpenBatch)
    window.addEventListener('open-chapter-dialog', handleOpenChapter)
    return () => {
      window.removeEventListener('open-batch-dialog', handleOpenBatch)
      window.removeEventListener('open-chapter-dialog', handleOpenChapter)
    }
  }, [])

  // DnD 感應器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 選擇單元
  const handleSelectLesson = useCallback(
    (lessonId: string) => {
      setSelectedLessonId(lessonId)
      // 更新 URL
      const params = new URLSearchParams(searchParams.toString())
      params.set('lesson', lessonId)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams, setSelectedLessonId]
  )

  // 章節拖拽結束
  const handleChapterDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = chapters.findIndex((c) => c.id === active.id)
      const newIndex = chapters.findIndex((c) => c.id === over.id)
      const newChapters = arrayMove(chapters, oldIndex, newIndex)
      setChapters(newChapters)
      setCurriculum(newChapters)

      const orders = newChapters.map((c, i) => ({ id: c.id, order: i }))
      startTransition(async () => {
        const result = await reorderChapters(courseId, orders)
        if (!result.success) {
          setChapters(curriculum)
          setCurriculum(curriculum)
          toast.error(result.error ?? '排序失敗')
        }
      })
    }
  }

  // 單元排序
  const handleReorderLessons = useCallback(
    (
      chapterId: string,
      newLessons: LessonWithFlags[],
      orders: { id: string; order: number }[]
    ) => {
      // 樂觀更新
      const newChapters = chapters.map((c) =>
        c.id === chapterId ? { ...c, lessons: newLessons } : c
      )
      setChapters(newChapters)
      setCurriculum(newChapters)

      startTransition(async () => {
        const result = await reorderLessons(chapterId, orders)
        if (!result.success) {
          setChapters(curriculum)
          setCurriculum(curriculum)
          toast.error(result.error ?? '排序失敗')
        }
      })
    },
    [chapters, curriculum, setCurriculum]
  )

  // 切換試閱
  const handleToggleLessonFree = useCallback(
    (lesson: LessonWithFlags) => {
      startTransition(async () => {
        const result = await toggleLessonFree(lesson.id)
        if (result.success && result.lesson) {
          updateLessonInCurriculum(lesson.id, { isFree: result.lesson.isFree })
          toast.success(result.lesson.isFree ? '已設為試閱' : '已取消試閱')
        } else {
          toast.error(result.error ?? '操作失敗')
        }
      })
    },
    [updateLessonInCurriculum]
  )

  // 刪除章節
  const confirmDeleteChapter = () => {
    if (!chapterToDelete) return
    startTransition(async () => {
      const result = await deleteChapter(chapterToDelete.id)
      if (result.success) {
        const newChapters = chapters.filter((c) => c.id !== chapterToDelete.id)
        setChapters(newChapters)
        setCurriculum(newChapters)
        toast.success('章節已刪除')
      } else {
        toast.error(result.error ?? '刪除失敗')
      }
      setDeleteChapterDialogOpen(false)
      setChapterToDelete(null)
    })
  }

  // 刪除單元
  const confirmDeleteLesson = () => {
    if (!lessonToDelete) return
    startTransition(async () => {
      const result = await deleteLesson(lessonToDelete.id)
      if (result.success) {
        const newChapters = chapters.map((c) => ({
          ...c,
          lessons: c.lessons.filter((l) => l.id !== lessonToDelete.id),
        }))
        setChapters(newChapters)
        setCurriculum(newChapters)
        // 如果刪除的是當前選中的單元，清除選擇
        if (selectedLessonId === lessonToDelete.id) {
          setSelectedLessonId(null)
          router.push(`?`, { scroll: false })
        }
        toast.success('單元已刪除')
      } else {
        toast.error(result.error ?? '刪除失敗')
      }
      setDeleteLessonDialogOpen(false)
      setLessonToDelete(null)
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* 統計區塊 */}
      <StatsSection />

      {/* 章節列表 */}
      <div className="flex-1 overflow-y-auto" data-tour="outline-lesson-item">
        {chapters.length === 0 ? (
          <div className="p-6 text-center">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 text-[#D4D4D4]" />
            <p className="text-sm text-body">尚無章節</p>
            <p className="text-xs text-caption mt-1">
              點擊下方按鈕建立第一個章節
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleChapterDragEnd}
          >
            <SortableContext
              items={chapters}
              strategy={verticalListSortingStrategy}
            >
              {chapters.map((chapter) => (
                <SortableChapterItem
                  key={chapter.id}
                  chapter={chapter}
                  courseId={courseId}
                  selectedLessonId={selectedLessonId}
                  onSelectLesson={handleSelectLesson}
                  onEdit={(c) => {
                    setChapterToEdit(c)
                    setChapterDialogOpen(true)
                  }}
                  onDelete={(c) => {
                    setChapterToDelete(c)
                    setDeleteChapterDialogOpen(true)
                  }}
                  onAddLesson={(id) => {
                    setSelectedChapterIdForLesson(id)
                    setLessonDialogOpen(true)
                  }}
                  onDeleteLesson={(l) => {
                    setLessonToDelete(l)
                    setDeleteLessonDialogOpen(true)
                  }}
                  onToggleLessonFree={handleToggleLessonFree}
                  onReorderLessons={handleReorderLessons}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* 底部按鈕區 */}
      <div className="p-3 border-t border-divider space-y-2">
        {/* 新增批次單元按鈕 */}
        <Button
          variant="outline"
          size="sm"
          className="w-full border-cta text-cta hover:bg-cta/10 hover:text-cta-hover"
          onClick={() => setAiCourseDialogOpen(true)}
        >
          <FolderUp className="h-4 w-4 mr-2" />
          新增批次單元
        </Button>

        {/* 新增單一單元按鈕 */}
        <Button
          data-tour="add-chapter-btn"
          variant="outline"
          size="sm"
          className="w-full border-dashed border-divider text-body hover:bg-surface hover:text-heading"
          onClick={() => {
            setChapterToEdit(null)
            setChapterDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          新增單一單元
        </Button>
      </div>

      {/* 章節對話框 */}
      <ChapterDialog
        open={chapterDialogOpen}
        onOpenChange={(open) => {
          setChapterDialogOpen(open)
          if (!open) setChapterToEdit(null)
        }}
        courseId={courseId}
        chapter={chapterToEdit ?? undefined}
        mode={chapterToEdit ? 'edit' : 'create'}
      />

      {/* 單元對話框 */}
      {selectedChapterIdForLesson && (
        <LessonDialog
          open={lessonDialogOpen}
          onOpenChange={(open) => {
            setLessonDialogOpen(open)
            if (!open) setSelectedChapterIdForLesson(null)
          }}
          chapterId={selectedChapterIdForLesson}
        />
      )}

      {/* 刪除章節確認 */}
      <Dialog
        open={deleteChapterDialogOpen}
        onOpenChange={setDeleteChapterDialogOpen}
      >
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認刪除章節</DialogTitle>
            <DialogDescription className="text-body">
              確定要刪除「{chapterToDelete?.title}
              」嗎？此操作將同時刪除所有單元，且無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteChapterDialogOpen(false)}
              className="border-divider text-body"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteChapter}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除單元確認 */}
      <Dialog
        open={deleteLessonDialogOpen}
        onOpenChange={setDeleteLessonDialogOpen}
      >
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認刪除單元</DialogTitle>
            <DialogDescription className="text-body">
              確定要刪除「{lessonToDelete?.title}」嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteLessonDialogOpen(false)}
              className="border-divider text-body"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteLesson}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 快速建立對話框 */}
      <AICourseDialog
        open={aiCourseDialogOpen}
        onOpenChange={setAiCourseDialogOpen}
        courseId={courseId}
        isGeminiConfigured={isGeminiConfigured}
      />
    </div>
  )
}
