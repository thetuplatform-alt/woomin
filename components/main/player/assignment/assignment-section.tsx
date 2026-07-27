'use client'

// components/main/player/assignment/assignment-section.tsx
// 前台作業入口區塊 — 顯示在課程播放頁單元內容下方

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getAssignmentForStudent } from '@/lib/actions/assignment-student'
import { AssignmentForm } from './assignment-form'
import type { UploadedFile } from './file-upload-zone'

// ==================== 型別 ====================

type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'NEEDS_REVISION'
  | 'REJECTED'

type GradingType = 'PASS_FAIL' | 'PERCENTAGE' | 'LETTER_GRADE'
type SubmissionType = 'TEXT' | 'IMAGE' | 'FILE' | 'MIXED'

interface AssignmentData {
  id: string
  title: string
  description: string | null
  submissionType: SubmissionType
  editorMode: 'PLAIN' | 'MARKDOWN'
  minWords: number | null
  maxWords: number | null
  maxImages: number | null
  maxImageSize: number | null
  maxFiles: number | null
  maxFileSize: number | null
  allowedExtensions: string[] | null
  gradingType: GradingType
  passingScore: number | null
  deadline: Date | null
  allowLateSubmission: boolean
  allowResubmission: boolean
}

interface ReviewData {
  status: string
  feedback: string | null
  score: number | null
  letterGrade: string | null
  reviewer: { name: string | null }
  createdAt: Date
}

interface AttachmentData {
  id: string
  filename: string
  mimeType: string
  size: number
  url: string
  type: string
}

interface SubmissionData {
  id: string
  content: string | null
  contentFormat: string | null
  wordCount: number | null
  status: SubmissionStatus
  isLate: boolean
  submittedAt: Date | null
  revisionNumber: number
  attachments: AttachmentData[]
  reviews: ReviewData[]
}

interface DraftData {
  content: string | null
  contentFormat: string | null
}

// ==================== 輔助元件 ====================

