// components/admin/curriculum/chapter-dialog.tsx
// 章節對話框元件
// 支援新增和編輯章節

'use client'

import { useEffect, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { Chapter } from '@prisma/client'
import {
  chapterSchema,
  type ChapterFormData,
} from '@/lib/validations/curriculum'
import { createChapter, updateChapter } from '@/lib/actions/curriculum'
import { useCourseEditor } from '@/lib/contexts/course-editor-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Loader2 } from 'lucide-react'

interface ChapterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  chapter?: Chapter
  mode: 'create' | 'edit'
}

export function ChapterDialog({
  open,
  onOpenChange,
  courseId,
  chapter,
  mode,
}: ChapterDialogProps) {
  const [isPending, startTransition] = useTransition()
  const { curriculum, setCurriculum } = useCourseEditor()

  // 初始化表單
  const form = useForm<ChapterFormData>({
    resolver: zodResolver(chapterSchema),
    defaultValues: {
      title: chapter?.title ?? '',
    },
  })

  // 當 chapter 變更時重設表單
  useEffect(() => {
    if (chapter) {
      form.reset({ title: chapter.title })
    } else {
      form.reset({ title: '' })
    }
  }, [chapter, form])

  // 提交表單
  async function onSubmit(data: ChapterFormData) {
    startTransition(async () => {
      try {
        if (mode === 'create') {
          const result = await createChapter({
            courseId,
            title: data.title,
          })

          if (result.success && result.chapter) {
            // 樂觀更新 Context：將新章節加入大綱
            setCurriculum([
              ...curriculum,
              { ...result.chapter, lessons: [] },
            ])
            toast.success('章節建立成功')
            form.reset()
            onOpenChange(false)
          } else {
            toast.error(result.error ?? '建立章節失敗')
          }
        } else {
          if (!chapter?.id) return

          const result = await updateChapter(chapter.id, data)

          if (result.success && result.chapter) {
            // 樂觀更新 Context：更新章節標題
            setCurriculum(
              curriculum.map((c) =>
                c.id === chapter.id
                  ? { ...c, title: result.chapter!.title }
                  : c
              )
            )
            toast.success('章節更新成功')
            onOpenChange(false)
          } else {
            toast.error(result.error ?? '更新章節失敗')
          }
        }
      } catch {
        toast.error('操作失敗，請稍後再試')
      }
    })
  }

  // 關閉對話框時重設表單
  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      form.reset({ title: chapter?.title ?? '' })
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white border-divider sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-heading">
            {mode === 'create' ? '新增章節' : '編輯章節'}
          </DialogTitle>
          <DialogDescription className="text-body">
            {mode === 'create'
              ? '為課程新增一個章節'
              : '修改章節標題'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-heading">
                    章節標題 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="輸入章節標題"
                      className="bg-white border-divider text-heading placeholder:text-caption"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-cta hover:bg-cta-hover text-white rounded-lg"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    處理中...
                  </>
                ) : mode === 'create' ? (
                  '新增'
                ) : (
                  '儲存'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
