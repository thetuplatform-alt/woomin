// components/admin/quiz/quiz-results-list.tsx
// 後台測驗作答結果：全班成績、統計、逐題對照、CSV 匯出

'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Loader2,
  FileQuestion,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Minus,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getQuizResultsForAdmin } from '@/lib/actions/quiz'

// ── 型別 ──────────────────────────────────────────────────────────────────

type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_IN_BLANK'

interface QuizOption {
  id: string
  text: string
}

interface AdminQuizQuestion {
  id: string
  type: QuestionType
  content: string
  options: QuizOption[] | null
  correctAnswer: unknown
  explanation: string | null
  points: number
  order: number
}

interface AdminQuizAttempt {
  id: string
  score: number
  passed: boolean
  timeTakenSeconds: number | null
  submittedAt: string
  answers: Record<string, unknown>
  user: { id: string; name: string | null; email: string; image: string | null }
}

interface QuizResultsData {
  quiz: {
    id: string
    passingScore: number
    showAnswers: string
    lessonTitle: string
    questions: AdminQuizQuestion[]
  }
  attempts: AdminQuizAttempt[]
  stats: {
    totalAttempts: number
    uniqueStudents: number
    passedCount: number
    passRate: number
    averageScore: number
    distribution: { label: string; count: number }[]
  }
}

interface QuizResultsListProps {
  quizId: string
}

type ResultFilter = 'ALL' | 'PASSED' | 'FAILED'

const RESULT_TABS: { value: ResultFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PASSED', label: '已通過' },
  { value: 'FAILED', label: '未通過' },
]

// ── 答案格式化 ──────────────────────────────────────────────────────────────

function isAnswerCorrect(
  type: QuestionType,
  studentAnswer: unknown,
  correctAnswer: unknown
): boolean {
  if (studentAnswer === undefined || studentAnswer === null) return false
  switch (type) {
    case 'SINGLE_CHOICE':
    case 'TRUE_FALSE':
      return studentAnswer === correctAnswer
    case 'MULTIPLE_CHOICE': {
      const correctArr = (correctAnswer as string[]) ?? []
      const studentArr = Array.isArray(studentAnswer)
        ? studentAnswer
        : [studentAnswer]
      return (
        correctArr.length === studentArr.length &&
        correctArr.every((c) => studentArr.includes(c))
      )
    }
    case 'FILL_IN_BLANK': {
      const accepted = (correctAnswer as string[]) ?? []
      const s =
        typeof studentAnswer === 'string'
          ? studentAnswer.trim().toLowerCase()
          : ''
      return accepted.some((a) => a.trim().toLowerCase() === s)
    }
    default:
      return false
  }
}

