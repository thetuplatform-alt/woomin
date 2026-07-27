'use client'

import { useId } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type {
  QuizQuestionFormData,
  QuizQuestionTypeValue,
} from '@/lib/validations/quiz'

type QuestionWithId = QuizQuestionFormData & { id?: string }

interface QuestionEditorProps {
  question: QuestionWithId
  index: number
  onChange: (question: QuestionWithId) => void
  onDelete: () => void
}

const QUESTION_TYPE_LABELS: Record<QuizQuestionTypeValue, string> = {
  SINGLE_CHOICE: '單選題',
  MULTIPLE_CHOICE: '多選題',
  TRUE_FALSE: '是非題',
  FILL_IN_BLANK: '填空題',
}

// 新題目的預設值（依題型）
function buildDefaultQuestion(
  type: QuizQuestionTypeValue,
  base: Partial<QuestionWithId> = {}
): QuestionWithId {
  const common = {
    id: base.id,
    content: base.content ?? '',
    explanation: base.explanation ?? '',
    points: base.points ?? 1,
  }

  switch (type) {
    case 'SINGLE_CHOICE':
      return {
        ...common,
        type: 'SINGLE_CHOICE',
        options: [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' },
        ],
        correctAnswer: '',
      }
    case 'MULTIPLE_CHOICE':
      return {
        ...common,
        type: 'MULTIPLE_CHOICE',
        options: [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' },
        ],
        correctAnswer: [],
      }
    case 'TRUE_FALSE':
      return {
        ...common,
        type: 'TRUE_FALSE',
        options: [
          { id: 'true', text: '正確' },
          { id: 'false', text: '錯誤' },
        ],
        correctAnswer: true,
      }
    case 'FILL_IN_BLANK':
      return {
        ...common,
        type: 'FILL_IN_BLANK',
        options: null,
        correctAnswer: [''],
      }
  }
}

