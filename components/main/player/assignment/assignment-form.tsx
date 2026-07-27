'use client'

// components/main/player/assignment/assignment-form.tsx
// 作業提交表單

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Send, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { saveAssignmentDraft, submitAssignment, resubmitAssignment } from '@/lib/actions/assignment-student'
import { countWords } from '@/lib/validations/assignment'
import { FileUploadZone, type UploadedFile } from './file-upload-zone'

interface AssignmentConfig {
  id: string
  submissionType: 'TEXT' | 'IMAGE' | 'FILE' | 'MIXED'
  editorMode: 'PLAIN' | 'MARKDOWN'
  minWords: number | null
  maxWords: number | null
  maxImages: number | null
  maxImageSize: number | null
  maxFiles: number | null
  maxFileSize: number | null
  allowedExtensions: string[] | null
  deadline: Date | null
  allowLateSubmission: boolean
}

interface AssignmentFormProps {
  assignment: AssignmentConfig
  initialContent?: string
  initialAttachments?: UploadedFile[]
  submissionId?: string
  onSubmitted: () => void
}

const LOCAL_DRAFT_PREFIX = 'assignment-draft-'
const DEBOUNCE_LOCAL_MS = 1000
const DEBOUNCE_SERVER_MS = 10000

// 字數顯示顏色
function wordCountColor(count: number, min: number | null, max: number | null): string {
  if (max && count > max) return 'text-destructive font-semibold'
  if (min && count < min) return 'text-amber-500'
  return 'text-muted-foreground'
}

