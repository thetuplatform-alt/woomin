'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Save, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizForAdmin,
} from '@/lib/actions/quiz'
import { QuizSettingsForm } from './quiz-settings-form'
import { QuestionList } from './question-list'
import { QuizResultsList } from './quiz-results-list'
import type {
  QuizSettingsFormData,
  QuizQuestionFormData,
} from '@/lib/validations/quiz'

// ─── 型別 ──────────────────────────────────────────────────────────────────

type QuestionWithId = QuizQuestionFormData & { id?: string }

interface QuizEditorProps {
  lessonId: string
  courseId: string
}

// 從 Prisma 回傳的 Quiz 資料（rawData）轉成 form data 需要的格式
function parseDbQuestion(q: {
  id: string
  type: string
  content: string
  options: unknown
  correctAnswer: unknown
  explanation: string | null
  points: number
  order: number
}): QuestionWithId {
  const type = q.type as QuizQuestionFormData['type']

  switch (type) {
    case 'SINGLE_CHOICE':
      return {
        id: q.id,
        type: 'SINGLE_CHOICE',
        content: q.content,
        options: (q.options as { id: string; text: string }[]) ?? [],
        correctAnswer: (q.correctAnswer as string) ?? '',
        explanation: q.explanation ?? '',
        points: q.points,
      }
    case 'MULTIPLE_CHOICE':
      return {
        id: q.id,
        type: 'MULTIPLE_CHOICE',
        content: q.content,
        options: (q.options as { id: string; text: string }[]) ?? [],
        correctAnswer: (q.correctAnswer as string[]) ?? [],
        explanation: q.explanation ?? '',
        points: q.points,
      }
    case 'TRUE_FALSE':
      return {
        id: q.id,
        type: 'TRUE_FALSE',
        options: [
          { id: 'true', text: '正確' },
          { id: 'false', text: '錯誤' },
        ],
        correctAnswer: q.correctAnswer as boolean,
        content: q.content,
        explanation: q.explanation ?? '',
        points: q.points,
      }
    case 'FILL_IN_BLANK':
      return {
        id: q.id,
        type: 'FILL_IN_BLANK',
        options: null,
        correctAnswer: (q.correctAnswer as string[]) ?? [''],
        content: q.content,
        explanation: q.explanation ?? '',
        points: q.points,
      }
    default:
      throw new Error(`Unknown question type: ${type}`)
  }
}

const DEFAULT_SETTINGS: QuizSettingsFormData = {
  passingScore: 60,
  timeLimitMinutes: null,
  shuffleQuestions: false,
  shuffleOptions: false,
  showAnswers: 'IMMEDIATELY',
  blockNextLesson: false,
}

// ─── 主元件 ────────────────────────────────────────────────────────────────

