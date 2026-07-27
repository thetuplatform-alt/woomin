// components/admin/comments/comment-summary-panel.tsx
// 課程留言側邊欄 - 顯示各單元留言摘要，支援已讀/未讀機制

'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCourseEditor } from '@/lib/contexts/course-editor-context'
import {
  getCourseCommentSummaries,
  markLessonCommentsAsRead,
  type LessonCommentSummary,
} from '@/lib/actions/lesson-comments-admin'
import { Badge } from '@/components/ui/badge'

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return '剛剛'
  if (diffMin < 60) return `${diffMin} 分鐘前`
  if (diffHour < 24) return `${diffHour} 小時前`
  if (diffDay < 30) return `${diffDay} 天前`
  return `${Math.floor(diffDay / 30)} 個月前`
}

interface CommentSummaryPanelProps {
  courseId: string
}

export function CommentSummaryPanel({ courseId }: CommentSummaryPanelProps) {
  const { selectedLessonId, setSelectedLessonId } = useCourseEditor()
  const [summaries, setSummaries] = useState<LessonCommentSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCourseCommentSummaries(courseId)
      setSummaries(data)
    } catch (e) {
      console.error(e)
      toast.error('載入留言摘要失敗')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const handleSelect = async (lessonId: string) => {
    setSelectedLessonId(lessonId)

    // 點選時標記該單元留言為已讀
    const summary = summaries.find((s) => s.lessonId === lessonId)
    if (summary && summary.unreadCount > 0) {
      await markLessonCommentsAsRead(lessonId)
      setSummaries((prev) =>
        prev.map((s) =>
          s.lessonId === lessonId ? { ...s, unreadCount: 0 } : s
        )
      )
    }
  }

  const totalUnread = summaries.reduce((acc, s) => acc + s.unreadCount, 0)
  const totalComments = summaries.reduce((acc, s) => acc + s.totalCount, 0)

  return (
    <div className="flex flex-col h-full">
      {/* 統計區塊 */}
      <div data-tour="comment-unread-badge" className="p-4 border-b border-divider">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-heading flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-cta" />
            留言總覽
          </h2>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs text-body hover:text-heading transition-colors"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : '重新整理'}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span className="text-body">共 {totalComments} 則</span>
          {totalUnread > 0 && (
            <Badge className="bg-red-500 text-white hover:bg-red-500 text-xs px-1.5 py-0">
              {totalUnread} 則未讀
            </Badge>
          )}
        </div>
      </div>

      {/* 單元留言列表 */}
      <div data-tour="comment-lesson-list" className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-caption" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="p-6 text-center">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 text-[#D4D4D4]" />
            <p className="text-sm text-body">目前沒有留言</p>
            <p className="text-xs text-caption mt-1">
              學員留言後會出現在這裡
            </p>
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {summaries.map((summary) => {
              const isSelected = selectedLessonId === summary.lessonId
              const hasUnread = summary.unreadCount > 0

              return (
                <button
                  key={summary.lessonId}
                  onClick={() => handleSelect(summary.lessonId)}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors',
                    isSelected
                      ? 'bg-cta/10 border-l-2 border-cta'
                      : 'hover:bg-surface border-l-2 border-transparent',
                    hasUnread && !isSelected && 'bg-blue-50/50'
                  )}
                >
                  {/* 單元標題與留言數 */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm truncate',
                        hasUnread
                          ? 'font-bold text-heading'
                          : 'font-medium text-body'
                      )}
                    >
                      {summary.lessonTitle}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hasUnread && (
                        <Badge className="bg-red-500 text-white hover:bg-red-500 text-[10px] px-1 py-0 min-w-[18px] flex justify-center">
                          {summary.unreadCount}
                        </Badge>
                      )}
                      <span className="text-[10px] text-caption">
                        {summary.totalCount}
                      </span>
                    </div>
                  </div>

                  {/* 最新留言摘要 */}
                  {summary.latestComment && (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-caption">
                        <span>
                          {summary.latestComment.userName ?? '學員'}
                        </span>
                        <span>·</span>
                        <span>
                          {formatTimeAgo(summary.latestComment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-body line-clamp-2 leading-relaxed">
                        {summary.latestComment.content}
                      </p>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