export function QuestionEditor({
  question,
  index,
  onChange,
  onDelete,
}: QuestionEditorProps) {
  const baseId = useId()

  function handleTypeChange(newType: QuizQuestionTypeValue) {
    onChange(
      buildDefaultQuestion(newType, {
        id: question.id,
        content: question.content,
        explanation: question.explanation ?? '',
        points: question.points,
      })
    )
  }

  // ─── 單選 / 多選：選項管理 ───────────────────────────────────────────────

  function addOption() {
    if (
      question.type !== 'SINGLE_CHOICE' &&
      question.type !== 'MULTIPLE_CHOICE'
    )
      return
    const options = [...(question.options ?? []), { id: crypto.randomUUID(), text: '' }]
    onChange({ ...question, options } as QuestionWithId)
  }

  function updateOptionText(optionId: string, text: string) {
    if (
      question.type !== 'SINGLE_CHOICE' &&
      question.type !== 'MULTIPLE_CHOICE'
    )
      return
    const options = question.options!.map((o) =>
      o.id === optionId ? { ...o, text } : o
    )
    onChange({ ...question, options } as QuestionWithId)
  }

  function removeOption(optionId: string) {
    if (
      question.type !== 'SINGLE_CHOICE' &&
      question.type !== 'MULTIPLE_CHOICE'
    )
      return
    const options = question.options!.filter((o) => o.id !== optionId)
    let correctAnswer = question.correctAnswer
    if (question.type === 'SINGLE_CHOICE' && correctAnswer === optionId) {
      correctAnswer = ''
    }
    if (question.type === 'MULTIPLE_CHOICE' && Array.isArray(correctAnswer)) {
      correctAnswer = (correctAnswer as string[]).filter((id) => id !== optionId)
    }
    onChange({ ...question, options, correctAnswer } as QuestionWithId)
  }

  // ─── 填空題：可接受答案管理 ──────────────────────────────────────────────

  function addBlankAnswer() {
    if (question.type !== 'FILL_IN_BLANK') return
    const correctAnswer = [...(question.correctAnswer as string[]), '']
    onChange({ ...question, correctAnswer } as QuestionWithId)
  }

  function updateBlankAnswer(idx: number, value: string) {
    if (question.type !== 'FILL_IN_BLANK') return
    const correctAnswer = (question.correctAnswer as string[]).map((a, i) =>
      i === idx ? value : a
    )
    onChange({ ...question, correctAnswer } as QuestionWithId)
  }

  function removeBlankAnswer(idx: number) {
    if (question.type !== 'FILL_IN_BLANK') return
    const correctAnswer = (question.correctAnswer as string[]).filter(
      (_, i) => i !== idx
    )
    onChange({ ...question, correctAnswer } as QuestionWithId)
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      {/* 標題列 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-mono">
            Q{index + 1}
          </Badge>
          <Select value={question.type} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(QUESTION_TYPE_LABELS) as QuizQuestionTypeValue[]).map(
                (t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {QUESTION_TYPE_LABELS[t]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 題幹 */}
      <div className="space-y-1.5">
        <Label htmlFor={`${baseId}-content`} className="text-xs">
          題幹 <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id={`${baseId}-content`}
          value={question.content}
          onChange={(e) => onChange({ ...question, content: e.target.value })}
          placeholder="輸入題目內容..."
          className="text-sm min-h-[64px] resize-none"
          rows={2}
        />
      </div>

      <Separator />

      {/* ─── 單選題 ─── */}
      {question.type === 'SINGLE_CHOICE' && (
        <div className="space-y-2">
          <Label className="text-xs">選項（點選圓圈標記正確答案）</Label>
          {question.options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${baseId}-correct`}
                checked={question.correctAnswer === option.id}
                onChange={() =>
                  onChange({ ...question, correctAnswer: option.id })
                }
                className="accent-primary shrink-0"
              />
              <Input
                value={option.text}
                onChange={(e) => updateOptionText(option.id, e.target.value)}
                placeholder={`選項內容`}
                className="h-7 text-xs flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeOption(option.id)}
                disabled={question.options.length <= 2}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {question.options.length < 10 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={addOption}
            >
              <Plus className="h-3 w-3" />
              新增選項
            </Button>
          )}
        </div>
      )}

      {/* ─── 多選題 ─── */}
      {question.type === 'MULTIPLE_CHOICE' && (
        <div className="space-y-2">
          <Label className="text-xs">選項（勾選方塊標記正確答案，可複選）</Label>
          {question.options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={(question.correctAnswer as string[]).includes(option.id)}
                onChange={(e) => {
                  const prev = question.correctAnswer as string[]
                  const next = e.target.checked
                    ? [...prev, option.id]
                    : prev.filter((id) => id !== option.id)
                  onChange({ ...question, correctAnswer: next })
                }}
                className="accent-primary shrink-0"
              />
              <Input
                value={option.text}
                onChange={(e) => updateOptionText(option.id, e.target.value)}
                placeholder="選項內容"
                className="h-7 text-xs flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeOption(option.id)}
                disabled={question.options.length <= 2}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {question.options.length < 10 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={addOption}
            >
              <Plus className="h-3 w-3" />
              新增選項
            </Button>
          )}
        </div>
      )}

      {/* ─── 是非題 ─── */}
      {question.type === 'TRUE_FALSE' && (
        <div className="space-y-2">
          <Label className="text-xs">正確答案</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="radio"
                name={`${baseId}-tf`}
                checked={question.correctAnswer === true}
                onChange={() => onChange({ ...question, correctAnswer: true })}
                className="accent-primary"
              />
              正確
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="radio"
                name={`${baseId}-tf`}
                checked={question.correctAnswer === false}
                onChange={() => onChange({ ...question, correctAnswer: false })}
                className="accent-primary"
              />
              錯誤
            </label>
          </div>
        </div>
      )}

      {/* ─── 填空題 ─── */}
      {question.type === 'FILL_IN_BLANK' && (
        <div className="space-y-2">
          <Label className="text-xs">可接受的答案（不區分大小寫）</Label>
          {(question.correctAnswer as string[]).map((ans, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={ans}
                onChange={(e) => updateBlankAnswer(idx, e.target.value)}
                placeholder={`答案 ${idx + 1}`}
                className="h-7 text-xs flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeBlankAnswer(idx)}
                disabled={(question.correctAnswer as string[]).length <= 1}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {(question.correctAnswer as string[]).length < 20 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={addBlankAnswer}
            >
              <Plus className="h-3 w-3" />
              新增接受答案
            </Button>
          )}
        </div>
      )}

      <Separator />

      {/* 分數 + 解析 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${baseId}-points`} className="text-xs">
            分數
          </Label>
          <Input
            id={`${baseId}-points`}
            type="number"
            min={1}
            max={100}
            value={question.points}
            onChange={(e) =>
              onChange({ ...question, points: Number(e.target.value) })
            }
            className="h-7 text-xs"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${baseId}-explanation`} className="text-xs">
          解析 <span className="text-muted-foreground">（選填）</span>
        </Label>
        <Textarea
          id={`${baseId}-explanation`}
          value={question.explanation ?? ''}
          onChange={(e) =>
            onChange({ ...question, explanation: e.target.value })
          }
          placeholder="可輸入答題解析，讓學員了解答案背後的理由..."
          className="text-xs min-h-[48px] resize-none"
          rows={2}
        />
      </div>
    </div>
  )
}
