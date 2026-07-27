'use client'

// components/main/player/quiz/quiz-result.tsx
// 測驗結果頁面

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, XCircle, RotateCcw, ChevronLeft, AlertCircle, Minus } from 'lucide-react'

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

interface QuizResultProps {
  score: number
  passed: boolean
  passingScore: number
  correctAnswers: Record<
    string,
    { correct: unknown; explanation: string | null }
  > | null
  questions: QuizQuestion[]
  studentAnswers: Record<string, unknown>
  onRetry: () => void
  onClose: () => void
}

// ── 工具函式 ─────────────────────────────────────────────────────────────

function isAnswerCorrect(
  type: QuizQuestion['type'],
  studentAnswer: unknown,
  correctAnswer: unknown
): boolean {
  if (studentAnswer === undefined || studentAnswer === null) return false

  switch (type) {
    case 'SINGLE_CHOICE':
      return studentAnswer === correctAnswer
    case 'TRUE_FALSE':
      return studentAnswer === correctAnswer
    case 'MULTIPLE_CHOICE': {
      const correctArr = correctAnswer as string[]
      const studentArr = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer]
      return (
        correctArr.length === studentArr.length &&
        correctArr.every((c) => studentArr.includes(c))
      )
    }
    case 'FILL_IN_BLANK': {
      const acceptedAnswers = correctAnswer as string[]
      const s = typeof studentAnswer === 'string' ? studentAnswer.trim().toLowerCase() : ''
      return acceptedAnswers.some((a) => a.trim().toLowerCase() === s)
    }
    default:
      return false
  }
}

function formatStudentAnswer(
  type: QuizQuestion['type'],
  answer: unknown,
  options: QuizOption[] | null
): string {
  if (answer === undefined || answer === null || answer === '') return '（未作答）'

  if (type === 'TRUE_FALSE') return answer ? '正確' : '錯誤'

  if (type === 'FILL_IN_BLANK') return String(answer)

  const optionMap = new Map(options?.map((o) => [o.id, o.text]) ?? [])

  if (type === 'SINGLE_CHOICE') {
    return optionMap.get(answer as string) ?? String(answer)
  }

  if (type === 'MULTIPLE_CHOICE') {
    const arr = Array.isArray(answer) ? answer : [answer]
    return arr.map((id) => optionMap.get(id as string) ?? String(id)).join('、')
  }

  return String(answer)
}

function formatCorrectAnswer(
  type: QuizQuestion['type'],
  correct: unknown,
  options: QuizOption[] | null
): string {
  if (type === 'TRUE_FALSE') return correct ? '正確' : '錯誤'

  if (type === 'FILL_IN_BLANK') {
    const arr = correct as string[]
    return arr.join(' 或 ')
  }

  const optionMap = new Map(options?.map((o) => [o.id, o.text]) ?? [])

  if (type === 'SINGLE_CHOICE') {
    return optionMap.get(correct as string) ?? String(correct)
  }

  if (type === 'MULTIPLE_CHOICE') {
    const arr = correct as string[]
    return arr.map((id) => optionMap.get(id) ?? id).join('、')
  }

  return String(correct)
}

// ── 元件 ─────────────────────────────────────────────────────────────────

export function QuizResult({
  score,
  passed,
  passingScore,
  correctAnswers,
  questions,
  studentAnswers,
  onRetry,
  onClose,
}: QuizResultProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* 成績總覽卡片 */}
      <Card
        className={`border-2 text-center ${
          passed
            ? 'border-green-300 bg-green-50'
            : 'border-orange-200 bg-orange-50'
        }`}
      >
        <CardContent className="py-10">
          <div
            className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${
              passed ? 'bg-green-100' : 'bg-orange-100'
            }`}
          >
            {passed ? (
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            ) : (
              <XCircle className="h-10 w-10 text-orange-500" />
            )}
          </div>

          <p
            className={`mb-1 text-5xl font-extrabold tabular-nums ${
              passed ? 'text-green-700' : 'text-orange-600'
            }`}
          >
            {score}
            <span className="ml-1 text-2xl font-semibold">分</span>
          </p>

          <p
            className={`mt-3 text-xl font-bold ${
              passed ? 'text-green-700' : 'text-orange-600'
            }`}
          >
            {passed ? '恭喜通過！' : '尚未通過'}
          </p>

          <p className="mt-2 text-sm text-body">
            及格分數：
            <span className="font-semibold text-heading">{passingScore} 分</span>
          </p>
        </CardContent>
      </Card>

      {/* 詳解區：有 correctAnswers 才顯示 */}
      {correctAnswers && questions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-heading">詳細解析</h3>

          {questions.map((question, idx) => {
            const studentAnswer = studentAnswers[question.id]
            const ca = correctAnswers[question.id]
            const answered = studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== ''
            const correct = ca ? isAnswerCorrect(question.type, studentAnswer, ca.correct) : null

            return (
              <Card
                key={question.id}
                className={`border ${
                  !answered
                    ? 'border-divider'
                    : correct
                    ? 'border-green-200 bg-green-50/40'
                    : 'border-red-200 bg-red-50/30'
                }`}
              >
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-heading">
                    <span className="mt-0.5 shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-caption">
                      {idx + 1}
                    </span>
                    <span className="flex-1">{question.content}</span>
                    {!answered ? (
                      <Minus className="mt-0.5 h-5 w-5 shrink-0 text-caption" />
                    ) : correct ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    )}
                  </CardTitle>

                  <div className="ml-9 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-caption">
                      {question.type === 'SINGLE_CHOICE' && '單選'}
                      {question.type === 'MULTIPLE_CHOICE' && '多選'}
                      {question.type === 'TRUE_FALSE' && '是非'}
                      {question.type === 'FILL_IN_BLANK' && '填空'}
                    </Badge>
                    <span className="text-xs text-caption">{question.points} 分</span>
                    {!answered && (
                      <Badge variant="outline" className="text-xs text-caption">
                        未作答
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                {ca && (
                  <>
                    <Separator />
                    <CardContent className="space-y-2 py-4">
                      {/* 你的答案 */}
                      <div className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 shrink-0 font-medium text-caption">
                          你的答案：
                        </span>
                        <span
                          className={`font-medium leading-relaxed ${
                            !answered
                              ? 'text-caption'
                              : correct
                              ? 'text-green-700'
                              : 'text-red-600 line-through'
                          }`}
                        >
                          {formatStudentAnswer(question.type, studentAnswer, question.options)}
                        </span>
                      </div>

                      {/* 正確答案（答錯或未作答時顯示）*/}
                      {(!answered || !correct) && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 shrink-0 font-medium text-caption">
                            正確答案：
                          </span>
                          <span className="font-semibold leading-relaxed text-green-700">
                            {formatCorrectAnswer(question.type, ca.correct, question.options)}
                          </span>
                        </div>
                      )}

                      {/* 解析 */}
                      {ca.explanation && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                          <p className="leading-relaxed text-blue-800">{ca.explanation}</p>
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* 無詳解提示（NEVER 策略）*/}
      {!correctAnswers && (
        <Card className="border-divider">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-caption">本次測驗不公開詳細解答。</p>
          </CardContent>
        </Card>
      )}

      {/* 底部按鈕 */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 border-divider text-body hover:bg-surface hover:text-heading"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          返回
        </Button>
        <Button
          onClick={onRetry}
          className="flex-1 bg-cta text-cta-foreground hover:bg-cta-hover"
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          重新測驗
        </Button>
      </div>
    </div>
  )
}
