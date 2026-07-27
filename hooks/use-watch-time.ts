// hooks/use-watch-time.ts
// 觀看時間追蹤 Hook
// 每分鐘送一次心跳，超過 5 分鐘無活動自動停止

'use client'

import { useCallback, useEffect, useRef } from 'react'

const HEARTBEAT_INTERVAL_MS = 60_000 // 每 60 秒送一次心跳
const IDLE_TIMEOUT_MS = 5 * 60_000 // 5 分鐘無活動視為閒置

interface UseWatchTimeOptions {
  /** 單元 ID */
  lessonId: string
  /** 是否啟用追蹤（預設 true） */
  enabled?: boolean
}

/**
 * 觀看時間追蹤 Hook
 *
 * 判斷用戶是否正在觀看的邏輯（三個條件必須同時滿足）：
 * 1. 影片必須正在播放
 * 2. 在過去 5 分鐘內必須有任何用戶活動（滑鼠移動、捲動、點擊等）
 * 3. 頁面必須可見（未切換到其他分頁）
 *
 * 任一條件不滿足即視為閒置，停止計算觀看秒數。
 */
export function useWatchTime({
  lessonId,
  enabled = true,
}: UseWatchTimeOptions) {
  // 頁面是否隱藏（用戶切換分頁）
  const isPageHiddenRef = useRef(false)
  // 影片是否正在播放
  const isPlayingRef = useRef(false)
  // 最後一次用戶活動的時間戳
  const lastActivityRef = useRef(0)
  // 心跳計時器
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 當前心跳區間的開始時間
  const intervalStartRef = useRef<Date | null>(null)
  // 當前區間內的有效觀看秒數
  const activeSecondsRef = useRef(0)
  // 每秒計數器（用於累計有效觀看秒數）
  const tickTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 當前追蹤的 lessonId（避免閉包問題）
  const lessonIdRef = useRef(lessonId)

  // 同步 lessonId
  useEffect(() => {
    lessonIdRef.current = lessonId
  }, [lessonId])

  useEffect(() => {
    lastActivityRef.current = Date.now()
  }, [])

  /**
   * 判斷用戶是否處於活躍狀態
   * 條件：影片在播放 且 最後一次活動在 5 分鐘以內 且 頁面可見
   * 三個條件都必須滿足，避免用戶切換分頁後仍持續計數
   */
  const isUserActive = useCallback((): boolean => {
    const timeSinceLastActivity = Date.now() - lastActivityRef.current
    const hasRecentActivity = timeSinceLastActivity < IDLE_TIMEOUT_MS
    const isPlaying = isPlayingRef.current
    const isVisible = !isPageHiddenRef.current

    return isPlaying && hasRecentActivity && isVisible
  }, [])

  /**
   * 送出心跳到 API
   */
  const sendHeartbeat = useCallback(async (
    currentLessonId: string,
    startedAt: Date,
    duration: number,
  ) => {
    if (duration <= 0) return

    try {
      const data = JSON.stringify({
        lessonId: currentLessonId,
        startedAt: startedAt.toISOString(),
        duration,
      })

      // 嘗試用 fetch，失敗時用 sendBeacon
      await fetch('/api/watch-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      })
    } catch {
      // 靜默失敗，心跳丟失不影響用戶體驗
    }
  }, [])

  /**
   * 開始每秒 tick（累計有效觀看秒數）
   */
  const startTicking = useCallback(() => {
    if (tickTimerRef.current) return

    tickTimerRef.current = setInterval(() => {
      if (isUserActive()) {
        activeSecondsRef.current += 1
      }
    }, 1000)
  }, [isUserActive])

  /**
   * 停止每秒 tick
   */
  const stopTicking = useCallback(() => {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
  }, [])

  /**
   * 開始心跳計時器
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) return

    // 初始化區間
    intervalStartRef.current = new Date()
    activeSecondsRef.current = 0
    startTicking()

    heartbeatTimerRef.current = setInterval(() => {
      const startedAt = intervalStartRef.current
      const duration = activeSecondsRef.current

      if (startedAt && duration > 0) {
        sendHeartbeat(lessonIdRef.current, startedAt, duration)
      }

      // 重置區間
      intervalStartRef.current = new Date()
      activeSecondsRef.current = 0
    }, HEARTBEAT_INTERVAL_MS)
  }, [sendHeartbeat, startTicking])

  /**
   * 停止心跳計時器，並送出剩餘的觀看時間
   */
  const stopHeartbeat = useCallback(() => {
    stopTicking()

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }

    // 送出剩餘的觀看時間
    const startedAt = intervalStartRef.current
    const duration = activeSecondsRef.current
    if (startedAt && duration > 0) {
      sendHeartbeat(lessonIdRef.current, startedAt, duration)
    }

    intervalStartRef.current = null
    activeSecondsRef.current = 0
  }, [sendHeartbeat, stopTicking])

  /**
   * 通知影片播放狀態變更
   */
  const reportPlaying = useCallback((playing: boolean) => {
    isPlayingRef.current = playing
    lastActivityRef.current = Date.now()

    if (playing && !heartbeatTimerRef.current) {
      startHeartbeat()
    }
  }, [startHeartbeat])

  /**
   * 記錄用戶活動（滑鼠移動、捲動、點擊等）
   */
  const reportActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  /**
   * 監聽用戶活動事件（mousemove, scroll, click, keydown, touchstart）
   */
  useEffect(() => {
    if (!enabled) return

    const handleActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // 使用 passive 和 capture 減少效能影響
    const options: AddEventListenerOptions = { passive: true, capture: true }

    window.addEventListener('mousemove', handleActivity, options)
    window.addEventListener('scroll', handleActivity, options)
    window.addEventListener('click', handleActivity, options)
    window.addEventListener('keydown', handleActivity, options)
    window.addEventListener('touchstart', handleActivity, options)

    return () => {
      window.removeEventListener('mousemove', handleActivity, options)
      window.removeEventListener('scroll', handleActivity, options)
      window.removeEventListener('click', handleActivity, options)
      window.removeEventListener('keydown', handleActivity, options)
      window.removeEventListener('touchstart', handleActivity, options)
    }
  }, [enabled])

  /**
   * 頁面關閉或隱藏時送出剩餘心跳
   */
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = () => {
      const startedAt = intervalStartRef.current
      const duration = activeSecondsRef.current
      if (startedAt && duration > 0) {
        const data = JSON.stringify({
          lessonId: lessonIdRef.current,
          startedAt: startedAt.toISOString(),
          duration,
        })
        const blob = new Blob([data], { type: 'application/json' })
        navigator.sendBeacon('/api/watch-time', blob)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isPageHiddenRef.current = true
        handleBeforeUnload()
      } else {
        isPageHiddenRef.current = false
        // 回到頁面時更新活動時間，避免立即被判定為閒置
        lastActivityRef.current = Date.now()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled])

  /**
   * lessonId 變更時重置
   */
  useEffect(() => {
    return () => {
      stopHeartbeat()
    }
  }, [lessonId, stopHeartbeat])

  /**
   * 組件卸載時清理
   */
  useEffect(() => {
    return () => {
      stopHeartbeat()
    }
  }, [stopHeartbeat])

  return {
    /** 通知影片播放/暫停狀態 */
    reportPlaying,
    /** 手動回報用戶活動（通常不需要，已自動監聽） */
    reportActivity,
  }
}
