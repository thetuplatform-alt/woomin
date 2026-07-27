// components/admin/assignment/assignment-editor.tsx
// 後台作業設定編輯器

'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  getAssignmentForAdmin,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '@/lib/actions/assignment'
import { DEFAULT_ALLOWED_EXTENSIONS } from '@/lib/validations/assignment'

interface AssignmentEditorProps {
  lessonId: string
  courseId: string
}

type SubmissionType = 'TEXT' | 'IMAGE' | 'FILE' | 'MIXED'
type EditorMode = 'PLAIN' | 'MARKDOWN'
type GradingType = 'PASS_FAIL' | 'PERCENTAGE' | 'LETTER_GRADE'

interface FormState {
  title: string
  description: string
  submissionType: SubmissionType
  editorMode: EditorMode
  minWords: string
  maxWords: string
  maxImages: string
  maxImageSizeMB: string
  maxFiles: string
  maxFileSizeMB: string
  allowedExtensions: string[]
  gradingType: GradingType
  passingScore: string
  deadline: string
  allowLateSubmission: boolean
  allowResubmission: boolean
  autoCleanupDays: string
}

const DEFAULT_FORM: FormState = {
  title: '',
  description: '',
  submissionType: 'TEXT',
  editorMode: 'MARKDOWN',
  minWords: '',
  maxWords: '',
  maxImages: '10',
  maxImageSizeMB: '10',
  maxFiles: '5',
  maxFileSizeMB: '10',
  allowedExtensions: [],
  gradingType: 'PASS_FAIL',
  passingScore: '60',
  deadline: '',
  allowLateSubmission: false,
  allowResubmission: true,
  autoCleanupDays: '',
}

const PRESET_EXTENSION_GROUPS = [
  { label: '圖片', extensions: DEFAULT_ALLOWED_EXTENSIONS.image as readonly string[] },
  { label: '文件', extensions: DEFAULT_ALLOWED_EXTENSIONS.document as readonly string[] },
  { label: '壓縮檔', extensions: DEFAULT_ALLOWED_EXTENSIONS.archive as readonly string[] },
  { label: '程式碼', extensions: DEFAULT_ALLOWED_EXTENSIONS.code as readonly string[] },
]

