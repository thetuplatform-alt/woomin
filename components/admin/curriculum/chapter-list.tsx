// components/admin/curriculum/chapter-list.tsx
// 章節列表元件
// 包含拖曳排序、展開收合和操作按鈕

'use client'

import { useState, useTransition, useEffect } from 'react'
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
import type { Chapter, Lesson } from '@prisma/client'
import { deleteChapter, reorderChapters } from '@/lib/actions/curriculum'
import { LessonList } from './lesson-list'
import { ChapterDialog } from './chapter-dialog'
import { LessonDialog } from './lesson-dialog'
import { Button } from '@/components/ui/button'
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
import {
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  ChevronRight,
  FolderOpen,
  Loader2,
} from 'lucide-react'

type ChapterWithLessons = Chapter & {
  lessons: Lesson[]
}

interface ChapterListProps {
  chapters: ChapterWithLessons[]
  courseId: string
}

interface SortableChapterItemProps {
  chapter: ChapterWithLessons
  courseId: string
  onEdit: (chapter: Chapter) => void
  onDelete: (chapter: Chapter) => void
  onAddLesson: (chapterId: string) => void
}

function SortableChapterItem({
  chapter,
  courseId,
  onEdit,
  onDelete,
  onAddLesson,
}: SortableChapterItemProps) {
  const [isOpen, setIsOpen] = useState(true)
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border border-divider ${
        isDragging ? 'opacity-50 z-50' : ''
      }`}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* 章節標題列 */}
        <div className="flex items-center gap-2 p-3 group">
          {/* 拖曳把手 */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-caption hover:text-body cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </button>

          {/* 展開/收合按鈕 */}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface"
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform ${
                  isOpen ? 'rotate-90' : ''
                }`}
              />
            </Button>
          </CollapsibleTrigger>

          {/* 圖標 */}
          <FolderOpen className="h-5 w-5 text-cta flex-shrink-0" />

          {/* 標題 */}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-heading truncate block">
              {chapter.title}
            </span>
            <span className="text-xs text-caption">
              {chapter.lessons.length} 個單元
            </span>
          </div>

          {/* 操作選單 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-body hover:text-heading opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-white border-divider"
            >
              <DropdownMenuItem
                onClick={() => onEdit(chapter)}
                className="flex items-center gap-2 text-heading focus:bg-surface focus:text-heading"
              >
                <Pencil className="h-4 w-4" />
                編輯章節
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAddLesson(chapter.id)}
                className="flex items-center gap-2 text-heading focus:bg-surface focus:text-heading"
              >
                <Plus className="h-4 w-4" />
                新增單元
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-heading" />
              <DropdownMenuItem
                onClick={() => onDelete(chapter)}
                className="flex items-center gap-2 text-red-500 focus:bg-red-50 focus:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
                刪除章節
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 單元列表 */}
        <CollapsibleContent>
          <div className="border-t border-divider">
            <LessonList
              lessons={chapter.lessons}
              chapterId={chapter.id}
              courseId={courseId}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function ChapterList({ chapters, courseId }: ChapterListProps) {
  const [items, setItems] = useState(chapters)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // 當 chapters prop 變化時，同步更新本地狀態
  useEffect(() => {
    setItems(chapters)
  }, [chapters])
  const [chapterToEdit, setChapterToEdit] = useState<Chapter | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null)
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    null
  )
  const [isPending, startTransition] = useTransition()

  // DnD 感應器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 處理拖曳結束
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)

      // 更新順序到資料庫
      const orders = newItems.map((item, index) => ({
        id: item.id,
        order: index,
      }))

      startTransition(async () => {
        const result = await reorderChapters(courseId, orders)
        if (!result.success) {
          // 如果失敗，還原順序
          setItems(chapters)
          toast.error(result.error ?? '排序失敗')
        }
      })
    }
  }

  // 處理編輯
  function handleEdit(chapter: Chapter) {
    setChapterToEdit(chapter)
    setEditDialogOpen(true)
  }

  // 處理刪除
  function handleDelete(chapter: Chapter) {
    setChapterToDelete(chapter)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!chapterToDelete) return

    startTransition(async () => {
      const result = await deleteChapter(chapterToDelete.id)

      if (result.success) {
        setItems((prev) => prev.filter((c) => c.id !== chapterToDelete.id))
        toast.success('章節已刪除')
      } else {
        toast.error(result.error ?? '刪除失敗')
      }

      setDeleteDialogOpen(false)
      setChapterToDelete(null)
    })
  }

  // 處理新增單元
  function handleAddLesson(chapterId: string) {
    setSelectedChapterId(chapterId)
    setLessonDialogOpen(true)
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-caption">
        <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-body">尚無章節</p>
        <p className="text-sm mt-1">點擊「新增章節」按鈕來建立第一個章節</p>
      </div>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((chapter) => (
              <SortableChapterItem
                key={chapter.id}
                chapter={chapter}
                courseId={courseId}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddLesson={handleAddLesson}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 編輯章節對話框 */}
      {chapterToEdit && (
        <ChapterDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) setChapterToEdit(null)
          }}
          courseId={courseId}
          chapter={chapterToEdit}
          mode="edit"
        />
      )}

      {/* 刪除確認對話框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認刪除</DialogTitle>
            <DialogDescription className="text-body">
              確定要刪除章節「{chapterToDelete?.title}
              」嗎？此操作將會同時刪除章節下的所有單元，且無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-divider text-body hover:bg-surface rounded-lg"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending}
              className="bg-red-500 hover:bg-red-600 rounded-lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  刪除中...
                </>
              ) : (
                '確認刪除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增單元對話框 */}
      {selectedChapterId && (
        <LessonDialog
          open={lessonDialogOpen}
          onOpenChange={(open) => {
            setLessonDialogOpen(open)
            if (!open) setSelectedChapterId(null)
          }}
          chapterId={selectedChapterId}
        />
      )}
    </>
  )
}