export function AssignmentForm({
  assignment,
  initialContent = '',
  initialAttachments = [],
  submissionId,
  onSubmitted,
}: AssignmentFormProps) {
  const [content, setContent] = useState(initialContent)
  const [attachments, setAttachments] = useState<UploadedFile[]>(initialAttachments)
  const [showPreview, setShowPreview] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [restoredContent, setRestoredContent] = useState('')
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  const isTextBased =
    assignment.submissionType === 'TEXT' || assignment.submissionType === 'MIXED'
  const hasImages =
    assignment.submissionType === 'IMAGE' || assignment.submissionType === 'MIXED'
  const hasFiles =
    assignment.submissionType === 'FILE' || assignment.submissionType === 'MIXED'

  const wordCount = countWords(content)
  const localDraftKey = `${LOCAL_DRAFT_PREFIX}${assignment.id}`

  // 初始化：檢查草稿
  useEffect(() => {
    const localDraft = localStorage.getItem(localDraftKey)
    if (localDraft && localDraft !== initialContent && isTextBased) {
      setRestoredContent(localDraft)
      setShowRestoreDialog(true)
    }
    isFirstRender.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 自動儲存 debounce
  useEffect(() => {
    if (isFirstRender.current) return

    // localStorage debounce 1s
    if (localTimerRef.current) clearTimeout(localTimerRef.current)
    localTimerRef.current = setTimeout(() => {
      if (isTextBased && content) {
        localStorage.setItem(localDraftKey, content)
      } else if (!content) {
        localStorage.removeItem(localDraftKey)
      }
    }, DEBOUNCE_LOCAL_MS)

    // Server debounce 10s
    if (serverTimerRef.current) clearTimeout(serverTimerRef.current)
    setDraftStatus('saving')
    serverTimerRef.current = setTimeout(async () => {
      const result = await saveAssignmentDraft({
        assignmentId: assignment.id,
        content: content || null,
        contentFormat: assignment.editorMode,
      })
      if (result.success) {
        setDraftStatus('saved')
        setTimeout(() => setDraftStatus('idle'), 2000)
      } else {
        setDraftStatus('idle')
      }
    }, DEBOUNCE_SERVER_MS)

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current)
      if (serverTimerRef.current) clearTimeout(serverTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const handleRestoreDraft = useCallback(() => {
    setContent(restoredContent)
    setShowRestoreDialog(false)
  }, [restoredContent])

  const handleDiscardDraft = useCallback(() => {
    localStorage.removeItem(localDraftKey)
    setShowRestoreDialog(false)
  }, [localDraftKey])

  const validateBeforeSubmit = useCallback((): string | null => {
    if (isTextBased) {
      if (assignment.minWords && wordCount < assignment.minWords) {
        return `字數不足，至少需要 ${assignment.minWords} 字（目前 ${wordCount} 字）`
      }
      if (assignment.maxWords && wordCount > assignment.maxWords) {
        return `字數超過上限，最多 ${assignment.maxWords} 字（目前 ${wordCount} 字）`
      }
    }
    const imageCount = attachments.filter((a) => a.type === 'IMAGE').length
    const fileCount = attachments.filter((a) => a.type === 'FILE').length
    if (hasImages && assignment.maxImages && imageCount > assignment.maxImages) {
      return `圖片數量超過上限 ${assignment.maxImages} 張`
    }
    if (hasFiles && assignment.maxFiles && fileCount > assignment.maxFiles) {
      return `檔案數量超過上限 ${assignment.maxFiles} 個`
    }
    // 確保至少有內容
    const hasText = isTextBased && content.trim().length > 0
    const hasAttachments = attachments.length > 0
    if (!hasText && !hasAttachments) {
      return '請填寫作業內容或上傳附件'
    }
    return null
  }, [
    assignment.maxFiles,
    assignment.maxImages,
    assignment.maxWords,
    assignment.minWords,
    attachments,
    content,
    hasFiles,
    hasImages,
    isTextBased,
    wordCount,
  ])

  const handleSubmitConfirm = useCallback(async () => {
    setIsSubmitting(true)
    try {
      let result
      if (submissionId) {
        result = await resubmitAssignment({
          submissionId,
          content: content || null,
          contentFormat: assignment.editorMode,
        })
      } else {
        result = await submitAssignment({
          assignmentId: assignment.id,
          content: content || null,
          contentFormat: assignment.editorMode,
        })
      }

      if (!result.success) {
        toast.error(result.error ?? '送出失敗，請重試')
        return
      }

      // 清除草稿
      localStorage.removeItem(localDraftKey)
      if (localTimerRef.current) clearTimeout(localTimerRef.current)
      if (serverTimerRef.current) clearTimeout(serverTimerRef.current)

      toast.success('作業已送出！')
      setShowSubmitDialog(false)
      onSubmitted()
    } catch {
      toast.error('送出時發生錯誤，請重試')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    assignment.editorMode,
    assignment.id,
    content,
    localDraftKey,
    onSubmitted,
    submissionId,
  ])

  const handleSubmitClick = useCallback(() => {
    const error = validateBeforeSubmit()
    if (error) {
      toast.error(error)
      return
    }
    setShowSubmitDialog(true)
  }, [validateBeforeSubmit])

  const isDeadlinePassed = assignment.deadline
    ? new Date() > new Date(assignment.deadline)
    : false
  const cannotSubmit = isDeadlinePassed && !assignment.allowLateSubmission

  return (
    <div className="space-y-4">
      {/* 截止日警告 */}
      {isDeadlinePassed && assignment.allowLateSubmission && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>已超過截止日期，此為補交作業</span>
        </div>
      )}
      {cannotSubmit && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>已超過截止日期，且此作業不允許補交</span>
        </div>
      )}

      {/* 文字輸入區 */}
      {isTextBased && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">作業內容</label>
            <div className="flex items-center gap-2">
              {/* 草稿狀態 */}
              {draftStatus === 'saving' && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Save className="h-3 w-3 animate-pulse" />
                  自動儲存中...
                </span>
              )}
              {draftStatus === 'saved' && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Save className="h-3 w-3" />
                  草稿已儲存
                </span>
              )}
              {/* Markdown 預覽切換 */}
              {assignment.editorMode === 'MARKDOWN' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="h-3 w-3" />
                      編輯
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" />
                      預覽
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {showPreview && assignment.editorMode === 'MARKDOWN' ? (
            <div
              className="min-h-[160px] rounded-md border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
              style={{ minHeight: 160 }}
            >
              {content || <span className="text-muted-foreground">（無內容）</span>}
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                assignment.editorMode === 'MARKDOWN'
                  ? '請輸入作業內容（支援 Markdown 語法）...'
                  : '請輸入作業內容...'
              }
              className="min-h-[160px] resize-y text-sm"
              disabled={cannotSubmit}
            />
          )}

          {/* 字數統計 */}
          <div className="flex items-center justify-end gap-1 text-xs">
            <span className={wordCountColor(wordCount, assignment.minWords, assignment.maxWords)}>
              {wordCount} 字
            </span>
            {(assignment.minWords || assignment.maxWords) && (
              <span className="text-muted-foreground">
                {assignment.minWords && `（至少 ${assignment.minWords} 字`}
                {assignment.minWords && assignment.maxWords && '，'}
                {assignment.maxWords && `最多 ${assignment.maxWords} 字`}
                {(assignment.minWords || assignment.maxWords) && '）'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 圖片上傳 */}
      {hasImages && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            附圖
            {assignment.maxImages && (
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                （最多 {assignment.maxImages} 張）
              </span>
            )}
          </label>
          <FileUploadZone
            assignmentId={assignment.id}
            fileType="image"
            maxCount={assignment.maxImages ?? 10}
            maxSize={assignment.maxImageSize ?? 10 * 1024 * 1024}
            existingFiles={attachments.filter((a) => a.type === 'IMAGE')}
            onFilesChanged={(imgs) =>
              setAttachments([...attachments.filter((a) => a.type === 'FILE'), ...imgs])
            }
          />
        </div>
      )}

      {/* 檔案上傳 */}
      {hasFiles && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            附件
            {assignment.maxFiles && (
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                （最多 {assignment.maxFiles} 個）
              </span>
            )}
          </label>
          <FileUploadZone
            assignmentId={assignment.id}
            fileType="file"
            maxCount={assignment.maxFiles ?? 5}
            maxSize={assignment.maxFileSize ?? 10 * 1024 * 1024}
            allowedExtensions={assignment.allowedExtensions ?? undefined}
            existingFiles={attachments.filter((a) => a.type === 'FILE')}
            onFilesChanged={(files) =>
              setAttachments([...attachments.filter((a) => a.type === 'IMAGE'), ...files])
            }
          />
        </div>
      )}

      {/* 送出按鈕 */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmitClick}
          disabled={cannotSubmit || isSubmitting}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {submissionId ? '重新送出' : '送出作業'}
        </Button>
      </div>

      {/* 草稿還原 Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>偵測到未送出的草稿</DialogTitle>
            <DialogDescription>
              上次您有填寫但尚未送出的草稿，是否要還原？
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
            {restoredContent}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDiscardDraft}>
              捨棄草稿
            </Button>
            <Button onClick={handleRestoreDraft}>還原草稿</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 送出確認 Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認送出作業</DialogTitle>
            <DialogDescription>
              {assignment.allowLateSubmission
                ? '送出後如需修改，可以重新提交。'
                : '送出後將無法修改，請確認內容正確。'}
            </DialogDescription>
          </DialogHeader>

          {/* 預覽提交內容 */}
          <div className="space-y-3">
            {isTextBased && content && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">作業內容預覽</p>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {content}
                </div>
                <p className="mt-1 text-right text-xs text-muted-foreground">{wordCount} 字</p>
              </div>
            )}
            {attachments.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">附件</p>
                <p className="text-sm text-muted-foreground">
                  共 {attachments.length} 個附件
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              disabled={isSubmitting}
            >
              返回修改
            </Button>
            <Button onClick={handleSubmitConfirm} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>送出中...</>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  確認送出
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
