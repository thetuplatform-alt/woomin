// components/admin/curriculum/lesson-list.tsx
// 單元列表元件
// 包含拖曳排序、操作按鈕和試閱標籤

'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
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
import type { Lesson } from '@prisma/client'
import {
  deleteLesson,
  reorderLessons,
  toggleLessonFree,
} from '@/lib/actions/curriculum'
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
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Video,
  FileText,
  Loader2,
} from 'lucide-react'

interface LessonListProps {
  lessons: Lesson[]
  chapterId: string
  courseId: string
}

interface SortableLessonItemProps {
  lesson: Lesson
  courseId: string
  onDelete: (lesson: Lesson) => void
  onToggleFree: (lesson: Lesson) => void
}

function SortableLessonItem({
  lesson,
  courseId,
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
      className={`flex items-center gap-3 p-3 bg-surface rounded-xl border border-divider group ${
        isDragging ? 'opacity-50 z-50' : ''
      }`}
    >
      {/* 拖曳把手 */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-caption hover:text-body cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* 圖標 */}
      <div className="flex-shrink-0">
        {lesson.videoProvider || lesson.videoSourceId || lesson.videoId ? (
          <Video className="h-4 w-4 text-cta" />
        ) : (
          <FileText className="h-4 w-4 text-body" />
        )}
      </div>

      {/* 標題和標籤 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-heading truncate">{lesson.title}</span>
          {lesson.isFree && (
            <Badge
              variant="secondary"
              className="bg-cta/10 text-cta text-xs"
            >
              試閱
            </Badge>
          )}
        </div>
        {lesson.videoDuration && lesson.videoDuration > 0 && (
          <div className="text-xs text-caption mt-0.5">
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
            className="h-8 w-8 p-0 text-body hover:text-heading opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-white border-divider"
        >
          <DropdownMenuItem asChild>
            <Link
              href={`/admin/courses/${courseId}/curriculum/lessons/${lesson.id}`}
              className="flex items-center gap-2 text-heading focus:bg-surface focus:text-heading"
            >
              <Pencil className="h-4 w-4" />
              編輯單元
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onToggleFree(lesson)}
            className="flex items-center gap-2 text-heading focus:bg-surface focus:text-heading"
          >
            {lesson.isFree ? (
              <>
                <EyeOff className="h-4 w-4" />
                取消試閱
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                設為試閱
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-heading" />
          <DropdownMenuItem
            onClick={() => onDelete(lesson)}
            className="flex items-center gap-2 text-red-500 focus:bg-red-50 focus:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
            刪除單元
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function LessonList({ lessons, chapterId, courseId }: LessonListProps) {
  const [items, setItems] = useState(lessons)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null)
  const [isPending, startTransition] = useTransition()

  // 當 lessons prop 變化時，同步更新本地狀態
  useEffect(() => {
    setItems(lessons)
  }, [lessons])

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
        const result = await reorderLessons(chapterId, orders)
        if (!result.success) {
          // 如果失敗，還原順序
          setItems(lessons)
          toast.error(result.error ?? '排序失敗')
        }
      })
    }
  }

  // 處理刪除
  function handleDelete(lesson: Lesson) {
    setLessonToDelete(lesson)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!lessonToDelete) return

    startTransition(async () => {
      const result = await deleteLesson(lessonToDelete.id)

      if (result.success) {
        setItems((prev) => prev.filter((l) => l.id !== lessonToDelete.id))
        toast.success('單元已刪除')
      } else {
        toast.error(result.error ?? '刪除失敗')
      }

      setDeleteDialogOpen(false)
      setLessonToDelete(null)
    })
  }

  // 處理切換試閱
  async function handleToggleFree(lesson: Lesson) {
    startTransition(async () => {
      const result = await toggleLessonFree(lesson.id)

      if (result.success && result.lesson) {
        setItems((prev) =>
          prev.map((l) =>
            l.id === lesson.id ? { ...l, isFree: result.lesson!.isFree } : l
          )
        )
        toast.success(result.lesson.isFree ? '已設為試閱' : '已取消試閱')
      } else {
        toast.error(result.error ?? '操作失敗')
      }
    })
  }

  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-caption text-sm">
        尚無單元，點擊「新增單元」按鈕來建立
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
          <div className="space-y-2 p-2">
            {items.map((lesson) => (
              <SortableLessonItem
                key={lesson.id}
                lesson={lesson}
                courseId={courseId}
                onDelete={handleDelete}
                onToggleFree={handleToggleFree}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 刪除確認對話框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認刪除</DialogTitle>
            <DialogDescription className="text-body">
              確定要刪除單元「{lessonToDelete?.title}」嗎？此操作無法復原。
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
    </>
  )
}
