'use client'

// components/main/player/quiz/quiz-taking.tsx
// 測驗進行中的介面

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { submitQuizAttempt } from '@/lib/actions/quiz'

// ── 型別 ──────────────────────────────────────────────────────────────────

interface QuizOption {
  id: string
  text: string
}

interface QuizQuestion {
  id: string
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_BLANK'
  content: string
  options: QuizOption[] | null
  points: number
}

interface Quiz {
  id: string
  passingScore: number
  timeLimitMinutes: number | null
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showAnswers: 'IMMEDIATELY' | 'AFTER_PASS' | 'NEVER'
  questions: QuizQuestion[]
}

interface QuizTakingProps {
  quiz: Quiz
  onComplete: (result: {
    score: number
    passed: boolean
    correctAnswers: Record<
      string,
      { correct: unknown; explanation: string | null }
    > | null
    studentAnswers: Record<string, unknown>
  }) => void
  onCancel: () => void
}

// ── 工具函式 ─────────────────────────────────────────────────────────────

/** 使用 Fisher-Yates shuffle 加種子，確保 useMemo 每次 mount 都重洗 */
function shuffleArray<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── 元件 ─────────────────────────────────────────────────────────────────

export function QuizTaking({ quiz, onComplete, onCancel }: QuizTakingProps) {
  const [startedAt] = useState(() => new Date().toISOString())
  const [seed] = useState(() => Math.floor(Math.random() * 1e9))
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(
    quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : null
  )
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasAutoSubmitted = useRef(false)

  // 隨機排列題目（每次 mount 重新隨機）
  const orderedQuestions = useMemo(() => {
    return quiz.shuffleQuestions
      ? shuffleArray(quiz.questions, seed)
      : [...quiz.questions]
  }, [quiz.questions, quiz.shuffleQuestions, seed])

  // 隨機排列各題選項（每次 mount 重新隨機）
  const orderedOptions = useMemo(() => {
    const map: Record<string, QuizOption[]> = {}
    for (const q of orderedQuestions) {
      if (!q.options) continue
      map[q.id] = quiz.shuffleOptions
        ? shuffleArray(q.options, seed + q.id.charCodeAt(0))
        : [...q.options]
    }
    return map
  }, [orderedQuestions, quiz.shuffleOptions, seed])

  // 送出邏輯（useCallback 供倒計時自動送出使用）
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const result = await submitQuizAttempt({
        quizId: quiz.id,
        answers: answers as Record<string, string | string[] | boolean>,
        startedAt,
      })

      if (!result.success || !result.data) {
        toast.error(result.error ?? '送出失敗，請重試')
        setIsSubmitting(false)
        return
      }

      onComplete({
        score: result.data.score,
        passed: result.data.passed,
        correctAnswers: result.data.correctAnswers,
        studentAnswers: answers,
      })
    } catch {
      toast.error('送出失敗，請重試')
      setIsSubmitting(false)
    }
  }, [isSubmitting, quiz.id, answers, startedAt, onComplete])

  // 倒計時
  useEffect(() => {
    if (timeLeft === null) return

    if (timeLeft <= 0) {
      if (!hasAutoSubmitted.current) {
        hasAutoSubmitted.current = true
        toast.info('時間到！自動送出答案')
        handleSubmit()
      }
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, handleSubmit])

  // 計算答題進度
  const answeredCount = Object.keys(answers).length
  const totalCount = orderedQuestions.length
  const progressPercent = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0

  // 答案操作
  function setSingleAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function setMultipleAnswer(questionId: string, optionId: string, checked: boolean) {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) ?? []
      const next = checked
        ? [...current, optionId]
        : current.filter((id) => id !== optionId)
      return { ...prev, [questionId]: next }
    })
  }

  function setTrueFalseAnswer(questionId: string, value: boolean) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function setFillInAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const isTimeLow = timeLeft !== null && timeLeft <= 60

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* 頂部：進度 & 倒計時 */}
      <div className="sticky top-0 z-10 rounded-xl border border-divider bg-white/90 px-5 py-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-caption">
                已作答 {answeredCount} / {totalCount} 題
              </span>
              <span className="text-caption">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          {timeLeft !== null && (
            <div
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors ${
                isTimeLow
                  ? 'bg-red-50 text-red-600'
                  : 'bg-surface text-heading'
              }`}
            >
              <Clock className={`h-4 w-4 ${isTimeLow ? 'animate-pulse' : ''}`} />
              {formatTime(timeLeft)}
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-caption hover:text-heading"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="取消測驗"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 題目列表 */}
      <div className="space-y-5">
        {orderedQuestions.map((question, idx) => (
          <Card
            key={question.id}
            className={`border transition-colors ${
              answers[question.id] !== undefined
                ? 'border-primary/30 bg-primary/[0.02]'
                : 'border-divider bg-white'
            }`}
          >
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="flex items-start gap-3 text-base font-semibold leading-relaxed text-heading">
                <span className="mt-0.5 shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-sm font-bold text-caption">
                  {idx + 1}
                </span>
                <span>{question.content}</span>
              </CardTitle>
              <div className="ml-9 mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-caption">
                  {question.type === 'SINGLE_CHOICE' && '單選'}
                  {question.type === 'MULTIPLE_CHOICE' && '多選'}
                  {question.type === 'TRUE_FALSE' && '是非'}
                  {question.type === 'FILL_IN_BLANK' && '填空'}
                </Badge>
                <span className="text-xs text-caption">{question.points} 分</span>
              </div>
            </CardHeader>

            <Separator />

            <CardContent className="pt-4 pb-5">
              {/* 單選 */}
              {question.type === 'SINGLE_CHOICE' && (
                <RadioGroup
                  value={(answers[question.id] as string) ?? ''}
                  onValueChange={(v) => setSingleAnswer(question.id, v)}
                  className="space-y-2.5"
                >
                  {(orderedOptions[question.id] ?? question.options ?? []).map(
                    (opt) => (
                      <Label
                        key={opt.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                          answers[question.id] === opt.id
                            ? 'border-primary/40 bg-primary/5 text-heading'
                            : 'border-divider bg-surface/50 text-body hover:border-primary/20 hover:bg-surface'
                        }`}
                      >
                        <RadioGroupItem value={opt.id} className="mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{opt.text}</span>
                      </Label>
                    )
                  )}
                </RadioGroup>
              )}

              {/* 多選 */}
              {question.type === 'MULTIPLE_CHOICE' && (
                <div className="space-y-2.5">
                  <p className="mb-3 text-xs text-caption">（可選多個答案）</p>
                  {(orderedOptions[question.id] ?? question.options ?? []).map(
                    (opt) => {
                      const selected = (
                        (answers[question.id] as string[]) ?? []
                      ).includes(opt.id)
                      return (
                        <Label
                          key={opt.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                            selected
                              ? 'border-primary/40 bg-primary/5 text-heading'
                              : 'border-divider bg-surface/50 text-body hover:border-primary/20 hover:bg-surface'
                          }`}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) =>
                              setMultipleAnswer(question.id, opt.id, !!checked)
                            }
                            className="mt-0.5 shrink-0"
                          />
                          <span className="leading-relaxed">{opt.text}</span>
                        </Label>
                      )
                    }
                  )}
                </div>
              )}

              {/* 是非 */}
              {question.type === 'TRUE_FALSE' && (
                <div className="flex gap-3">
                  {[
                    { value: true, label: '正確' },
                    { value: false, label: '錯誤' },
                  ].map(({ value, label }) => {
                    const selected = answers[question.id] === value
                    return (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => setTrueFalseAnswer(question.id, value)}
                        className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-all ${
                          selected
                            ? value
                              ? 'border-green-400 bg-green-50 text-green-700'
                              : 'border-red-400 bg-red-50 text-red-700'
                            : 'border-divider bg-surface/50 text-body hover:border-primary/20 hover:bg-surface'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 填空 */}
              {question.type === 'FILL_IN_BLANK' && (
                <div className="space-y-2">
                  <Input
                    placeholder="請輸入你的答案…"
                    value={(answers[question.id] as string) ?? ''}
                    onChange={(e) => setFillInAnswer(question.id, e.target.value)}
                    className="border-divider bg-surface/50 text-sm focus:border-primary focus:ring-primary"
                  />
                  <p className="text-xs text-caption">
                    提示：答案不區分大小寫，前後空格會自動忽略
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 底部送出 */}
      <div className="flex items-center justify-between rounded-xl border border-divider bg-white px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-caption">
          {answeredCount < totalCount && (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span>
                尚有 {totalCount - answeredCount} 題未作答
              </span>
            </>
          )}
          {answeredCount === totalCount && (
            <span className="font-medium text-green-600">所有題目已作答</span>
          )}
        </div>
        <Button
          onClick={() => setShowConfirmDialog(true)}
          disabled={isSubmitting}
          className="min-w-[100px] bg-cta text-cta-foreground hover:bg-cta-hover"
        >
          {isSubmitting ? '送出中…' : '送出答案'}
        </Button>
      </div>

      {/* 確認送出 Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認送出答案？</DialogTitle>
            <DialogDescription className="pt-1">
              {answeredCount < totalCount ? (
                <span className="text-amber-600">
                  你還有 {totalCount - answeredCount} 題未作答，送出後無法修改。
                </span>
              ) : (
                '所有題目已完成，確認後將立即計分。送出後無法修改。'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSubmitting}
            >
              繼續作答
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false)
                handleSubmit()
              }}
              disabled={isSubmitting}
              className="bg-cta text-cta-foreground hover:bg-cta-hover"
            >
              {isSubmitting ? '送出中…' : '確認送出'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