function toDatetimeLocalValue(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assignmentToFormState(a: any): FormState {
  return {
    title: a.title ?? '',
    description: a.description ?? '',
    submissionType: a.submissionType ?? 'TEXT',
    editorMode: a.editorMode ?? 'MARKDOWN',
    minWords: a.minWords != null ? String(a.minWords) : '',
    maxWords: a.maxWords != null ? String(a.maxWords) : '',
    maxImages: a.maxImages != null ? String(a.maxImages) : '10',
    maxImageSizeMB: a.maxImageSize != null ? String(Math.round(a.maxImageSize / 1024 / 1024)) : '10',
    maxFiles: a.maxFiles != null ? String(a.maxFiles) : '5',
    maxFileSizeMB: a.maxFileSize != null ? String(Math.round(a.maxFileSize / 1024 / 1024)) : '10',
    allowedExtensions: a.allowedExtensions ?? [],
    gradingType: a.gradingType ?? 'PASS_FAIL',
    passingScore: a.passingScore != null ? String(a.passingScore) : '60',
    deadline: toDatetimeLocalValue(a.deadline),
    allowLateSubmission: a.allowLateSubmission ?? false,
    allowResubmission: a.allowResubmission ?? true,
    autoCleanupDays: a.autoCleanupDays != null ? String(a.autoCleanupDays) : '',
  }
}

export function AssignmentEditor({ lessonId, courseId }: AssignmentEditorProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [customExtInput, setCustomExtInput] = useState('')

  const loadAssignment = useCallback(async () => {
    setLoading(true)
    const result = await getAssignmentForAdmin(lessonId)
    if (result.success && result.data) {
      setAssignmentId(result.data.id)
      setForm(assignmentToFormState(result.data))
    }
    setLoading(false)
  }, [lessonId])

  useEffect(() => {
    loadAssignment()
  }, [loadAssignment])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleExtension(ext: string) {
    setForm((prev) => {
      const exts = prev.allowedExtensions
      return {
        ...prev,
        allowedExtensions: exts.includes(ext)
          ? exts.filter((e) => e !== ext)
          : [...exts, ext],
      }
    })
  }

  function addCustomExtension() {
    const ext = customExtInput.trim().toLowerCase().replace(/^\./, '')
    if (!ext) return
    if (form.allowedExtensions.includes(ext)) {
      toast.error(`副檔名 .${ext} 已在列表中`)
      return
    }
    setForm((prev) => ({
      ...prev,
      allowedExtensions: [...prev.allowedExtensions, ext],
    }))
    setCustomExtInput('')
  }

  function buildPayload() {
    const showText = form.submissionType === 'TEXT' || form.submissionType === 'MIXED'
    const showImage = form.submissionType === 'IMAGE' || form.submissionType === 'MIXED'
    const showFile = form.submissionType === 'FILE' || form.submissionType === 'MIXED'

    return {
      lessonId,
      title: form.title,
      description: form.description,
      submissionType: form.submissionType,
      editorMode: showText ? form.editorMode : ('MARKDOWN' as EditorMode),
      minWords: showText && form.minWords ? parseInt(form.minWords) : null,
      maxWords: showText && form.maxWords ? parseInt(form.maxWords) : null,
      maxImages: showImage && form.maxImages ? parseInt(form.maxImages) : 10,
      maxImageSize: showImage && form.maxImageSizeMB
        ? parseInt(form.maxImageSizeMB) * 1024 * 1024
        : 10485760,
      maxFiles: showFile && form.maxFiles ? parseInt(form.maxFiles) : 5,
      maxFileSize: showFile && form.maxFileSizeMB
        ? parseInt(form.maxFileSizeMB) * 1024 * 1024
        : 20971520,
      allowedExtensions:
        showFile && form.allowedExtensions.length > 0 ? form.allowedExtensions : null,
      gradingType: form.gradingType,
      passingScore: form.gradingType === 'PERCENTAGE' && form.passingScore
        ? parseInt(form.passingScore)
        : 60,
      deadline: form.deadline ? new Date(form.deadline) : null,
      allowLateSubmission: form.allowLateSubmission,
      allowResubmission: form.allowResubmission,
      autoCleanupDays: form.autoCleanupDays ? parseInt(form.autoCleanupDays) : null,
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('請填寫作業標題')
      return
    }
    if (!form.description.trim()) {
      toast.error('請填寫作業說明')
      return
    }

    setSaving(true)
    try {
      const payload = buildPayload()
      let result

      if (assignmentId) {
        result = await updateAssignment({ ...payload, assignmentId })
      } else {
        result = await createAssignment(payload)
      }

      if (!result.success) {
        toast.error(result.error || '儲存失敗')
      } else {
        toast.success(assignmentId ? '作業設定已更新' : '作業已建立')
        if (!assignmentId && 'data' in result && result.data) {
          setAssignmentId((result.data as { id: string }).id)
        }
      }
    } catch {
      toast.error('儲存失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!assignmentId) return
    if (!confirm('確定要刪除此作業嗎？所有提交紀錄也將一併刪除，此操作無法復原。')) return

    setDeleting(true)
    try {
      const result = await deleteAssignment(assignmentId)
      if (!result.success) {
        toast.error(result.error || '刪除失敗')
      } else {
        toast.success('作業已刪除')
        setAssignmentId(null)
        setForm(DEFAULT_FORM)
      }
    } catch {
      toast.error('刪除失敗，請稍後再試')
    } finally {
      setDeleting(false)
    }
  }

  const showText = form.submissionType === 'TEXT' || form.submissionType === 'MIXED'
  const showImage = form.submissionType === 'IMAGE' || form.submissionType === 'MIXED'
  const showFile = form.submissionType === 'FILE' || form.submissionType === 'MIXED'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">
            {assignmentId ? '編輯作業' : '新增作業'}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {assignmentId
              ? '修改此單元的作業設定'
              : '為此單元建立作業，學員完成課程後可進行提交'}
          </p>
        </div>
        {assignmentId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="ml-1">刪除作業</span>
          </Button>
        )}
      </div>

      {/* 基本資訊 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assignment-title">作業標題 *</Label>
            <Input
              id="assignment-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="例：第一週實作練習"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assignment-description">作業說明 *</Label>
            <Textarea
              id="assignment-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="說明作業要求、格式規範、評分標準等（支援 Markdown）"
              rows={5}
            />
            <p className="text-xs text-muted-foreground">支援 Markdown 語法</p>
          </div>
        </CardContent>
      </Card>

      {/* 提交設定 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">提交類型</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>提交類型</Label>
            <Select
              value={form.submissionType}
              onValueChange={(v) => set('submissionType', v as SubmissionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">文字作答</SelectItem>
                <SelectItem value="IMAGE">圖片上傳</SelectItem>
                <SelectItem value="FILE">檔案上傳</SelectItem>
                <SelectItem value="MIXED">混合（文字 + 圖片 + 檔案）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 文字限制 */}
          {showText && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                文字設定
              </p>
              <div className="space-y-1.5">
                <Label>編輯器模式</Label>
                <Select
                  value={form.editorMode}
                  onValueChange={(v) => set('editorMode', v as EditorMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKDOWN">Markdown 編輯器</SelectItem>
                    <SelectItem value="PLAIN">純文字</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="min-words">最少字數</Label>
                  <Input
                    id="min-words"
                    type="number"
                    min="0"
                    value={form.minWords}
                    onChange={(e) => set('minWords', e.target.value)}
                    placeholder="不限"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-words">最多字數</Label>
                  <Input
                    id="max-words"
                    type="number"
                    min="1"
                    value={form.maxWords}
                    onChange={(e) => set('maxWords', e.target.value)}
                    placeholder="不限"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 圖片限制 */}
          {showImage && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                圖片設定
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="max-images">最多張數</Label>
                  <Input
                    id="max-images"
                    type="number"
                    min="1"
                    max="10"
                    value={form.maxImages}
                    onChange={(e) => set('maxImages', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-image-size">單張大小上限 (MB)</Label>
                  <Input
                    id="max-image-size"
                    type="number"
                    min="1"
                    max="10"
                    value={form.maxImageSizeMB}
                    onChange={(e) => set('maxImageSizeMB', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 檔案限制 */}
          {showFile && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                檔案設定
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="max-files">最多檔案數</Label>
                  <Input
                    id="max-files"
                    type="number"
                    min="1"
                    max="5"
                    value={form.maxFiles}
                    onChange={(e) => set('maxFiles', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-file-size">單檔大小上限 (MB)</Label>
                  <Input
                    id="max-file-size"
                    type="number"
                    min="1"
                    max="10"
                    value={form.maxFileSizeMB}
                    onChange={(e) => set('maxFileSizeMB', e.target.value)}
                  />
                </div>
              </div>

              {/* 允許的副檔名 */}
              <div className="space-y-2">
                <Label>允許的副檔名</Label>
                <p className="text-xs text-muted-foreground">
                  不選擇 = 使用預設允許清單（常見文件、圖片、壓縮檔、程式碼）
                </p>
                <div className="space-y-2">
                  {PRESET_EXTENSION_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs text-muted-foreground mb-1.5">{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.extensions.map((ext) => (
                          <button
                            key={ext}
                            type="button"
                            onClick={() => toggleExtension(ext)}
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono border transition-colors ${
                              form.allowedExtensions.includes(ext)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                            }`}
                          >
                            .{ext}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 自訂副檔名 */}
                <div className="flex gap-2 mt-2">
                  <Input
                    value={customExtInput}
                    onChange={(e) => setCustomExtInput(e.target.value)}
                    placeholder="自訂副檔名（如 sketch）"
                    className="h-8 text-sm font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomExtension()
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addCustomExtension}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* 已選擇的自訂副檔名 */}
                {form.allowedExtensions.filter(
                  (ext) =>
                    !PRESET_EXTENSION_GROUPS.flatMap((g) => g.extensions).includes(ext as never)
                ).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {form.allowedExtensions
                      .filter(
                        (ext) =>
                          !PRESET_EXTENSION_GROUPS.flatMap((g) => g.extensions).includes(
                            ext as never
                          )
                      )
                      .map((ext) => (
                        <span
                          key={ext}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono bg-secondary border border-border"
                        >
                          .{ext}
                          <button
                            type="button"
                            onClick={() => toggleExtension(ext)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 評分設定 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">評分設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>評分制度</Label>
            <Select
              value={form.gradingType}
              onValueChange={(v) => set('gradingType', v as GradingType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS_FAIL">通過 / 不通過</SelectItem>
                <SelectItem value="PERCENTAGE">百分制（0–100 分）</SelectItem>
                <SelectItem value="LETTER_GRADE">等第制（A / B / C / D / F）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.gradingType === 'PERCENTAGE' && (
            <div className="space-y-1.5">
              <Label htmlFor="passing-score">及格分數</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="passing-score"
                  type="number"
                  min="0"
                  max="100"
                  value={form.passingScore}
                  onChange={(e) => set('passingScore', e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">分（滿分 100 分）</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 截止與政策 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">截止時間與政策</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deadline">截止時間</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">留空 = 無截止時間</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">允許遲交</p>
              <p className="text-xs text-muted-foreground">開啟後，逾期仍可提交</p>
            </div>
            <Switch
              checked={form.allowLateSubmission}
              onCheckedChange={(v) => set('allowLateSubmission', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">允許重新提交</p>
              <p className="text-xs text-muted-foreground">學員收到退回後可重新繳交</p>
            </div>
            <Switch
              checked={form.allowResubmission}
              onCheckedChange={(v) => set('allowResubmission', v)}
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="cleanup-days">自動清理（天）</Label>
            <Input
              id="cleanup-days"
              type="number"
              min="1"
              max="365"
              value={form.autoCleanupDays}
              onChange={(e) => set('autoCleanupDays', e.target.value)}
              placeholder="留空 = 不自動清理"
              className="w-36"
            />
            <p className="text-xs text-muted-foreground">
              已通過的提交在 N 天後自動刪除附件以節省空間（選填）
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 儲存按鈕 */}
      <div className="flex justify-end gap-3 pb-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {assignmentId ? '儲存變更' : '建立作業'}
        </Button>
      </div>
    </div>
  )
}
