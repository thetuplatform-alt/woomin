// lib/validations/assignment.ts
// 單元作業驗證規則

import { z } from 'zod'

// ==================== Enums ====================

export const assignmentSubmissionTypeEnum = z.enum([
  'TEXT',
  'IMAGE',
  'FILE',
  'MIXED',
])

export const assignmentEditorModeEnum = z.enum(['PLAIN', 'MARKDOWN'])

export const assignmentGradingTypeEnum = z.enum([
  'PASS_FAIL',
  'PERCENTAGE',
  'LETTER_GRADE',
])

export const assignmentSubmissionStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'NEEDS_REVISION',
  'REJECTED',
])

export const assignmentReviewStatusEnum = z.enum([
  'APPROVED',
  'NEEDS_REVISION',
  'REJECTED',
])

export const letterGradeEnum = z.enum(['A', 'B', 'C', 'D', 'F'])

// ==================== 檔案驗證常數 ====================

export const DEFAULT_ALLOWED_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
  document: [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'md',
    'csv',
  ],
  archive: ['zip'],
  code: ['js', 'ts', 'py', 'java', 'cpp', 'html', 'css', 'json'],
} as const

export const ALL_DEFAULT_EXTENSIONS = [
  ...DEFAULT_ALLOWED_EXTENSIONS.image,
  ...DEFAULT_ALLOWED_EXTENSIONS.document,
  ...DEFAULT_ALLOWED_EXTENSIONS.archive,
  ...DEFAULT_ALLOWED_EXTENSIONS.code,
]

export const BLOCKED_EXTENSIONS = [
  'exe',
  'bat',
  'sh',
  'cmd',
  'com',
  'msi',
  'app',
  'dmg',
  'deb',
  'rpm',
  'vbs',
  'ps1',
  'scr',
  'pif',
  'reg',
]

// 大小常數
export const FILE_SIZE_LIMITS = {
  IMAGE_MAX: 10 * 1024 * 1024, // 10 MB
  IMAGE_TOTAL_MAX: 50 * 1024 * 1024, // 50 MB
  IMAGE_MAX_COUNT: 10,
  FILE_MAX: 10 * 1024 * 1024, // 10 MB
  FILE_TOTAL_MAX: 100 * 1024 * 1024, // 100 MB
  FILE_MAX_COUNT: 5,
  ARCHIVE_MAX: 50 * 1024 * 1024, // 50 MB
  OTHER_MAX: 5 * 1024 * 1024, // 5 MB
  TEXT_MAX_CHARS: 100000,
  USER_COURSE_QUOTA: 200 * 1024 * 1024, // 200 MB per user per course
} as const

// ==================== 作業設定 Schema ====================

export const createAssignmentSchema = z.object({
  lessonId: z.string().min(1, { message: '單元 ID 為必填' }),

  title: z
    .string()
    .min(1, { message: '作業標題為必填' })
    .max(200, { message: '作業標題不能超過 200 個字元' }),

  description: z
    .string()
    .min(1, { message: '作業說明為必填' })
    .max(50000, { message: '作業說明不能超過 50000 個字元' }),

  submissionType: assignmentSubmissionTypeEnum,
  editorMode: assignmentEditorModeEnum.default('MARKDOWN'),

  minWords: z
    .number()
    .int()
    .min(0, { message: '最少字數不能為負數' })
    .nullable()
    .optional(),

  maxWords: z
    .number()
    .int()
    .min(1, { message: '最多字數至少為 1' })
    .max(100000, { message: '最多字數不能超過 100000' })
    .nullable()
    .optional(),

  maxImages: z
    .number()
    .int()
    .min(1, { message: '至少允許 1 張圖片' })
    .max(10, { message: '最多 10 張圖片' })
    .nullable()
    .optional()
    .default(10),

  maxImageSize: z
    .number()
    .int()
    .min(1)
    .max(FILE_SIZE_LIMITS.IMAGE_MAX)
    .nullable()
    .optional()
    .default(FILE_SIZE_LIMITS.IMAGE_MAX),

  maxFiles: z
    .number()
    .int()
    .min(1, { message: '至少允許 1 個檔案' })
    .max(5, { message: '最多 5 個檔案' })
    .nullable()
    .optional()
    .default(5),

  maxFileSize: z
    .number()
    .int()
    .min(1)
    .max(FILE_SIZE_LIMITS.FILE_MAX)
    .nullable()
    .optional()
    .default(FILE_SIZE_LIMITS.FILE_MAX),

  allowedExtensions: z
    .array(
      z
        .string()
        .min(1)
        .max(10)
        .regex(/^[a-zA-Z0-9]+$/, { message: '副檔名格式不正確' })
    )
    .nullable()
    .optional(),

  gradingType: assignmentGradingTypeEnum.default('PASS_FAIL'),

  passingScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .optional()
    .default(60),

  deadline: z.coerce.date().nullable().optional(),

  allowLateSubmission: z.boolean().default(false),
  allowResubmission: z.boolean().default(true),

  autoCleanupDays: z
    .number()
    .int()
    .min(1, { message: '自動清理天數至少為 1' })
    .max(365, { message: '自動清理天數不能超過 365' })
    .nullable()
    .optional(),
})

