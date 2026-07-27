// components/admin/ai-course/types.ts
// AI 快速建立課程的類型定義

import type { ParsedChapter, ParsedLesson, ParsedFolderItem } from '@/lib/utils/folder-parser'

// 重新匯出，方便使用
export type { ParsedChapter, ParsedLesson, ParsedFolderItem }

/** Modal 階段 */
export type ModalStage = 'drop' | 'preview' | 'processing' | 'confirm'

/** 處理狀態 */
export type ProcessStatus = 'pending' | 'uploading' | 'generating' | 'completed' | 'error'

/** 單元處理進度 */
export interface LessonProcessState {
  id: string
  status: ProcessStatus
  uploadProgress: number       // 0-100
  videoProvider: 'youtube' | 'cloudflare' | 'vimeo' | null
  videoSourceId: string | null
  videoUrl: string | null
  videoThumbnail: string | null
  videoId: string | null
  videoDuration: number | null
  generatedTitle: string       // AI 建議標題 (從內容第一行提取或自動生成)
  generatedContent: string     // AI 生成內容 (串流更新)
  error: string | null
}

/** 處理進度統計 */
export interface ProcessingStats {
  total: number
  uploading: number
  generating: number
  completed: number
  failed: number
}

/** AI 內容生成請求 */
export interface GenerateContentRequest {
  srtContent: string
  lessonTitle: string
  chapterTitle: string
}
