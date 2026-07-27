// components/admin/assignment/review-panel.tsx
// 批改面板 — 可嵌入 Dialog 或作為獨立頁面使用

'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Loader2,
  Download,
  ZoomIn,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Paperclip,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getSubmissionForReview, reviewSubmission } from '@/lib/actions/assignment'

interface ReviewPanelProps {
  submissionId: string
  onClose?: () => void
  onReviewed?: () => void
}

type ReviewStatus = 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubmissionData = any

const REVIEW_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: '待批改', className: 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]' },
  UNDER_REVIEW: { label: '批改中', className: 'bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD]' },
  APPROVED: { label: '已通過', className: 'bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]' },
  NEEDS_REVISION: { label: '退回修改', className: 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]' },
  REJECTED: { label: '不通過', className: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]' },
}

const REVIEW_STATUS_BADGE_STYLES: Record<string, string> = {
  APPROVED: 'bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]',
  NEEDS_REVISION: 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]',
  REJECTED: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]',
}

const LETTER_GRADE_LABELS: Record<string, string> = {
  A: 'A（優秀）',
  B: 'B（良好）',
  C: 'C（普通）',
  D: 'D（及格）',
  F: 'F（不及格）',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ContentDisplay({ content, contentFormat }: { content: string | null; contentFormat?: string }) {
  if (!content) return <p className="text-sm text-muted-foreground italic">（無文字內容）</p>

  return (
    <div
      className={`text-sm leading-relaxed whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-4 border ${
        contentFormat === 'MARKDOWN' ? 'font-mono text-xs' : ''
      }`}
    >
      {content}
    </div>
  )
}

function ImageGrid({ attachments }: { attachments: { id: string; url: string; filename: string; size: number }[] }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  if (attachments.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {attachments.map((att) => (
          <button
            key={att.id}
            type="button"
            onClick={() => setLightboxUrl(att.url)}
            className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:border-primary/50 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={att.url}
              alt={att.filename}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
              <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {attachments.length} 張圖片
        {attachments[0]?.size && (
          <> · 合計 {formatFileSize(attachments.reduce((a, b) => a + b.size, 0))}</>
        )}
      </p>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="預覽"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

function FileList({ attachments }: { attachments: { id: string; url: string; filename: string; size: number }[] }) {
  if (attachments.length === 0) return null

  return (
    <div className="space-y-2">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/30"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-sm truncate">{att.filename}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatFileSize(att.size)}
            </span>
          </div>
          <a
            href={att.url}
            download={att.filename}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      ))}
    </div>
  )
}

export function ReviewPanel({ submissionId, onClose, onReviewed }: ReviewPanelProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<SubmissionData>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Review form state
  const [feedback, setFeedback] = useState('')
  const [score, setScore] = useState('')
  const [letterGrade, setLetterGrade] = useState('')
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null)

  const loadSubmission = useCallback(async () => {
    setLoading(true)
    const result = await getSubmissionForReview(submissionId)
    if (result.success && result.data) {
      setSubmission(result.data)
    }
    setLoading(false)
  }, [submissionId])

  useEffect(() => {
    loadSubmission()
  }, [loadSubmission])

  async function handleSubmitReview() {
    if (!reviewStatus) {
      toast.error('請選擇批改結果')
      return
    }

    const gradingType = submission?.assignment?.gradingType
    if (gradingType === 'PERCENTAGE' && !score) {
      toast.error('請輸入分數')
      return
    }
    if (gradingType === 'LETTER_GRADE' && !letterGrade) {
      toast.error('請選擇等第')
      return
    }

    setSubmitting(true)
    try {
      const result = await reviewSubmission({
        submissionId,
        status: reviewStatus,
        feedback: feedback || null,
        score: gradingType === 'PERCENTAGE' && score ? parseInt(score) : null,
        letterGrade:
          gradingType === 'LETTER_GRADE' && letterGrade
            ? (letterGrade as 'A' | 'B' | 'C' | 'D' | 'F')
            : null,
      })

      if (!result.success) {
        toast.error(result.error || '批改失敗')
      } else {
        toast.success('批改完成，已通知學員')
        onReviewed?.()
      }
    } catch {
      toast.error('批改失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">找不到提交資料</p>
        {onClose && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onClose}>
            關閉
          </Button>
        )}
      </div>
    )
  }

  const assignment = submission.assignment
  const gradingType = assignment?.gradingType ?? 'PASS_FAIL'
  const currentStatusStyle =
    REVIEW_STATUS_STYLES[submission.status] ?? REVIEW_STATUS_STYLES.SUBMITTED
  const isAlreadyReviewed =
    submission.status === 'APPROVED' ||
    submission.status === 'REJECTED'

  // Categorise attachments
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageAttachments = (submission.attachments ?? []).filter((a: any) =>
    imageExts.some((ext) => a.filename?.toLowerCase().endsWith(`.${ext}`))
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileAttachments = (submission.attachments ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => !imageExts.some((ext) => a.filename?.toLowerCase().endsWith(`.${ext}`))
  )

  return (
    <div className="space-y-5">
      {/* 提交者資訊 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{submission.user?.name || '未設定姓名'}</p>
          <p className="text-sm text-muted-foreground">{submission.user?.email}</p>
          {submission.submittedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              提交於{' '}
              {format(new Date(submission.submittedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
              {(submission.version ?? 1) > 1 && (
                <> · 第 {submission.version} 次提交</>
              )}
            </p>
          )}
        </div>
        <Badge className={`text-xs ${currentStatusStyle.className}`}>
          {currentStatusStyle.label}
        </Badge>
      </div>

      <Separator />

      {/* 提交內容 */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          提交內容
        </p>

        {/* 文字 */}
        {submission.content && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>文字內容</span>
            </div>
            <ContentDisplay
              content={submission.content}
              contentFormat={submission.contentFormat}
            />
          </div>
        )}

        {/* 圖片 */}
        {imageAttachments.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              <span>圖片</span>
            </div>
            <ImageGrid attachments={imageAttachments} />
          </div>
        )}

        {/* 檔案 */}
        {fileAttachments.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              <span>附件</span>
            </div>
            <FileList attachments={fileAttachments} />
          </div>
        )}

        {!submission.content && imageAttachments.length === 0 && fileAttachments.length === 0 && (
          <p className="text-sm text-muted-foreground italic">（此提交沒有內容）</p>
        )}
      </div>

      <Separator />

      {/* 批改表單 */}
      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          批改
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="review-feedback">批改評語</Label>
          <Textarea
            id="review-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="給學員的評語與建議（選填，將以 Email 通知學員）"
            rows={4}
          />
        </div>

        {/* 評分 UI — 依 gradingType */}
        {gradingType === 'PERCENTAGE' && (
          <div className="space-y-1.5">
            <Label htmlFor="review-score">分數（0–100）</Label>
            <div className="flex items-center gap-2">
              <Input
                id="review-score"
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-24"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">
                / 100 分（及格：{assignment?.passingScore ?? 60} 分）
              </span>
            </div>
          </div>
        )}

        {gradingType === 'LETTER_GRADE' && (
          <div className="space-y-1.5">
            <Label>等第</Label>
            <Select value={letterGrade} onValueChange={setLetterGrade}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="選擇等第" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LETTER_GRADE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 批改結果按鈕 */}
        <div className="space-y-1.5">
          <Label>批改結果</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={reviewStatus === 'APPROVED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReviewStatus('APPROVED')}
              className={
                reviewStatus === 'APPROVED'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                  : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-500'
              }
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              通過
            </Button>
            <Button
              type="button"
              variant={reviewStatus === 'NEEDS_REVISION' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReviewStatus('NEEDS_REVISION')}
              className={
                reviewStatus === 'NEEDS_REVISION'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                  : 'text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-500'
              }
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              退回修改
            </Button>
            <Button
              type="button"
              variant={reviewStatus === 'REJECTED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReviewStatus('REJECTED')}
              className={
                reviewStatus === 'REJECTED'
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                  : 'text-red-700 border-red-300 hover:bg-red-50 hover:border-red-500'
              }
            >
              <XCircle className="h-4 w-4 mr-1" />
              不通過
            </Button>
          </div>
        </div>

        {isAlreadyReviewed && (
          <p className="text-xs text-muted-foreground">
            此提交已批改過，提交新批改將覆蓋狀態並再次通知學員。
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSubmitReview}
            disabled={submitting || !reviewStatus}
            className="flex-1"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            送出批改
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              取消
            </Button>
          )}
        </div>
      </div>

      {/* 歷史批改紀錄 */}
      {submission.reviews && submission.reviews.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showHistory ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              歷史批改紀錄（{submission.reviews.length} 筆）
            </button>

            {showHistory && (
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {submission.reviews.map((review: any, index: number) => (
                  <div
                    key={review.id ?? index}
                    className="rounded-lg border bg-muted/30 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-xs ${REVIEW_STATUS_BADGE_STYLES[review.status] ?? ''}`}
                        >
                          {review.status === 'APPROVED'
                            ? '通過'
                            : review.status === 'NEEDS_REVISION'
                              ? '退回修改'
                              : '不通過'}
                        </Badge>
                        {review.score != null && (
                          <span className="text-xs text-muted-foreground">
                            {review.score} 分
                          </span>
                        )}
                        {review.letterGrade && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {review.letterGrade}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {review.reviewer?.name ?? '管理員'}
                        {review.createdAt && (
                          <> ·{' '}
                            {format(new Date(review.createdAt), 'MM/dd HH:mm', {
                              locale: zhTW,
                            })}
                          </>
                        )}
                      </span>
                    </div>
                    {review.feedback && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {review.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
