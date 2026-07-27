'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ProgressResponse } from '@/lib/validations/progress'
import posthog from 'posthog-js'

interface UseProgressOptions {
  lessonId: string
  enabled?: boolean
  videoDuration?: number | null
  debounceMs?: number
  completeThreshold?: number
  onProgressUpdate?: (response: ProgressResponse) => void
  onComplete?: () => void
}

interface UseProgressReturn {
  updateProgress: (watchedSec: number, forceComplete?: boolean) => void
  flushProgress: () => Promise<void>
  markComplete: () => Promise<void>
}

export function useProgress({
  lessonId,
  enabled = true,
  videoDuration,
  debounceMs = 5000,
  completeThreshold = 90,
  onProgressUpdate,
  onComplete,
}: UseProgressOptions): UseProgressReturn {
  const latestProgressRef = useRef<{
    watchedSec: number
    completed: boolean
    dirty: boolean
  }>({
    watchedSec: 0,
    completed: false,
    dirty: false,
  })

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hasMarkedCompleteRef = useRef(false)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3
  const RETRY_DELAY = 2000

  const sendProgress = useCallback(
    async (
      watchedSec: number,
      completed: boolean
    ): Promise<ProgressResponse> => {
      if (!enabled) {
        return { success: true }
      }

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await fetch('/api/lesson-progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              lessonId,
              watchedSec,
              completed,
            }),
          })

          const data: ProgressResponse = await response.json()

          if (data.success) {
            retryCountRef.current = 0

            if (completed) {
              posthog.capture('lesson_progress_updated', {
                lesson_id: lessonId,
                watched_seconds: watchedSec,
                completed,
              })
            }

            return data
          }

          if (attempt < MAX_RETRIES) {
            retryCountRef.current++
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
            continue
          }

          return data
        } catch {
          if (attempt < MAX_RETRIES) {
            retryCountRef.current++
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
            continue
          }

          return { success: false, error: '無法儲存觀看進度' }
        }
      }

      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
      }

      return { success: false, error: '無法儲存觀看進度' }
    },
    [enabled, lessonId]
  )

  const flushProgress = useCallback(async (): Promise<void> => {
    if (!enabled) {
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (!latestProgressRef.current.dirty) {
      return
    }

    const { watchedSec, completed } = latestProgressRef.current
    latestProgressRef.current.dirty = false

    const response = await sendProgress(watchedSec, completed)
    onProgressUpdate?.(response)

    if (completed && response.success && !hasMarkedCompleteRef.current) {
      hasMarkedCompleteRef.current = true
      onComplete?.()
    }
  }, [enabled, onComplete, onProgressUpdate, sendProgress])

  const updateProgress = useCallback(
    (watchedSec: number, forceComplete = false): void => {
      if (!enabled) {
        return
      }

      const maxWatchedSec = Math.max(latestProgressRef.current.watchedSec, watchedSec)

      let completed = forceComplete || latestProgressRef.current.completed
      if (!completed && videoDuration && videoDuration > 0) {
        const percentage = (maxWatchedSec / videoDuration) * 100
        completed = percentage >= completeThreshold
      }

      latestProgressRef.current = {
        watchedSec: maxWatchedSec,
        completed,
        dirty: true,
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        void flushProgress()
      }, debounceMs)
    },
    [completeThreshold, debounceMs, enabled, flushProgress, videoDuration]
  )

  const markComplete = useCallback(async (): Promise<void> => {
    if (!enabled || hasMarkedCompleteRef.current) {
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    const watchedSec = videoDuration || latestProgressRef.current.watchedSec
    latestProgressRef.current = {
      watchedSec,
      completed: true,
      dirty: false,
    }

    const response = await sendProgress(watchedSec, true)
    onProgressUpdate?.(response)

    if (response.success) {
      hasMarkedCompleteRef.current = true
      onComplete?.()
    }
  }, [enabled, onComplete, onProgressUpdate, sendProgress, videoDuration])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleBeforeUnload = () => {
      if (!latestProgressRef.current.dirty) {
        return
      }

      const { watchedSec, completed } = latestProgressRef.current
      const data = JSON.stringify({
        lessonId,
        watchedSec,
        completed,
      })

      const blob = new Blob([data], { type: 'application/json' })
      navigator.sendBeacon('/api/lesson-progress', blob)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enabled, lessonId])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushProgress()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, flushProgress])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    latestProgressRef.current = {
      watchedSec: 0,
      completed: false,
      dirty: false,
    }
    hasMarkedCompleteRef.current = false
  }, [lessonId])

  return {
    updateProgress,
    flushProgress,
    markComplete,
  }
}
