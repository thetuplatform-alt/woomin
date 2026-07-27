// lib/validations/user.ts
// 用戶相關驗證規則
// 使用 Zod 進行表單驗證

import { z } from 'zod'

/**
 * 用戶角色選項
 */
export const userRoleOptions = [
  { value: 'USER', label: '學員' },
  { value: 'INSTRUCTOR', label: '講師' },
  { value: 'ADMIN', label: '管理員' },
] as const

export const visibleUserRoleSchema = z.enum(['USER', 'INSTRUCTOR', 'ADMIN'])

/**
 * 用戶搜尋參數 Schema
 */
export const userSearchSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['ALL', 'USER', 'INSTRUCTOR', 'ADMIN']).optional(),
  hasPurchase: z.enum(['all', 'yes', 'no']).optional(),
  /** 依課程篩選：只顯示持有此課程有效授權的用戶 */
  courseId: z.string().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
})

export type UserSearchParams = z.infer<typeof userSearchSchema>

/**
 * 授權課程存取 Schema
 */
export const grantAccessSchema = z.object({
  userId: z.string().min(1, { message: '用戶 ID 必填' }),
  courseId: z.string().min(1, { message: '課程 ID 必填' }),
  expiresAt: z.date().optional().nullable(),
  /**
   * - 'course_default'：套用課程預設授權期限（依 Course.accessType 計算）
   * - 'custom'：採用 expiresAt 欄位值（null 表永久）
   */
  expiresMode: z.enum(['course_default', 'custom']).optional(),
  grantNote: z.string().max(500).optional().nullable(),
  /**
   * 是否通知學員（預設 true）
   */
  notifyUser: z.boolean().optional(),
})

export type GrantAccessData = z.infer<typeof grantAccessSchema>

/**
 * 延長課程存取 Schema
 */
export const extendAccessSchema = z.object({
  userId: z.string().min(1),
  courseId: z.string().min(1),
  /**
   * 'add_days' 代表從目前 expiresAt 加上 days 天
   * 'set_date' 代表直接設定到期日（null = 改為永久）
   */
  mode: z.enum(['add_days', 'set_date']),
  days: z.number().int().min(1).max(3650).optional(),
  expiresAt: z.date().optional().nullable(),
  grantNote: z.string().max(500).optional().nullable(),
  notifyUser: z.boolean().optional(),
})

export type ExtendAccessData = z.infer<typeof extendAccessSchema>

/**
 * 撤銷課程存取 Schema
 */
export const revokeAccessSchema = z.object({
  userId: z.string().min(1, { message: '用戶 ID 必填' }),
  courseId: z.string().min(1, { message: '課程 ID 必填' }),
})

export type RevokeAccessData = z.infer<typeof revokeAccessSchema>

/**
 * 更新用戶角色 Schema
 */
export const updateRoleSchema = z.object({
  userId: z.string().min(1, { message: '用戶 ID 必填' }),
  role: visibleUserRoleSchema,
})

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(1, { message: '名稱必填' }).max(100, { message: '名稱不能超過 100 個字元' }),
  email: z.string().trim().email({ message: '請輸入有效的 Email' }),
  role: visibleUserRoleSchema.default('USER'),
  /** 同流程指派的課程（可多選；空陣列代表不指派） */
  courseIds: z.array(z.string().min(1)).optional(),
  /** 是否寄送設定密碼邀請信（預設關閉） */
  sendInvite: z.boolean().optional(),
})

export type CreateAdminUserData = z.infer<typeof createAdminUserSchema>

/**
 * 講師管理 — 即時搜尋既有用戶 Schema
 */
export const searchUsersSchema = z.object({
  query: z.string().trim().min(1, { message: '請輸入搜尋關鍵字' }).max(100),
})

export type SearchUsersData = z.infer<typeof searchUsersSchema>

/**
 * 講師管理 — 指派 / 新增講師或管理員 Schema
 * - 既有用戶：帶 userId
 * - 新用戶：帶 email（可選 name）
 */
export const teamRoleSchema = z.enum(['INSTRUCTOR', 'ADMIN'])

export const assignTeamRoleSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().trim().email({ message: '請輸入有效的 Email' }).optional(),
    name: z.string().trim().max(100).optional(),
    role: teamRoleSchema,
    /** 是否寄送設定密碼邀請信 */
    sendInvite: z.boolean().optional(),
  })
  .refine((data) => !!data.userId || !!data.email, {
    message: '請提供既有用戶或 Email',
    path: ['email'],
  })

export type AssignTeamRoleData = z.infer<typeof assignTeamRoleSchema>

export type UpdateRoleData = z.infer<typeof updateRoleSchema>

/**
 * 批次匯入學員的單筆資料 Schema
 */
export const importStudentRowSchema = z.object({
  name: z.string().min(1, { message: '姓名必填' }),
  email: z.string().email({ message: '請輸入有效的 Email' }),
  phone: z.string().optional(),
})

export type ImportStudentRow = z.infer<typeof importStudentRowSchema>

/**
 * 批次匯入學員 Schema
 */
export const importStudentsSchema = z.object({
  students: z.array(importStudentRowSchema).min(1, { message: '至少需要一筆學員資料' }).max(1000, { message: '每次最多匯入 1,000 筆' }),
  /** 指派課程（可多選；至少一門） */
  courseIds: z.array(z.string().min(1)).min(1, { message: '請至少選擇一門課程' }),
  /** 是否對本次新建的帳號寄送邀請信（預設關閉） */
  sendInvite: z.boolean().optional(),
})

export type ImportStudentsData = z.infer<typeof importStudentsSchema>
