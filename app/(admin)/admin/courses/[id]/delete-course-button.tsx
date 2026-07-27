// app/(admin)/admin/courses/[id]/delete-course-button.tsx
// 刪除課程按鈕元件
// 提供刪除確認對話框

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteCourse } from '@/lib/actions/courses'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2, Loader2 } from 'lucide-react'

interface DeleteCourseButtonProps {
  courseId: string
  courseTitle: string
}

export function DeleteCourseButton({
  courseId,
  courseTitle,
}: DeleteCourseButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    startTransition(async () => {
      try {
        const result = await deleteCourse(courseId)

        if (result.success) {
          toast.success('課程已刪除')
          setOpen(false)
          router.push('/admin/courses')
        } else {
          toast.error(result.error ?? '刪除課程失敗')
        }
      } catch {
        toast.error('刪除課程時發生錯誤')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          刪除課程
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white border-divider rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-heading">確認刪除課程</DialogTitle>
          <DialogDescription className="text-body">
            您確定要刪除「{courseTitle}」嗎？此操作無法復原，所有相關的章節和單元都會一併刪除。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 rounded-lg"
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
  )
}
