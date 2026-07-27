// components/admin/comments/all-comments-table.tsx
// 後台：完整留言列表（所有課程/章節/單元）

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { MessageCircle, Trash2, Loader2, ShieldOff, Reply } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  deleteLessonCommentForAdmin,
  getAllLessonCommentsForAdmin,
} from '@/lib/actions/lesson-comments-admin'
import { CommentReplyModal } from '@/components/admin/comments/comment-reply-modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CommentRow = {
  id: string
  content: string
  isAnonymous: boolean
  createdAt: string
  deletedAt: string | null
  user: { id: string; name: string | null; email: string; image: string | null }
  lesson: {
    id: string
    title: string
    chapter: {
      id: string
      title: string
      course: { id: string; title: string; slug: string }
    }
  }
}

interface AllCommentsTableProps {
  initialComments: CommentRow[]
  initialNextCursor: string | null
  initialTotalCount: number
  courses: { id: string; title: string }[]
  selectedCourseId: string
}

export function AllCommentsTable({
  initialComments,
  initialNextCursor,
  initialTotalCount,
  courses,
  selectedCourseId,
}: AllCommentsTableProps) {
  const router = useRouter()
  const [comments, setComments] = useState<CommentRow[]>(initialComments)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [isPending, startTransition] = useTransition()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<CommentRow | null>(null)
  const [replyOpen, setReplyOpen] = useState(false)
  const [commentToReply, setCommentToReply] = useState<CommentRow | null>(null)

  const handleDelete = async () => {
    if (!commentToDelete) return
    startTransition(async () => {
      const res = await deleteLessonCommentForAdmin({
        commentId: commentToDelete.id,
        revalidate: { path: '/admin/comments' },
      })
      if (res.success) {
        toast.success('留言已刪除')
        setComments((prev) => prev.filter((c) => c.id !== commentToDelete.id))
        setTotalCount((prev) => prev - 1)
        setDeleteOpen(false)
      } else {
        toast.error(res.error ?? '刪除留言失敗')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-heading flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-cta" />
            留言管理
          </h1>
          <p className="mt-1 text-sm text-body">
            共 {totalCount} 則未刪除留言
          </p>
        </div>
        <Select
          value={selectedCourseId}
          onValueChange={(value) => {
            const url = value === 'ALL' ? '/admin/comments' : `/admin/comments?courseId=${value}`
            router.push(url)
          }}
        >
          <SelectTrigger data-tour="comments-course-filter" className="w-64 bg-white border-divider rounded-lg">
            <SelectValue placeholder="篩選課程" />
          </SelectTrigger>
          <SelectContent className="bg-white border-divider">
            <SelectItem value="ALL">全部可管理課程</SelectItem>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-divider bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table data-tour="comments-table" className="min-w-[980px] w-full text-sm">
            <thead className="bg-surface border-b border-divider">
              <tr className="text-left text-body">
                <th className="px-6 py-3 font-bold">課程</th>
                <th className="px-6 py-3 font-bold">章節</th>
                <th className="px-6 py-3 font-bold">單元</th>
                <th className="px-6 py-3 font-bold">留言者</th>
                <th className="px-6 py-3 font-bold">時間</th>
                <th className="px-6 py-3 font-bold">內容</th>
                <th className="px-6 py-3 font-bold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {comments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-caption"
                  >
                    目前沒有留言
                  </td>
                </tr>
              ) : (
                comments.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/courses/${c.lesson.chapter.course.id}/content`}
                        className="text-heading font-semibold underline decoration-divider underline-offset-2 hover:decoration-cta transition-colors"
                      >
                        {c.lesson.chapter.course.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/courses/${c.lesson.chapter.course.id}/content?lesson=${c.lesson.id}`}
                        className="text-body underline decoration-divider underline-offset-2 hover:decoration-cta hover:text-heading transition-colors"
                      >
                        {c.lesson.chapter.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/courses/${c.lesson.chapter.course.id}/content?lesson=${c.lesson.id}`}
                        className="text-heading underline decoration-divider underline-offset-2 hover:decoration-cta transition-colors"
                      >
                        {c.lesson.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-heading">
                          {c.isAnonymous ? '學員（匿名）' : c.user.name || '未命名'}
                        </span>
                        {c.isAnonymous && (
                          <Badge className="bg-cta/10 text-cta hover:bg-cta/10">
                            <ShieldOff className="mr-1 h-3 w-3" />
                            匿名
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-caption">
                        真實身份：{c.user.name || '未命名'} · {c.user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-body whitespace-nowrap">
                      {format(new Date(c.createdAt), 'yyyy/MM/dd HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={cn(
                          'max-w-[420px] whitespace-pre-wrap break-words rounded-xl border border-divider bg-surface px-4 py-3 text-heading',
                          'text-sm leading-relaxed'
                        )}
                      >
                        {c.content}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCommentToReply(c)
                            setReplyOpen(true)
                          }}
                          className="border-cta/30 text-cta hover:bg-cta/5 hover:text-cta-hover rounded-lg"
                        >
                          <Reply className="mr-2 h-4 w-4" />
                          回覆
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCommentToDelete(c)
                            setDeleteOpen(true)
                          }}
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          刪除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={isLoadingMore}
            onClick={async () => {
              setIsLoadingMore(true)
              try {
                const page = await getAllLessonCommentsForAdmin(
                  nextCursor,
                  selectedCourseId === 'ALL' ? undefined : selectedCourseId
                )
                const newComments = page.comments.map((c) => ({
                  id: c.id,
                  content: c.content,
                  isAnonymous: c.isAnonymous,
                  createdAt: c.createdAt.toISOString(),
                  deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
                  user: c.user,
                  lesson: c.lesson,
                }))
                setComments((prev) => [...prev, ...newComments])
                setNextCursor(page.nextCursor)
              } catch {
                toast.error('載入更多留言失敗')
              } finally {
                setIsLoadingMore(false)
              }
            }}
            className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                載入中...
              </>
            ) : (
              `載入更多（已顯示 ${comments.length} / ${totalCount} 則）`
            )}
          </Button>
        </div>
      )}

      <CommentReplyModal
        open={replyOpen}
        onOpenChange={setReplyOpen}
        comment={
          commentToReply
            ? {
                id: commentToReply.id,
                content: commentToReply.content,
                userName: commentToReply.user.name || '未命名',
                userEmail: commentToReply.user.email,
                lessonTitle: commentToReply.lesson.title,
                courseTitle: commentToReply.lesson.chapter.course.title,
              }
            : null
        }
        onSuccess={() => router.refresh()}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認刪除留言</DialogTitle>
            <DialogDescription className="text-body">
              此操作會將留言標記為已刪除，前台不再顯示。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
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
    </div>
  )
}
