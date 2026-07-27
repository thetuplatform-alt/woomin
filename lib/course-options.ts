// lib/course-options.ts
// 瀏覽器端可安全匯入的課程選項，不帶入完整表單驗證規則。

/**
 * 課程狀態選項
 */
export const courseStatusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已發佈' },
  { value: 'UNLISTED', label: '隱藏' },
] as const

/**
 * 課程銷售可見性選項
 */
export const courseVisibilityOptions = [
  { value: 'PUBLIC', label: '公開販售' },
  { value: 'UNLISTED', label: '連結販售' },
  { value: 'INVITE_ONLY', label: '私密邀請' },
] as const
