// components/admin/ai-course/hooks/use-course-processor.ts
// AI 課程處理 Hook - 管理上傳和 AI 生成的並行處理

'use client'

import { useState, useCallback, useRef } from 'react'
import { ConcurrencyController } from '@/lib/utils/concurrency'
import { readFileAsText, srtToText } from '@/lib/utils/srt-parser'
import { uploadVideo, parseCloudflareError } from '@/lib/utils/video-uploader'
import type {
  ParsedChapter,
  ParsedLesson,
  LessonProcessState,
  ProcessingStats,
} from '../types'

interface UseCourseProcessorOptions {
  maxUploadConcurrency?: number
  maxAiConcurrency?: number
}

interface UseCourseProcessorReturn {
  states: Map<string, LessonProcessState>
  stats: ProcessingStats
  isProcessing: boolean
  startProcessing: (chapters: ParsedChapter[], options?: { skipAI?: boolean }) => Promise<void>
  retryLesson: (lessonId: string, chapter: ParsedChapter) => Promise<void>
  updateLessonContent: (lessonId: string, content: string) => void
  updateLessonTitle: (lessonId: string, title: string) => void
}

/**
 * AI 課程處理 Hook
 */
export function useCourseProcessor(
  options: UseCourseProcessorOptions = {}
): UseCourseProcessorReturn {
  // 影片上傳改為序列 (1)，避免 Cloudflare 並行請求問題
  const { maxUploadConcurrency = 1, maxAiConcurrency = 5 } = options

  const [states, setStates] = useState<Map<string, LessonProcessState>>(
    new Map()
  )
  const [isProcessing, setIsProcessing] = useState(false)

  // 並行控制器
  const uploadController = useRef(
    new ConcurrencyController<void>(maxUploadConcurrency)
  )
  const aiController = useRef(
    new ConcurrencyController<void>(maxAiConcurrency)
  )

  // 暫存章節資料 (供重試使用)
  const chaptersRef = useRef<ParsedChapter[]>([])

  // 更新單一狀態
  const updateState = useCallback(
    (id: string, updates: Partial<LessonProcessState>) => {
      setStates((prev) => {
        const newMap = new Map(prev)
        const current = newMap.get(id)
        if (current) {
          newMap.set(id, { ...current, ...updates })
        }
        return newMap
      })
    },
    []
  )

  // 處理單一單元
  const processLesson = useCallback(
    async (lesson: ParsedLesson, chapterTitle: string, skipAI: boolean = false) => {
      const { folderItem } = lesson

      try {
        // 1. 上傳影片 (如果有)
        if (folderItem.videoFile) {
          updateState(lesson.id, { status: 'uploading', uploadProgress: 0 })

          await uploadController.current.add(async () => {
            // 使用共用的上傳工具（自動選擇 Direct Upload 或 TUS）
            const result = await uploadVideo(
              folderItem.videoFile!,
              (progress) => {
                updateState(lesson.id, { uploadProgress: progress })
              }
            )

            updateState(lesson.id, {
              videoProvider: 'cloudflare',
              videoSourceId: result.uid,
              videoUrl: null,
              videoThumbnail: null,
              videoId: result.uid,
              videoDuration: result.duration,
              uploadProgress: 100,
            })
          })
        }

        // 2. 處理講義內容
        // 優先順序：有 .md → 直接讀取；無 .md 有 .srt 且未跳過 AI → AI 生成
        if (folderItem.mdFile) {
          // 直接讀取 Markdown 檔案作為講義
          updateState(lesson.id, { status: 'generating' })
          const mdContent = await readFileAsText(folderItem.mdFile)
          updateState(lesson.id, {
            generatedContent: mdContent,
            status: 'completed',
          })
        } else if (folderItem.srtFile && !skipAI) {
          // 透過 AI 從 SRT 字幕生成講義
          updateState(lesson.id, { status: 'generating' })

          await aiController.current.add(async () => {
            // 讀取 SRT 內容
            const srtRaw = await readFileAsText(folderItem.srtFile!)
            const srtText = srtToText(srtRaw)

            // 呼叫 AI API
            const response = await fetch(
              '/api/admin/ai-course/generate-content',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  srtContent: srtText,
                  lessonTitle: lesson.title,
                  chapterTitle,
                }),
              }
            )

            if (!response.ok) {
              throw new Error(await response.text())
            }

            // 處理串流回應 (純文字串流)
            const reader = response.body?.getReader()
            if (!reader) {
              throw new Error('無法讀取回應')
            }

            const decoder = new TextDecoder()
            let content = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })
              content += chunk

              updateState(lesson.id, { generatedContent: content })
            }

            // 從生成的內容提取建議標題
            let suggestedTitle = ''
            const titleMatch = content.match(/^#\s+(.+)$/m)
            if (titleMatch) {
              suggestedTitle = titleMatch[1].slice(0, 50)
            } else {
              const firstLine = content.split('\n')[0] || ''
              suggestedTitle = firstLine.replace(/^[#*\->\s]+/, '').slice(0, 50)
            }

            updateState(lesson.id, {
              generatedTitle: suggestedTitle,
              status: 'completed',
            })
          })
        } else {
          // 無講義來源或跳過 AI，直接完成
          updateState(lesson.id, { status: 'completed' })
        }
      } catch (error) {
        console.error(`處理單元 ${lesson.id} 失敗:`, error)
        const errorMessage =
          error instanceof Error ? error.message : '處理失敗'
        updateState(lesson.id, {
          status: 'error',
          error: parseCloudflareError(errorMessage),
        })
      }
    },
    [updateState]
  )

  // 開始處理所有單元
  const startProcessing = useCallback(
    async (chapters: ParsedChapter[], opts?: { skipAI?: boolean }) => {
      const shouldSkipAI = opts?.skipAI ?? false
      chaptersRef.current = chapters
      setIsProcessing(true)

      // 收集所有單元
      const allLessons: Array<{ lesson: ParsedLesson; chapterTitle: string }> =
        []
      for (const chapter of chapters) {
        for (const lesson of chapter.lessons) {
          allLessons.push({ lesson, chapterTitle: chapter.title })
        }
      }

      // 建立初始狀態
      const initialStates = new Map<string, LessonProcessState>()
      for (const { lesson } of allLessons) {
        initialStates.set(lesson.id, {
          id: lesson.id,
          status: 'pending',
          uploadProgress: 0,
          videoProvider: null,
          videoSourceId: null,
          videoUrl: null,
          videoThumbnail: null,
          videoId: null,
          videoDuration: null,
          generatedTitle: '',
          generatedContent: '',
          error: null,
        })
      }
      setStates(initialStates)

      // 並行處理所有單元
      const promises = allLessons.map(({ lesson, chapterTitle }) =>
        processLesson(lesson, chapterTitle, shouldSkipAI)
      )

      await Promise.allSettled(promises)
      setIsProcessing(false)
    },
    [processLesson]
  )

  // 重試單一單元
  const retryLesson = useCallback(
    async (lessonId: string, chapter: ParsedChapter) => {
      const lesson = chapter.lessons.find((l) => l.id === lessonId)
      if (!lesson) return

      // 重設狀態
      updateState(lessonId, {
        status: 'pending',
        uploadProgress: 0,
        error: null,
      })

      await processLesson(lesson, chapter.title)
    },
    [processLesson, updateState]
  )

  // 手動更新內容
  const updateLessonContent = useCallback(
    (lessonId: string, content: string) => {
      updateState(lessonId, { generatedContent: content })
    },
    [updateState]
  )

  // 手動更新標題
  const updateLessonTitle = useCallback(
    (lessonId: string, title: string) => {
      updateState(lessonId, { generatedTitle: title })
    },
    [updateState]
  )

  // 計算統計資訊
  const stats: ProcessingStats = {
    total: states.size,
    uploading: Array.from(states.values()).filter(
      (s) => s.status === 'uploading'
    ).length,
    generating: Array.from(states.values()).filter(
      (s) => s.status === 'generating'
    ).length,
    completed: Array.from(states.values()).filter(
      (s) => s.status === 'completed'
    ).length,
    failed: Array.from(states.values()).filter((s) => s.status === 'error')
      .length,
  }

  return {
    states,
    stats,
    isProcessing,
    startProcessing,
    retryLesson,
    updateLessonContent,
    updateLessonTitle,
  }
}