export type CreateAssignmentData = z.infer<typeof createAssignmentSchema>

export const updateAssignmentSchema = createAssignmentSchema
  .omit({ lessonId: true })
  .extend({
    assignmentId: z.string().min(1, { message: '作業 ID 為必填' }),
  })
  .partial()
  .required({ assignmentId: true })

export type UpdateAssignmentData = z.infer<typeof updateAssignmentSchema>

// ==================== 學員提交 Schema ====================

export const submitAssignmentSchema = z.object({
  assignmentId: z.string().min(1, { message: '作業 ID 為必填' }),
  content: z
    .string()
    .max(FILE_SIZE_LIMITS.TEXT_MAX_CHARS, {
      message: `內容不能超過 ${FILE_SIZE_LIMITS.TEXT_MAX_CHARS} 個字元`,
    })
    .nullable()
    .optional(),
  contentFormat: assignmentEditorModeEnum.optional(),
})

export type SubmitAssignmentData = z.infer<typeof submitAssignmentSchema>

export const resubmitAssignmentSchema = z.object({
  submissionId: z.string().min(1, { message: '提交 ID 為必填' }),
  content: z
    .string()
    .max(FILE_SIZE_LIMITS.TEXT_MAX_CHARS)
    .nullable()
    .optional(),
  contentFormat: assignmentEditorModeEnum.optional(),
})

export type ResubmitAssignmentData = z.infer<typeof resubmitAssignmentSchema>

// ==================== 草稿 Schema ====================

export const saveAssignmentDraftSchema = z.object({
  assignmentId: z.string().min(1, { message: '作業 ID 為必填' }),
  content: z
    .string()
    .max(FILE_SIZE_LIMITS.TEXT_MAX_CHARS)
    .nullable()
    .optional(),
  contentFormat: assignmentEditorModeEnum.optional(),
})

export type SaveAssignmentDraftData = z.infer<typeof saveAssignmentDraftSchema>

// ==================== 批改 Schema ====================

export const reviewSubmissionSchema = z
  .object({
    submissionId: z.string().min(1, { message: '提交 ID 為必填' }),

    status: assignmentReviewStatusEnum,

    feedback: z
      .string()
      .max(50000, { message: '評語不能超過 50000 個字元' })
      .nullable()
      .optional(),

    score: z.number().int().min(0).max(100).nullable().optional(),

    letterGrade: letterGradeEnum.nullable().optional(),
  })

export type ReviewSubmissionData = z.infer<typeof reviewSubmissionSchema>

// ==================== 上傳驗證 ====================

export function validateFileExtension(
  filename: string,
  allowedExtensions: string[] | null
): { valid: boolean; error?: string } {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) {
    return { valid: false, error: '無法辨識檔案類型' }
  }

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `不允許上傳 .${ext} 格式的檔案` }
  }

  const whitelist = allowedExtensions ?? ALL_DEFAULT_EXTENSIONS
  if (!whitelist.includes(ext)) {
    return {
      valid: false,
      error: `不允許的檔案類型 .${ext}，允許的類型：${whitelist.join(', ')}`,
    }
  }

  return { valid: true }
}

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0
  // 中文字元按字計算，英文按詞計算
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [])
    .length
  const englishWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
  return chineseChars + englishWords
}