export function QuizEditor({ lessonId, courseId }: QuizEditorProps) {
  const [loading, setLoading] = useState(true)
  const [quizId, setQuizId] = useState<string | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)
  const [settings, setSettings] = useState<QuizSettingsFormData>(DEFAULT_SETTINGS)
  const [questions, setQuestions] = useState<QuestionWithId[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showResultsDialog, setShowResultsDialog] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 載入測驗
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await getQuizForAdmin(lessonId)
        if (cancelled) return
        if (result.success && result.data) {
          const quiz = result.data
          setQuizId(quiz.id)
          setAttemptCount(quiz._count?.attempts ?? 0)
          setSettings({
            passingScore: quiz.passingScore,
            timeLimitMinutes: quiz.timeLimitMinutes ?? null,
            shuffleQuestions: quiz.shuffleQuestions,
            shuffleOptions: quiz.shuffleOptions,
            showAnswers: quiz.showAnswers as QuizSettingsFormData['showAnswers'],
            blockNextLesson: quiz.blockNextLesson,
          })
          setQuestions(quiz.questions.map(parseDbQuestion))
        }
      } catch (err) {
        console.error('載入測驗失敗:', err)
        toast.error('載入測驗失敗，請重新整理頁面')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lessonId])

  // ─── 儲存 ─────────────────────────────────────────────────────────────

  function handleSave() {
    if (questions.length === 0) {
      toast.error('至少需要新增一道題目')
      return
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const label = `第 ${i + 1} 題`

      if (!q.content?.trim()) {
        toast.error(`${label}：題幹不能為空`)
        return
      }

      if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
        const opts = q.options ?? []
        if (opts.length < 2) {
          toast.error(`${label}：至少需要 2 個選項`)
          return
        }
        const emptyIndex = opts.findIndex((o) => !o.text?.trim())
        if (emptyIndex !== -1) {
          toast.error(`${label}：選項 ${emptyIndex + 1} 內容不能為空`)
          return
        }
        if (q.type === 'SINGLE_CHOICE') {
          if (!q.correctAnswer) {
            toast.error(`${label}：請點選圓圈標記正確答案`)
            return
          }
        } else {
          if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0) {
            toast.error(`${label}：至少需要勾選 1 個正確答案`)
            return
          }
        }
      }

      if (q.type === 'FILL_IN_BLANK') {
        const answers = Array.isArray(q.correctAnswer) ? q.correctAnswer : []
        if (answers.length === 0 || answers.every((a) => !a?.trim())) {
          toast.error(`${label}：請至少填寫 1 個可接受答案`)
          return
        }
      }
    }

    startTransition(async () => {
      try {
        if (quizId) {
          // 更新
          const result = await updateQuiz({
            quizId,
            settings,
            questions: questions as Parameters<typeof updateQuiz>[0]['questions'],
          })
          if (result.success) {
            toast.success('測驗已儲存')
          } else {
            toast.error(result.error ?? '儲存失敗')
          }
        } else {
          // 建立
          const result = await createQuiz({
            lessonId,
            settings,
            questions: questions as Parameters<typeof createQuiz>[0]['questions'],
          })
          if (result.success && result.data) {
            setQuizId(result.data.id)
            toast.success('測驗已建立')
          } else {
            toast.error(result.error ?? '建立失敗')
          }
        }
      } catch (err) {
        console.error('儲存測驗失敗:', err)
        toast.error('儲存時發生錯誤，請稍後再試')
      }
    })
  }

  // ─── 刪除 ─────────────────────────────────────────────────────────────

  function handleDelete() {
    if (!quizId) return
    startTransition(async () => {
      try {
        const result = await deleteQuiz(quizId)
        if (result.success) {
          setQuizId(null)
          setSettings(DEFAULT_SETTINGS)
          setQuestions([])
          setAttemptCount(0)
          setShowDeleteDialog(false)
          toast.success('測驗已刪除')
        } else {
          toast.error(result.error ?? '刪除失敗')
        }
      } catch (err) {
        console.error('刪除測驗失敗:', err)
        toast.error('刪除時發生錯誤，請稍後再試')
      }
    })
  }

  // ─── 計算總分 ──────────────────────────────────────────────────────────

  const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 1), 0)

  // ─── Loading 狀態 ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">載入測驗中...</span>
      </div>
    )
  }

  // ─── 無測驗：顯示新增按鈕 ──────────────────────────────────────────────

  if (!quizId && questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 border rounded-lg border-dashed">
        <div className="rounded-full bg-muted p-3">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">此單元尚未設定測驗</p>
          <p className="text-xs text-muted-foreground mt-1">
            新增測驗可幫助學員鞏固所學，並可選擇是否阻擋後續單元
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            // 進入編輯模式（加入第一題）
            setQuestions([
              {
                type: 'SINGLE_CHOICE',
                content: '',
                explanation: '',
                points: 1,
                options: [
                  { id: crypto.randomUUID(), text: '' },
                  { id: crypto.randomUUID(), text: '' },
                ],
                correctAnswer: '',
              },
            ])
          }}
        >
          <Plus className="h-4 w-4" />
          新增測驗
        </Button>
      </div>
    )
  }

  // ─── 有測驗（或建立中）：顯示完整編輯介面 ─────────────────────────────

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">測驗編輯器</CardTitle>
              {quizId && (
                <Badge variant="outline" className="text-xs">
                  {questions.length} 題 / 共 {totalPoints} 分
                </Badge>
              )}
              {!quizId && (
                <Badge variant="secondary" className="text-xs">
                  草稿（尚未儲存）
                </Badge>
              )}
              {quizId && attemptCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowResultsDialog(true)}
                  className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-200"
                >
                  {attemptCount} 次作答紀錄・查看結果
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {quizId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-destructive hover:text-destructive text-xs"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  刪除測驗
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {quizId ? '儲存變更' : '建立測驗'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-4">
          <Tabs defaultValue="questions">
            <TabsList className="h-8 mb-4">
              <TabsTrigger value="questions" className="text-xs h-7">
                題目（{questions.length}）
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs h-7">
                測驗設定
              </TabsTrigger>
            </TabsList>

            <TabsContent value="questions" className="mt-0">
              <QuestionList questions={questions} onChange={setQuestions} />
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <QuizSettingsForm settings={settings} onChange={setSettings} />
            </TabsContent>
          </Tabs>
        </CardContent>

        <Separator />

        {/* 底部固定的儲存列，確保使用者一定找得到儲存按鈕 */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-lg border-t bg-background/95 px-4 py-3 backdrop-blur">
          <p className="text-xs text-muted-foreground">
            {quizId
              ? '修改後記得按「儲存變更」才會生效'
              : '填好題目與選項後，按右側「建立測驗」儲存'}
          </p>
          <Button
            type="button"
            size="default"
            className="gap-2"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {quizId ? '儲存變更' : '建立測驗'}
          </Button>
        </div>
      </Card>

      {/* 作答結果 Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">測驗作答結果</DialogTitle>
          </DialogHeader>
          {quizId && showResultsDialog && <QuizResultsList quizId={quizId} />}
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認刪除測驗？</DialogTitle>
            <DialogDescription>
              {attemptCount > 0
                ? `此測驗已有 ${attemptCount} 筆學員作答紀錄，刪除後所有紀錄將一併清除，此操作無法還原。`
                : '刪除後將無法還原，確定要刪除此測驗嗎？'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="gap-1"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