function formatStudentAnswer(
  type: QuestionType,
  answer: unknown,
  options: QuizOption[] | null
): string {
  if (answer === undefined || answer === null || answer === '')
    return '（未作答）'
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
  type: QuestionType,
  correct: unknown,
  options: QuizOption[] | null
): string {
  if (type === 'TRUE_FALSE') return correct ? '正確' : '錯誤'
  if (type === 'FILL_IN_BLANK') {
    const arr = (correct as string[]) ?? []
    return arr.join(' 或 ')
  }
  const optionMap = new Map(options?.map((o) => [o.id, o.text]) ?? [])
  if (type === 'SINGLE_CHOICE') {
    return optionMap.get(correct as string) ?? String(correct)
  }
  if (type === 'MULTIPLE_CHOICE') {
    const arr = (correct as string[]) ?? []
    return arr.map((id) => optionMap.get(id) ?? id).join('、')
  }
  return String(correct)
}

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: '單選',
  MULTIPLE_CHOICE: '多選',
  TRUE_FALSE: '是非',
  FILL_IN_BLANK: '填空',
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number | string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-center ${
        highlight ? 'border-emerald-300 bg-emerald-50' : ''
      }`}
    >
      <p
        className={`text-xl font-bold ${
          highlight ? 'text-emerald-700' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// ── CSV 匯出 ────────────────────────────────────────────────────────────────

function exportCsv(data: QuizResultsData) {
  const header = ['學員姓名', 'Email', '得分', '結果', '作答時間', '花費秒數']
  const rows = data.attempts.map((a) => [
    a.user.name ?? '未命名',
    a.user.email,
    String(a.score),
    a.passed ? '通過' : '未通過',
    format(new Date(a.submittedAt), 'yyyy/MM/dd HH:mm'),
    a.timeTakenSeconds != null ? String(a.timeTakenSeconds) : '',
  ])

  const escapeCell = (cell: string) => {
    const needsQuote = /[",\n]/.test(cell)
    const escaped = cell.replace(/"/g, '""')
    return needsQuote ? `"${escaped}"` : escaped
  }

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\r\n')

  // 加上 BOM 確保 Excel 正確辨識 UTF-8
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const safeTitle = data.quiz.lessonTitle.replace(/[\\/:*?"<>|]/g, '_')
  link.download = `測驗成績_${safeTitle}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── 主元件 ──────────────────────────────────────────────────────────────────

export function QuizResultsList({ quizId }: QuizResultsListProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<QuizResultsData | null>(null)
  const [filter, setFilter] = useState<ResultFilter>('ALL')
  const [detailAttempt, setDetailAttempt] = useState<AdminQuizAttempt | null>(
    null
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getQuizResultsForAdmin(quizId)
      if (result.success) {
        setData(result.data as QuizResultsData)
      } else {
        setError(result.error ?? '載入測驗結果失敗')
      }
    } catch {
      setError('載入測驗結果失敗')
    } finally {
      setLoading(false)
    }
  }, [quizId])

  useEffect(() => {
    load()
  }, [load])

  const filteredAttempts = (data?.attempts ?? []).filter((a) => {
    if (filter === 'PASSED') return a.passed
    if (filter === 'FAILED') return !a.passed
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>
          重試
        </Button>
      </div>
    )
  }

  if (!data) return null

  const { quiz, stats } = data
  const maxBucket = Math.max(1, ...stats.distribution.map((b) => b.count))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileQuestion className="h-5 w-5 text-purple-500" />
            測驗作答結果
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {quiz.lessonTitle}・及格分數 {quiz.passingScore} 分
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            <span className="ml-1 text-xs">重新整理</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(data)}
            disabled={stats.totalAttempts === 0}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="ml-1 text-xs">匯出 CSV</span>
          </Button>
        </div>
      </div>

      {/* 統計摘要 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="作答人次" value={stats.totalAttempts} />
        <StatCard label="作答人數" value={stats.uniqueStudents} />
        <StatCard
          label="通過率"
          value={`${stats.passRate}%`}
          highlight={stats.passRate >= 60}
        />
        <StatCard label="平均分" value={stats.averageScore} />
      </div>

      {/* 分數分布 */}
      {stats.totalAttempts > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">分數分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              {stats.distribution.map((b) => (
                <div
                  key={b.label}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs font-semibold text-foreground">
                    {b.count}
                  </span>
                  <div className="flex h-24 w-full items-end">
                    <div
                      className="w-full rounded-t bg-purple-400/80"
                      style={{
                        height: `${(b.count / maxBucket) * 100}%`,
                        minHeight: b.count > 0 ? '4px' : '0px',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as ResultFilter)}>
            <TabsList className="mb-4">
              {RESULT_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filteredAttempts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileQuestion className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {stats.totalAttempts === 0
                  ? '尚無學員作答'
                  : '此分類目前沒有作答'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-transparent">
                    <TableHead className="text-xs font-medium">學員</TableHead>
                    <TableHead className="text-xs font-medium text-center">
                      得分
                    </TableHead>
                    <TableHead className="text-xs font-medium text-center">
                      結果
                    </TableHead>
                    <TableHead className="text-xs font-medium">作答時間</TableHead>
                    <TableHead className="text-xs font-medium text-right">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttempts.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell>
                        <p className="text-sm font-medium">
                          {a.user.name || '未設定姓名'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.user.email}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold tabular-nums">
                          {a.score}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {a.passed ? (
                          <Badge className="border border-[#6EE7B7] bg-[#D1FAE5] text-xs text-[#065F46]">
                            通過
                          </Badge>
                        ) : (
                          <Badge className="border border-[#FCA5A5] bg-[#FEE2E2] text-xs text-[#991B1B]">
                            未通過
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {format(new Date(a.submittedAt), 'MM/dd HH:mm', {
                            locale: zhTW,
                          })}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setDetailAttempt(a)}
                        >
                          查看作答
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 逐題作答詳情 Dialog */}
      <Dialog
        open={!!detailAttempt}
        onOpenChange={(open) => {
          if (!open) setDetailAttempt(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailAttempt?.user.name || '未命名學員'} 的作答
            </DialogTitle>
          </DialogHeader>
          {detailAttempt && (
            <AttemptDetail attempt={detailAttempt} quiz={quiz} />
          )}
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDetailAttempt(null)}
            >
              <ChevronLeft className="mr-1.5 h-4 w-4" />
              返回列表
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── 單筆作答的逐題對照 ────────────────────────────────────────────────────────

function AttemptDetail({
  attempt,
  quiz,
}: {
  attempt: AdminQuizAttempt
  quiz: QuizResultsData['quiz']
}) {
  return (
    <div className="space-y-4">
      {/* 成績摘要 */}
      <div
        className={`rounded-lg border-2 p-4 text-center ${
          attempt.passed
            ? 'border-green-300 bg-green-50'
            : 'border-orange-200 bg-orange-50'
        }`}
      >
        <p
          className={`text-3xl font-extrabold tabular-nums ${
            attempt.passed ? 'text-green-700' : 'text-orange-600'
          }`}
        >
          {attempt.score}
          <span className="ml-1 text-base font-semibold">分</span>
        </p>
        <p
          className={`mt-1 text-sm font-bold ${
            attempt.passed ? 'text-green-700' : 'text-orange-600'
          }`}
        >
          {attempt.passed ? '通過' : '未通過'}・及格 {quiz.passingScore} 分
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          作答時間：
          {format(new Date(attempt.submittedAt), 'yyyy/MM/dd HH:mm')}
          {attempt.timeTakenSeconds != null &&
            `・花費 ${attempt.timeTakenSeconds} 秒`}
        </p>
      </div>

      {/* 逐題對照 */}
      <div className="space-y-3">
        {quiz.questions.map((question, idx) => {
          const studentAnswer = attempt.answers?.[question.id]
          const answered =
            studentAnswer !== undefined &&
            studentAnswer !== null &&
            studentAnswer !== ''
          const correct = isAnswerCorrect(
            question.type,
            studentAnswer,
            question.correctAnswer
          )

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
                <CardTitle className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-foreground">
                  <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <span className="flex-1">{question.content}</span>
                  {!answered ? (
                    <Minus className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : correct ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  )}
                </CardTitle>
                <div className="ml-9 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {QUESTION_TYPE_LABEL[question.type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {question.points} 分
                  </span>
                  {!answered && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      未作答
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 py-3">
                <div className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 font-medium text-muted-foreground">
                    學員答案：
                  </span>
                  <span
                    className={`font-medium leading-relaxed ${
                      !answered
                        ? 'text-muted-foreground'
                        : correct
                          ? 'text-green-700'
                          : 'text-red-600 line-through'
                    }`}
                  >
                    {formatStudentAnswer(
                      question.type,
                      studentAnswer,
                      question.options
                    )}
                  </span>
                </div>
                {(!answered || !correct) && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 shrink-0 font-medium text-muted-foreground">
                      正確答案：
                    </span>
                    <span className="font-semibold leading-relaxed text-green-700">
                      {formatCorrectAnswer(
                        question.type,
                        question.correctAnswer,
                        question.options
                      )}
                    </span>
                  </div>
                )}
                {question.explanation && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <p className="leading-relaxed text-blue-800">
                      {question.explanation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
