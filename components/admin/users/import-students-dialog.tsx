// components/admin/users/import-students-dialog.tsx
// 批次匯入學員對話框
// 支援上傳 CSV 檔案、選擇課程、預覽資料、確認匯入
// 相容 Teachify 匯出的 CSV 格式

'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { getManageableCourseOptions, importStudents } from '@/lib/actions/users'
import type { ImportStudentRow } from '@/lib/validations/user'
import type { ImportStudentsResult } from '@/lib/actions/users'
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
import { Switch } from '@/components/ui/switch'
import { CourseMultiSelect } from '@/components/admin/users/course-multi-select'
import { Label } from '@/components/ui/label'
import {
  Upload,
  Loader2,
  FileUp,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  BookOpen,
  UserPlus,
  UserCheck,
  AlertTriangle,
} from 'lucide-react'

// Teachify CSV 欄位名稱對照表
const FIELD_MAPPING: Record<string, keyof ImportStudentRow> = {
  // 中文欄位
  '姓名': 'name',
  '名稱': 'name',
  '學員姓名': 'name',
  'Email': 'email',
  'email': 'email',
  'Email address': 'email',
  '電子郵件': 'email',
  '電子信箱': 'email',
  '信箱': 'email',
  '電話': 'phone',
  '聯絡電話': 'phone',
  'Contact number': 'phone',
  '手機': 'phone',
  // 英文欄位
  'Name': 'name',
  'name': 'name',
  'Phone': 'phone',
  'phone': 'phone',
}

// CSV 範本內容
const CSV_TEMPLATE = `姓名,Email,電話
王小明,student@example.com,0912-345-678
陳小華,student2@example.com,0923-456-789`

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // 移除 BOM
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter((line) => line.trim())

  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)

  return { headers, rows }
}

function mapToStudents(
  headers: string[],
  rows: string[][]
): { students: ImportStudentRow[]; errors: { row: number; error: string }[] } {
  // 建立欄位索引
  const fieldIndexes: Partial<Record<keyof ImportStudentRow, number>> = {}

  headers.forEach((header, index) => {
    const mapped = FIELD_MAPPING[header.trim()]
    if (mapped && fieldIndexes[mapped] === undefined) {
      fieldIndexes[mapped] = index
    }
  })

  if (fieldIndexes.email === undefined) {
    return { students: [], errors: [{ row: 0, error: 'CSV 中找不到 Email 欄位' }] }
  }

  if (fieldIndexes.name === undefined) {
    return { students: [], errors: [{ row: 0, error: 'CSV 中找不到姓名欄位' }] }
  }

  const students: ImportStudentRow[] = []
  const errors: { row: number; error: string }[] = []

  rows.forEach((row, index) => {
    const email = row[fieldIndexes.email!]?.trim()
    const name = row[fieldIndexes.name!]?.trim()
    const phone = fieldIndexes.phone !== undefined ? row[fieldIndexes.phone]?.trim() : undefined

    if (!email) {
      errors.push({ row: index + 2, error: 'Email 為空' })
      return
    }

    if (!name) {
      errors.push({ row: index + 2, error: '姓名為空' })
      return
    }

    // 基本 email 格式驗證
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: index + 2, error: `Email 格式不正確: ${email}` })
      return
    }

    students.push({
      name,
      email,
      phone: phone || undefined,
    })
  })

  return { students, errors }
}

type Step = 'upload' | 'preview' | 'result'

