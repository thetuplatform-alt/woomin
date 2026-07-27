// components/admin/curriculum/lesson-dialog.tsx
// 單元對話框元件
// 用於新增單元（僅標題）

'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { createLesson } from '@/lib/actions/curriculum'
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

// 簡化的表單 Schema，只需要標題
const lessonDialogSchema = z.object({
  title: z
    .string()
    .min(1, { message: '單元標題為必填' })
    .max(200, { message: '單元標題不能超過 200 個字元' }),
})

type LessonDialogFormData = z.infer<typeof lessonDialogSchema>

interface LessonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chapterId: string
}

export function LessonDialog({
  open,
  onOpenChange,
  chapterId,
}: LessonDialogProps) {
  const [isPending, startTransition] = useTransition()
  const { curriculum, setCurriculum } = useCourseEditor()

  // 初始化表單
  const form = useForm<LessonDialogFormData>({
    resolver: zodResolver(lessonDialogSchema),
    defaultValues: {
      title: '',
    },
  })

  // 提交表單
  async function onSubmit(data: LessonDialogFormData) {
    startTransition(async () => {
      try {
        const result = await createLesson({
          chapterId,
          title: data.title,
          isFree: false,
          status: 'PUBLISHED',
        })

        if (result.success && result.lesson) {
          // 樂觀更新 Context：將新單元加入對應章節
          setCurriculum(
            curriculum.map((c) =>
              c.id === chapterId
                ? { ...c, lessons: [...c.lessons, { ...result.lesson!, quiz: null, assignment: null }] }
                : c
            )
          )
          toast.success('單元建立成功')
          form.reset()
          onOpenChange(false)
        } else {
          toast.error(result.error ?? '建立單元失敗')
        }
      } catch {
        toast.error('操作失敗，請稍後再試')
      }
    })
  }

  // 關閉對話框時重設表單
  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      form.reset()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white border-divider sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-heading">新增單元</DialogTitle>
          <DialogDescription className="text-body">
            為章節新增一個單元
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
                    單元標題 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="輸入單元標題"
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
                ) : (
                  '新增'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
