'use client'

// components/main/player/quiz/quiz-section.tsx
// 測驗入口區塊 — 顯示在單元內容下方

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  RotateCcw,
  ListOrdered,
  Target,
} from 'lucide-react'
import { getQuizForStudent } from '@/lib/actions/quiz'
import { QuizTaking } from './quiz-taking'
import { QuizResult } from './quiz-result'

// ── 型別 ──────────────────────────────────────────────────────────────────

type QuizData = NonNullable<
  Awaited<ReturnType<typeof getQuizForStudent>>['data']
>

type QuizResult = {
  score: number
  passed: boolean
  correctAnswers: Record<
    string,
    { correct: unknown; explanation: string | null }
  > | null
  studentAnswers: Record<string, unknown>
}

type ViewState = 'info' | 'taking' | 'result'

interface QuizSectionProps {
  lessonId: string
}

// ── 元件 ─────────────────────────────────────────────────────────────────

export function QuizSection({ lessonId }: QuizSectionProps) {
  const [quizData, setQuizData] = useState<QuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewState>('info')
  const [lastResult, setLastResult] = useState<QuizResult | null>(null)

  const fetchQuiz = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getQuizForStudent(lessonId)
      if (result.success && result.data) {
        setQuizData(result.data)
      }
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    fetchQuiz()
  }, [fetchQuiz])

  // 完全沒有測驗，或還在載入，就不渲染
  if (loading || !quizData?.quiz) return null

  const { quiz, attempts, bestScore, hasPassed, attemptCount } = quizData

  function handleComplete(result: QuizResult) {
    setLastResult(result)
    setView('result')
    // 重新拉一次資料（更新歷史次數 & bestScore）
    fetchQuiz()
  }

  function handleRetry() {
    setView('taking')
    setLastResult(null)
  }

  function handleClose() {
    setView('info')
  }

  // 將 Prisma JsonValue 轉換為前台元件需要的型別
  const quizForTaking = {
    ...quiz,
    showAnswers: quiz.showAnswers as 'IMMEDIATELY' | 'AFTER_PASS' | 'NEVER',
    questions: quiz.questions.map((q) => ({
      ...q,
      type: q.type as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_BLANK',
      options: q.options as Array<{ id: string; text: string }> | null,
    })),
  }

  // ── 測驗進行中 ───────────────────────────────────────────────────
  if (view === 'taking') {
    return (
      <QuizTaking
        quiz={quizForTaking}
        onComplete={handleComplete}
        onCancel={handleClose}
      />
    )
  }

  // ── 測驗結果 ────────────────────────────────────────────────────
  if (view === 'result' && lastResult) {
    return (
      <QuizResult
        score={lastResult.score}
        passed={lastResult.passed}
        passingScore={quiz.passingScore}
        correctAnswers={lastResult.correctAnswers}
        questions={quizForTaking.questions}
        studentAnswers={lastResult.studentAnswers}
        onRetry={handleRetry}
        onClose={handleClose}
      />
    )
  }

  // ── 測驗資訊卡片 ─────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card className="border-2 border-divider shadow-sm">
        <CardHeader className="pb-3 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg font-bold text-heading">
                單元測驗
              </CardTitle>
            </div>

            {/* 通過狀態 badge */}
            {hasPassed && (
              <Badge className="shrink-0 gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已通過
              </Badge>
            )}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="py-5">
          {/* 測驗基本資訊 */}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
            <InfoItem
              icon={<Target className="h-4 w-4 text-primary" />}
              label="及格分數"
              value={`${quiz.passingScore} 分`}
            />
            <InfoItem
              icon={<Clock className="h-4 w-4 text-primary" />}
              label="作答時限"
              value={
                quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} 分鐘` : '無限制'
              }
            />
            <InfoItem
              icon={<ListOrdered className="h-4 w-4 text-primary" />}
              label="題目數量"
              value={`${quiz.questions.length} 題`}
            />
          </div>

          {/* 歷史紀錄 */}
          {attemptCount > 0 && (
            <>
              <Separator className="my-4" />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-caption">歷史最高分</span>
                  <span
                    className={`font-bold tabular-nums ${
                      hasPassed ? 'text-green-600' : 'text-orange-500'
                    }`}
                  >
                    {bestScore} 分
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption">已作答</span>
                  <span className="font-semibold text-heading">
                    {attemptCount} 次
                  </span>
                </div>
                {attempts[0] && (
                  <div className="flex items-center gap-2">
                    <span className="text-caption">最近作答</span>
                    <span className="text-body">
                      {new Date(attempts[0].submittedAt).toLocaleDateString(
                        'zh-TW',
                        { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 開始按鈕 */}
          <div className="mt-5">
            <Button
              onClick={() => setView('taking')}
              className="w-full bg-cta py-5 text-sm font-bold text-cta-foreground hover:bg-cta-hover"
            >
              {attemptCount === 0 ? (
                <>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  開始測驗
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重新測驗
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 子元件：資訊格子 ──────────────────────────────────────────────────────

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-surface px-3 py-3 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
        {icon}
      </div>
      <p className="text-xs text-caption">{label}</p>
      <p className="text-sm font-bold text-heading">{value}</p>
    </div>
  )
}