export function ImportStudentsDialog() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 課程相關
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [courseIds, setCourseIds] = useState<string[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)
  const [sendInvite, setSendInvite] = useState(false)

  // CSV 相關
  const [fileName, setFileName] = useState<string>('')
  const [parsedStudents, setParsedStudents] = useState<ImportStudentRow[]>([])
  const [parseErrors, setParseErrors] = useState<{ row: number; error: string }[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  // 匯入結果
  const [importResult, setImportResult] = useState<ImportStudentsResult | null>(null)

  // 載入課程列表
  useEffect(() => {
    if (isOpen) {
      setIsLoadingCourses(true)
      getManageableCourseOptions()
        .then(setCourses)
        .catch(() => toast.error('載入課程列表失敗'))
        .finally(() => setIsLoadingCourses(false))
    }
  }, [isOpen])

  // 重置狀態
  function resetState() {
    setStep('upload')
    setCourseIds([])
    setSendInvite(false)
    setFileName('')
    setParsedStudents([])
    setParseErrors([])
    setImportResult(null)
    setIsDragOver(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) resetState()
  }

  // 處理檔案
  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('請上傳 CSV 格式的檔案')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('檔案大小不能超過 10MB')
      return
    }

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)

      if (headers.length === 0 || rows.length === 0) {
        toast.error('CSV 檔案沒有有效資料')
        return
      }

      const { students, errors } = mapToStudents(headers, rows)
      setParsedStudents(students)
      setParseErrors(errors)

      if (students.length > 0) {
        setStep('preview')
      } else {
        toast.error('CSV 中沒有可匯入的有效資料')
      }
    }
    reader.readAsText(file, 'utf-8')
  }, [])

  // 拖放處理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  // 下載範本
  function handleDownloadTemplate() {
    const bom = '\uFEFF'
    const blob = new Blob([bom + CSV_TEMPLATE], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '學員匯入範本.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 執行匯入
  function handleImport() {
    if (courseIds.length === 0) {
      toast.error('請至少選擇一門課程')
      return
    }

    if (parsedStudents.length === 0) {
      toast.error('沒有可匯入的學員資料')
      return
    }

    startTransition(async () => {
      try {
        const result = await importStudents({
          students: parsedStudents,
          courseIds,
          sendInvite,
        })

        setImportResult(result)
        setStep('result')

        if (result.success) {
          router.refresh()
        }
      } catch {
        toast.error('匯入時發生錯誤')
      }
    })
  }

  const selectedCourses = courses.filter((c) => courseIds.includes(c.id))

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          data-tour="users-import-btn"
          variant="outline"
          className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
        >
          <Download className="mr-2 h-4 w-4" />
          匯入學員
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white border-divider rounded-xl sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-heading">批次匯入學員</DialogTitle>
          <DialogDescription className="text-body">
            上傳 CSV 檔案批次匯入學員資料，支援 Teachify 匯出格式
          </DialogDescription>
        </DialogHeader>

        {/* 步驟 1：上傳 */}
        {step === 'upload' && (
          <div className="space-y-5 py-2">
            {/* 課程選擇（可多選） */}
            <div className="space-y-2">
              <Label className="text-heading font-medium flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                選擇課程 <span className="text-red-500">*</span>
              </Label>
              <CourseMultiSelect
                courses={courses}
                value={courseIds}
                onChange={setCourseIds}
                loading={isLoadingCourses}
                placeholder="選擇要匯入的課程（可多選）"
              />
              {courseIds.length > 0 && (
                <p className="text-xs text-cta flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  已選擇 {courseIds.length} 門課程
                </p>
              )}
            </div>

            {/* 寄送設定密碼邀請信 */}
            <div className="flex flex-row items-center justify-between rounded-lg border border-divider p-3">
              <div className="space-y-0.5 pr-3">
                <Label className="text-heading">寄送設定密碼邀請信</Label>
                <p className="text-xs text-caption">
                  僅對本次新建的帳號寄送，含 30 天有效的設定密碼連結
                </p>
              </div>
              <Switch checked={sendInvite} onCheckedChange={setSendInvite} />
            </div>

            {/* CSV 上傳區 */}
            <div className="space-y-2">
              <Label className="text-heading font-medium flex items-center gap-1.5">
                <FileUp className="h-4 w-4" />
                選擇 CSV 檔案 <span className="text-red-500">*</span>
              </Label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragOver
                    ? 'border-cta bg-cta/5'
                    : 'border-divider hover:border-cta/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-8 w-8 text-caption mb-3" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-divider text-body rounded-lg mb-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  選擇檔案
                </Button>
                <p className="text-xs text-caption mt-2">
                  或拖曳檔案到此處
                </p>
                <p className="text-xs text-caption mt-1">
                  僅支援 CSV 格式，檔案大小限制 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                  }}
                />
              </div>
            </div>

            {/* 匯入說明 */}
            <div className="bg-surface/50 border border-divider rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-heading flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-cta" />
                匯入說明
              </p>
              <div className="space-y-2 text-xs text-body">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-heading min-w-[60px]">必填欄位</span>
                  <span>姓名（Name）、Email（Email address）</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-heading min-w-[60px]">選填欄位</span>
                  <span>電話（Contact number）</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-heading min-w-[60px]">重複處理</span>
                  <span>相同 Email 的學員不會重複建立帳號，已擁有課程的不會重複授權</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-heading min-w-[60px]">數量限制</span>
                  <span>每次最多匯入 1,000 筆資料</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="border-divider text-body hover:bg-white rounded-lg"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                下載 CSV 範本
              </Button>
            </div>
          </div>
        )}

        {/* 步驟 2：預覽 */}
        {step === 'preview' && (
          <div className="space-y-4 py-2">
            {/* 檔案資訊 */}
            <div className="flex items-center justify-between bg-surface/50 border border-divider rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileUp className="h-4 w-4 text-cta" />
                <span className="text-sm text-heading font-medium">{fileName}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('upload')
                  setFileName('')
                  setParsedStudents([])
                  setParseErrors([])
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="text-caption hover:text-heading h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* 課程資訊 */}
            {selectedCourses.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-body">
                <BookOpen className="h-4 w-4 text-cta mt-0.5 shrink-0" />
                <span className="shrink-0">課程：</span>
                <span className="font-medium text-heading">
                  {selectedCourses.map((c) => c.title).join('、')}
                </span>
              </div>
            )}

            {/* 統計 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{parsedStudents.length}</p>
                <p className="text-xs text-green-600">有效資料</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{parseErrors.length}</p>
                <p className="text-xs text-amber-600">解析問題</p>
              </div>
            </div>

            {/* 解析錯誤 */}
            {parseErrors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  以下資料行無法解析（將跳過）
                </p>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {parseErrors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      第 {err.row} 行：{err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 預覽表格 */}
            <div className="border border-divider rounded-lg overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-caption font-medium text-xs">#</th>
                      <th className="text-left px-3 py-2 text-caption font-medium text-xs">姓名</th>
                      <th className="text-left px-3 py-2 text-caption font-medium text-xs">Email</th>
                      <th className="text-left px-3 py-2 text-caption font-medium text-xs">電話</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {parsedStudents.slice(0, 50).map((student, i) => (
                      <tr key={i} className="hover:bg-surface/30">
                        <td className="px-3 py-1.5 text-caption text-xs">{i + 1}</td>
                        <td className="px-3 py-1.5 text-heading text-xs">{student.name}</td>
                        <td className="px-3 py-1.5 text-body text-xs">{student.email}</td>
                        <td className="px-3 py-1.5 text-body text-xs">{student.phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedStudents.length > 50 && (
                <div className="px-3 py-2 bg-surface text-xs text-caption text-center border-t border-divider">
                  僅顯示前 50 筆，共 {parsedStudents.length} 筆
                </div>
              )}
            </div>
          </div>
        )}

        {/* 步驟 3：匯入結果 */}
        {step === 'result' && importResult && (
          <div className="space-y-4 py-2">
            {importResult.success ? (
              <>
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">匯入完成</p>
                    <p className="text-sm text-green-600">
                      已成功處理 {importResult.summary!.totalRows} 筆資料
                    </p>
                  </div>
                </div>

                {/* 結果統計 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 bg-surface/50 border border-divider rounded-lg p-3">
                    <UserPlus className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-lg font-bold text-heading">{importResult.summary!.newUsers}</p>
                      <p className="text-xs text-caption">新建帳號</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-surface/50 border border-divider rounded-lg p-3">
                    <UserCheck className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-lg font-bold text-heading">{importResult.summary!.existingUsers}</p>
                      <p className="text-xs text-caption">既有帳號</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-surface/50 border border-divider rounded-lg p-3">
                    <BookOpen className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-lg font-bold text-heading">{importResult.summary!.newGrants}</p>
                      <p className="text-xs text-caption">新授權</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-surface/50 border border-divider rounded-lg p-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-lg font-bold text-heading">{importResult.summary!.alreadyGranted}</p>
                      <p className="text-xs text-caption">已有權限（跳過）</p>
                    </div>
                  </div>
                </div>

                {/* 錯誤明細 */}
                {importResult.summary!.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-800 mb-1 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {importResult.summary!.errors.length} 筆資料匯入失敗
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-0.5">
                      {importResult.summary!.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-700">
                          第 {err.row} 行 ({err.email})：{err.error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
                <div>
                  <p className="font-medium text-red-800">匯入失敗</p>
                  <p className="text-sm text-red-600">{importResult.error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('upload')}
                className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
              >
                返回
              </Button>
              <Button
                onClick={handleImport}
                disabled={isPending || parsedStudents.length === 0 || courseIds.length === 0}
                className="bg-cta hover:bg-cta-hover text-white rounded-lg"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    匯入中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    確認匯入 {parsedStudents.length} 筆
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button
              onClick={() => {
                if (importResult?.success) {
                  setIsOpen(false)
                } else {
                  setStep('upload')
                  setImportResult(null)
                }
              }}
              className={
                importResult?.success
                  ? 'bg-cta hover:bg-cta-hover text-white rounded-lg'
                  : 'border-divider text-body hover:bg-surface hover:text-heading rounded-lg'
              }
              variant={importResult?.success ? 'default' : 'outline'}
            >
              {importResult?.success ? '完成' : '重試'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
