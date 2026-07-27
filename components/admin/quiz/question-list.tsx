'use client'

import { ChevronUp, ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuestionEditor } from './question-editor'
import type { QuizQuestionFormData } from '@/lib/validations/quiz'

type QuestionWithId = QuizQuestionFormData & { id?: string }

interface QuestionListProps {
  questions: QuestionWithId[]
  onChange: (questions: QuestionWithId[]) => void
}

function buildNewQuestion(): QuestionWithId {
  return {
    type: 'SINGLE_CHOICE',
    content: '',
    explanation: '',
    points: 1,
    options: [
      { id: crypto.randomUUID(), text: '' },
      { id: crypto.randomUUID(), text: '' },
    ],
    correctAnswer: '',
  }
}

export function QuestionList({ questions, onChange }: QuestionListProps) {
  function addQuestion() {
    onChange([...questions, buildNewQuestion()])
  }

  function updateQuestion(index: number, updated: QuestionWithId) {
    const next = [...questions]
    next[index] = updated
    onChange(next)
  }

  function deleteQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index))
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...questions]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  function moveDown(index: number) {
    if (index === questions.length - 1) return
    const next = [...questions]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
          尚未新增任何題目，請點下方按鈕新增第一題
        </div>
      )}

      {questions.map((q, index) => (
        <div key={index} className="flex gap-2">
          {/* 排序按鈕 */}
          <div className="flex flex-col gap-0.5 pt-4 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              title="上移"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => moveDown(index)}
              disabled={index === questions.length - 1}
              title="下移"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* 題目編輯器 */}
          <div className="flex-1">
            <QuestionEditor
              question={q}
              index={index}
              onChange={(updated) => updateQuestion(index, updated)}
              onDelete={() => deleteQuestion(index)}
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 h-9 text-sm"
        onClick={addQuestion}
      >
        <Plus className="h-4 w-4" />
        新增題目
      </Button>
    </div>
  )
}
