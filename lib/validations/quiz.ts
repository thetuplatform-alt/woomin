// lib/validations/quiz.ts
// 單元測驗驗證規則

import { z } from 'zod'

// ==================== Enums ====================

export const quizQuestionTypeEnum = z.enum([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_IN_BLANK',
])
export type QuizQuestionTypeValue = z.infer<typeof quizQuestionTypeEnum>

export const showAnswersStrategyEnum = z.enum([
  'IMMEDIATELY',
  'AFTER_PASS',
  'NEVER',
])
export type ShowAnswersStrategyValue = z.infer<typeof showAnswersStrategyEnum>

// ==================== 選項 Schema ====================

export const quizOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, { message: '選項內容不能為空' }),
})

export type QuizOption = z.infer<typeof quizOptionSchema>

// ==================== 測驗設定 Schema ====================

export const quizSettingsSchema = z.object({
  passingScore: z
    .number()
    .int()
    .min(0, { message: '及格分數不能小於 0' })
    .max(100, { message: '及格分數不能大於 100' })
    .default(60),

  timeLimitMinutes: z
    .number()
    .int()
    .min(0, { message: '時間限制不能為負數' })
    .nullable()
    .optional()
    .transform((v) => (v === 0 ? null : v)),

  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showAnswers: showAnswersStrategyEnum.default('IMMEDIATELY'),
  blockNextLesson: z.boolean().default(false),
})

export type QuizSettingsFormData = z.infer<typeof quizSettingsSchema>

// ==================== 題目 Schema ====================

const baseQuestionSchema = z.object({
  content: z
    .string()
    .min(1, { message: '題幹不能為空' })
    .max(10000, { message: '題幹不能超過 10000 個字元' }),
  explanation: z
    .string()
    .max(5000, { message: '解析不能超過 5000 個字元' })
    .optional()
    .nullable(),
  points: z
    .number()
    .int()
    .min(1, { message: '分數至少為 1' })
    .max(100, { message: '分數不能超過 100' })
    .default(1),
})

export const singleChoiceQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('SINGLE_CHOICE'),
  options: z
    .array(quizOptionSchema)
    .min(2, { message: '至少需要 2 個選項' })
    .max(10, { message: '最多 10 個選項' }),
  correctAnswer: z.string().min(1, { message: '必須選擇正確答案' }),
})

export const multipleChoiceQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('MULTIPLE_CHOICE'),
  options: z
    .array(quizOptionSchema)
    .min(2, { message: '至少需要 2 個選項' })
    .max(10, { message: '最多 10 個選項' }),
  correctAnswer: z
    .array(z.string().min(1))
    .min(1, { message: '至少需要 1 個正確答案' }),
})

export const trueFalseQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('TRUE_FALSE'),
  options: z
    .array(quizOptionSchema)
    .length(2)
    .optional(),
  correctAnswer: z.boolean(),
})

export const fillInBlankQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('FILL_IN_BLANK'),
  options: z.null().optional(),
  correctAnswer: z
    .array(z.string().min(1, { message: '答案不能為空' }))
    .min(1, { message: '至少需要 1 個可接受答案' })
    .max(20, { message: '最多 20 個可接受答案' }),
})

export const quizQuestionSchema = z.discriminatedUnion('type', [
  singleChoiceQuestionSchema,
  multipleChoiceQuestionSchema,
  trueFalseQuestionSchema,
  fillInBlankQuestionSchema,
])

export type QuizQuestionFormData = z.infer<typeof quizQuestionSchema>

// ==================== 建立/更新測驗 Schema ====================

export const createQuizSchema = z.object({
  lessonId: z.string().min(1, { message: '單元 ID 為必填' }),
  settings: quizSettingsSchema,
  questions: z
    .array(quizQuestionSchema)
    .min(1, { message: '至少需要 1 道題目' }),
})

export type CreateQuizData = z.infer<typeof createQuizSchema>

export const quizQuestionWithIdSchema = z.intersection(
  quizQuestionSchema,
  z.object({ id: z.string().optional() })
)

export const updateQuizSchema = z.object({
  quizId: z.string().min(1, { message: '測驗 ID 為必填' }),
  settings: quizSettingsSchema.optional(),
  questions: z
    .array(quizQuestionWithIdSchema)
    .min(1, { message: '至少需要 1 道題目' })
    .optional(),
})

export type UpdateQuizData = z.infer<typeof updateQuizSchema>

// ==================== 題目排序 Schema ====================

export const reorderQuestionsSchema = z.object({
  quizId: z.string().min(1),
  questionOrders: z.array(
    z.object({
      id: z.string().min(1),
      order: z.number().int().min(0),
    })
  ),
})

export type ReorderQuestionsData = z.infer<typeof reorderQuestionsSchema>

// ==================== 學員作答 Schema ====================

export const quizAnswerSchema = z.record(
  z.string(), // questionId
  z.union([
    z.string(), // 單選、填空
    z.array(z.string()), // 多選
    z.boolean(), // 是非
  ])
)

export const submitQuizAttemptSchema = z.object({
  quizId: z.string().min(1, { message: '測驗 ID 為必填' }),
  answers: quizAnswerSchema,
  startedAt: z.string().datetime(), // ISO 8601
})

export type SubmitQuizAttemptData = z.infer<typeof submitQuizAttemptSchema>
