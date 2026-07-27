// components/admin/courses/course-table.tsx
// 課程表格元件
// 顯示課程列表，支援操作功能

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toast } from 'sonner'
import type { CourseStatus, CourseVisibility } from '@prisma/client'
import { deleteCourse, type CourseListItem } from '@/lib/actions/courses'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Copy,
  ExternalLink,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Link2,
  Loader2,
} from 'lucide-react'

interface CourseTableProps {
  courses: CourseListItem[]
}

// 狀態標籤設定
const statusConfig: Record<
  CourseStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  DRAFT: { label: '草稿', variant: 'secondary' },
  PUBLISHED: { label: '已發佈', variant: 'default' },
  UNLISTED: { label: '隱藏', variant: 'outline' },
}

const visibilityConfig: Record<
  CourseVisibility,
  { label: string; className: string }
> = {
  PUBLIC: {
    label: '公開販售',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  UNLISTED: {
    label: '連結販售',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  INVITE_ONLY: {
    label: '私密邀請',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
}

// 格式化金額為新台幣格式
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function CourseTable({ courses }: CourseTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState<CourseListItem | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)

  async function handleCopy(slug: string) {
    const url = `${window.location.origin}/courses/${slug}`
    await navigator.clipboard.writeText(url)
    toast.success('課程連結已複製')
  }

  // 處理刪除課程
  function handleDeleteClick(course: CourseListItem) {
    setCourseToDelete(course)
    setDeleteDialogOpen(true)
  }

  // 確認刪除課程
  async function handleConfirmDelete() {
    if (!courseToDelete) return

    setActioningId(courseToDelete.id)
    startTransition(async () => {
      try {
        const result = await deleteCourse(courseToDelete.id)

        if (result.success) {
          toast.success('課程已刪除')
          setDeleteDialogOpen(false)
          setCourseToDelete(null)
          router.refresh()
        } else {
          toast.error(result.error ?? '刪除課程失敗')
        }
      } catch {
        toast.error('刪除課程時發生錯誤')
      } finally {
        setActioningId(null)
      }
    })
  }

  // 處理列點擊導航
  function handleRowClick(courseId: string) {
    router.push(`/admin/courses/${courseId}`)
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
          <ImageIcon className="h-8 w-8 text-caption" />
        </div>
        <h3 className="text-lg font-medium text-heading mb-2">
          尚未建立任何課程
        </h3>
        <p className="text-sm text-body mb-4">
          點擊右上角的「新增課程」按鈕開始建立您的第一個課程
        </p>
      </div>
    )
  }

  return (
    <>
      <div data-tour="course-table" className="rounded-xl border border-divider overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-divider hover:bg-transparent bg-surface">
              <TableHead className="text-body w-16">封面</TableHead>
              <TableHead className="text-body">標題</TableHead>
              <TableHead data-tour="status-column" className="text-body w-24">狀態</TableHead>
              <TableHead data-tour="visibility-column" className="text-body w-28">可見性</TableHead>
              <TableHead className="text-body w-32 text-right">
                價格
              </TableHead>
              <TableHead className="text-body w-32">建立日期</TableHead>
              <TableHead className="text-body w-36 text-right">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => {
              const status = statusConfig[course.status]
              const visibility = visibilityConfig[course.salesVisibility]
              const isActioning = actioningId === course.id
              const isInviteOnly = course.salesVisibility === 'INVITE_ONLY'
              const canCopyCourseLink = course.salesVisibility !== 'INVITE_ONLY'

              return (
                <TableRow
                  key={course.id}
                  className="border-divider hover:bg-surface cursor-pointer"
                  onClick={() => handleRowClick(course.id)}
                >
                  {/* 封面 */}
                  <TableCell>
                    <div className="w-12 h-8 rounded-lg bg-surface overflow-hidden border border-divider">
                      {course.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.coverImage}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-caption" />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* 標題 */}
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-heading">
                          {course.title}
                        </p>
                        {course._count.instructors === 0 && (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 rounded-full text-xs">
                            全講師共管
                          </Badge>
                        )}
                      </div>
                      {course.subtitle && (
                        <p className="text-sm text-body truncate max-w-xs">
                          {course.subtitle}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  {/* 狀態 */}
                  <TableCell>
                    <Badge
                      variant={status.variant}
                      className={
                        status.variant === 'default'
                          ? 'bg-emerald-500 hover:bg-emerald-500 text-white rounded-full'
                          : status.variant === 'secondary'
                          ? 'bg-surface hover:bg-surface text-body border border-divider rounded-full'
                          : 'border-divider text-caption rounded-full'
                      }
                    >
                      {status.label}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`rounded-full ${visibility.className}`}
                    >
                      {visibility.label}
                    </Badge>
                  </TableCell>

                  {/* 價格 */}
                  <TableCell className="text-right">
                    {course.salePrice != null ? (
                      <div>
                        <p className="text-heading font-medium">
                          {course.salePrice === 0 ? '免費' : formatCurrency(course.salePrice)}
                        </p>
                        <p className="text-xs text-caption line-through">
                          {formatCurrency(course.price)}
                        </p>
                        {course.saleCycleEnabled && (
                          <p className="text-[10px] text-cta font-medium mt-0.5">
                            永久免費
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-heading font-medium">
                        {formatCurrency(course.price)}
                      </p>
                    )}
                  </TableCell>

                  {/* 建立日期 */}
                  <TableCell>
                    <p className="text-body text-sm">
                      {format(new Date(course.createdAt), 'yyyy/MM/dd', {
                        locale: zhTW,
                      })}
                    </p>
                  </TableCell>

                  {/* 操作 */}
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface rounded-lg"
                            asChild
                          >
                            <Link
                              href={`/courses/${course.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="開新頁預覽"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>開新頁預覽</TooltipContent>
                      </Tooltip>
                      {isInviteOnly ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface rounded-lg"
                              asChild
                            >
                              <Link
                                href={`/admin/courses/${course.id}/invites`}
                                aria-label="管理邀請"
                              >
                                <Link2 className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>管理邀請</TooltipContent>
                        </Tooltip>
                      ) : canCopyCourseLink ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface rounded-lg"
                              onClick={() => handleCopy(course.slug)}
                              aria-label="複製連結"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>複製連結</TooltipContent>
                        </Tooltip>
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface rounded-lg"
                            asChild
                          >
                            <Link
                              href={`/admin/courses/${course.id}`}
                              aria-label="編輯"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>編輯</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => handleDeleteClick(course)}
                            disabled={isActioning}
                          >
                            {isActioning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>刪除</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 刪除確認對話框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認刪除課程</DialogTitle>
            <DialogDescription className="text-body">
              您確定要刪除「{courseToDelete?.title}」嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
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
    </>
  )
}