const STATUS_CONFIG: Record<
  SubmissionStatus,
  { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline'; className: string }
> = {
  DRAFT: {
    label: '草稿',
    variant: 'secondary',
    className: 'bg-muted text-muted-foreground',
  },
  SUBMITTED: {
    label: '已送出',
    variant: 'default',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  UNDER_REVIEW: {
    label: '審核中',
    variant: 'outline',
    className: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  },
  APPROVED: {
    label: '已通過',
    variant: 'default',
    className: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  },
  NEEDS_REVISION: {
    label: '退回修改',
    variant: 'outline',
    className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  REJECTED: {
    label: '未通過',
    variant: 'destructive',
    className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  },
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

function SubmissionTypeLabel({ type }: { type: SubmissionType }) {
  const map: Record<SubmissionType, string> = {
    TEXT: '文字作業',
    IMAGE: '圖片作業',
    FILE: '檔案作業',
    MIXED: '混合作業（文字 + 附件）',
  }
  return <span>{map[type]}</span>
}

function GradingTypeLabel({ type }: { type: GradingType }) {
  const map: Record<GradingType, string> = {
    PASS_FAIL: '通過／不通過',
    PERCENTAGE: '百分制',
    LETTER_GRADE: '等第制（A–F）',
  }
  return <span>{map[type]}</span>
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ==================== 主元件 ====================

interface AssignmentSectionProps {
  lessonId: string
}

export function AssignmentSection({ lessonId }: AssignmentSectionProps) {
  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState<AssignmentData | null>(null)
  const [submission, setSubmission] = useState<SubmissionData | null>(null)
  const [draft, setDraft] = useState<DraftData | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [resubmitMode, setResubmitMode] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await getAssignmentForStudent(lessonId)
    if (result.success && result.data) {
      setAssignment(result.data.assignment as AssignmentData)
      setSubmission(result.data.submission as SubmissionData | null)
      setDraft(result.data.draft as DraftData | null)
    }
    setLoading(false)
  }, [lessonId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmitted = useCallback(async () => {
    setFormOpen(false)
    setResubmitMode(false)
    await loadData()
  }, [loadData])

  // 沒有作業時不渲染
  if (!loading && !assignment) return null

  // 載入骨架
  if (loading) {
    return (
      <Card className="mt-6 animate-pulse">
        <CardHeader>
          <div className="h-5 w-1/3 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!assignment) return null

  const latestReview = submission?.reviews?.[0] ?? null
  const isDeadlinePassed = assignment.deadline ? new Date() > new Date(assignment.deadline) : false

  // 初始附件（草稿或 NEEDS_REVISION 重提時沿用）
  const initialAttachments: UploadedFile[] =
    (resubmitMode || !submission
      ? submission?.attachments?.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: a.url,
          type: a.type as 'IMAGE' | 'FILE',
        }))
      : []) ?? []

  return (
    <Card className="mt-6 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-base font-semibold">{assignment.title}</CardTitle>
          </div>
          {submission && <StatusBadge status={submission.status} />}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 作業說明 */}
        {assignment.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {assignment.description}
          </p>
        )}

        {/* 作業資訊 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <span className="font-medium text-foreground/70">類型：</span>
            <SubmissionTypeLabel type={assignment.submissionType} />
          </div>
          <div>
            <span className="font-medium text-foreground/70">評分：</span>
            <GradingTypeLabel type={assignment.gradingType} />
          </div>
          {assignment.minWords && (
            <div>
              <span className="font-medium text-foreground/70">最少字數：</span>
              {assignment.minWords} 字
            </div>
          )}
          {assignment.maxWords && (
            <div>
              <span className="font-medium text-foreground/70">最多字數：</span>
              {assignment.maxWords} 字
            </div>
          )}
          {assignment.maxImages && (
            <div>
              <span className="font-medium text-foreground/70">圖片上限：</span>
              {assignment.maxImages} 張
            </div>
          )}
          {assignment.maxFiles && (
            <div>
              <span className="font-medium text-foreground/70">檔案上限：</span>
              {assignment.maxFiles} 個
            </div>
          )}
          {assignment.deadline && (
            <div className={`col-span-2 ${isDeadlinePassed ? 'text-destructive' : ''}`}>
              <span className="font-medium text-foreground/70">
                <Clock className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                截止時間：
              </span>
              {formatDate(assignment.deadline)}
              {isDeadlinePassed && (
                <span className="ml-1">
                  {assignment.allowLateSubmission ? '（補交中）' : '（已截止）'}
                </span>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* 根據狀態顯示不同 UI */}

        {/* 無提交 或 DRAFT → 顯示開始作業 */}
        {(!submission || submission.status === 'DRAFT') && (
          <div className="space-y-3">
            {!formOpen ? (
              <Button
                variant="default"
                className="w-full sm:w-auto gap-2"
                onClick={() => setFormOpen(true)}
                disabled={isDeadlinePassed && !assignment.allowLateSubmission}
              >
                <ChevronDown className="h-4 w-4" />
                開始寫作業
              </Button>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">填寫作業</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => setFormOpen(false)}
                  >
                    <ChevronUp className="h-3 w-3" />
                    收起
                  </Button>
                </div>
                <AssignmentForm
                  assignment={assignment}
                  initialContent={draft?.content ?? ''}
                  onSubmitted={handleSubmitted}
                />
              </>
            )}
          </div>
        )}

        {/* SUBMITTED / UNDER_REVIEW → 唯讀顯示 */}
        {submission &&
          (submission.status === 'SUBMITTED' || submission.status === 'UNDER_REVIEW') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>
                  {submission.status === 'SUBMITTED'
                    ? '作業已送出，等待批改'
                    : '作業審核中'}
                  {submission.submittedAt && (
                    <span className="ml-1 text-muted-foreground text-xs">
                      （{formatDate(submission.submittedAt)}）
                    </span>
                  )}
                </span>
              </div>
              {submission.content && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {submission.content}
                </div>
              )}
              {submission.attachments.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  附件 {submission.attachments.length} 個
                </p>
              )}
            </div>
          )}

        {/* APPROVED → 通過 */}
        {submission && submission.status === 'APPROVED' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              作業已通過！
            </div>
            {latestReview && (
              <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-1">
                {latestReview.score !== null && (
                  <p className="text-sm font-medium">
                    分數：{latestReview.score}
                    {assignment.gradingType === 'LETTER_GRADE' &&
                      latestReview.letterGrade &&
                      `（${latestReview.letterGrade}）`}
                  </p>
                )}
                {latestReview.feedback && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {latestReview.feedback}
                  </p>
                )}
                {latestReview.reviewer.name && (
                  <p className="text-xs text-muted-foreground">
                    批改者：{latestReview.reviewer.name}
                  </p>
                )}
              </div>
            )}
            {submission.content && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                {submission.content}
              </div>
            )}
          </div>
        )}

        {/* NEEDS_REVISION → 退回修改 */}
        {submission && submission.status === 'NEEDS_REVISION' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              作業退回，請修改後重新提交
            </div>
            {latestReview?.feedback && (
              <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">退回原因</p>
                <p className="text-sm whitespace-pre-wrap">{latestReview.feedback}</p>
                {latestReview.reviewer.name && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    批改者：{latestReview.reviewer.name}
                  </p>
                )}
              </div>
            )}
            {assignment.allowResubmission && (
              <>
                {!resubmitMode ? (
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={() => setResubmitMode(true)}
                    disabled={isDeadlinePassed && !assignment.allowLateSubmission}
                  >
                    <RefreshCw className="h-4 w-4" />
                    重新提交
                  </Button>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">修改並重新提交</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setResubmitMode(false)}
                      >
                        <ChevronUp className="h-3 w-3" />
                        收起
                      </Button>
                    </div>
                    <AssignmentForm
                      assignment={assignment}
                      initialContent={submission.content ?? draft?.content ?? ''}
                      initialAttachments={initialAttachments}
                      submissionId={submission.id}
                      onSubmitted={handleSubmitted}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* REJECTED → 不通過 */}
        {submission && submission.status === 'REJECTED' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <XCircle className="h-4 w-4" />
              作業未通過
            </div>
            {latestReview && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                {latestReview.feedback && (
                  <p className="text-sm whitespace-pre-wrap">{latestReview.feedback}</p>
                )}
                {latestReview.reviewer.name && (
                  <p className="text-xs text-muted-foreground">
                    批改者：{latestReview.reviewer.name}
                  </p>
                )}
              </div>
            )}
            {submission.content && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                {submission.content}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
