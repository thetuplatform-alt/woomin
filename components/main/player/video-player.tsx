'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { useProgress } from '@/hooks/use-progress'
import { useWatchTime } from '@/hooks/use-watch-time'
import { UnifiedVideoPlayer, type UnifiedVideoPlayerHandle } from './unified-video-player'
import type { VideoWatermarkPayload } from '@/lib/video-watermark'

interface VideoPlayerProps {
  videoProvider: 'youtube' | 'cloudflare' | 'vimeo' | 'bunny' | null
  videoSourceId: string | null
  videoUrl?: string | null
  videoId: string | null
  title: string
  lessonId: string
  videoDuration?: number | null
  onComplete?: () => void
  onTimeUpdate?: (currentTime: number) => void
  trackingEnabled?: boolean
  watermark?: VideoWatermarkPayload
  compactMode?: boolean
  subtitleUrl?: string | null
  subtitleLang?: string | null
  subtitleLabel?: string | null
}

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      videoProvider,
      videoSourceId,
      videoUrl,
      videoId,
      title,
      lessonId,
      videoDuration,
      onComplete,
      onTimeUpdate,
      trackingEnabled = true,
      watermark,
      compactMode = false,
      subtitleUrl,
      subtitleLang,
      subtitleLabel,
    },
    ref,
  ) {
    const playerRef = useRef<UnifiedVideoPlayerHandle>(null)
    const [resolvedDuration, setResolvedDuration] = useState(videoDuration ?? 0)
    const effectiveVideoId = videoSourceId ?? videoId

    const { updateProgress, flushProgress, markComplete } = useProgress({
      lessonId,
      enabled: trackingEnabled,
      videoDuration: resolvedDuration,
      debounceMs: 5000,
      completeThreshold: 90,
      onComplete,
    })
    const { reportPlaying } = useWatchTime({ lessonId, enabled: trackingEnabled })

    useImperativeHandle(ref, () => ({
      seekTo: (seconds) => playerRef.current?.seekTo(seconds),
    }), [])

    useEffect(() => {
      setResolvedDuration(videoDuration ?? 0)
    }, [lessonId, videoDuration])

    const handlePlay = useCallback(() => {
      reportPlaying(true)
      if (trackingEnabled) {
        posthog.capture('video_play_started', {
          lesson_id: lessonId,
          lesson_title: title,
          video_id: effectiveVideoId,
          video_provider: videoProvider,
          video_duration: resolvedDuration,
        })
      }
    }, [effectiveVideoId, lessonId, reportPlaying, resolvedDuration, title, trackingEnabled, videoProvider])

    const handlePause = useCallback(() => {
      reportPlaying(false)
      void flushProgress()
    }, [flushProgress, reportPlaying])

    const handleEnded = useCallback(() => {
      reportPlaying(false)
      void markComplete()
      if (trackingEnabled) {
        posthog.capture('lesson_completed', {
          lesson_id: lessonId,
          lesson_title: title,
          video_duration: resolvedDuration,
          video_provider: videoProvider,
          completion_method: 'video_ended',
        })
      }
    }, [lessonId, markComplete, reportPlaying, resolvedDuration, title, trackingEnabled, videoProvider])

    const handleTimeUpdate = useCallback((currentTime: number) => {
      updateProgress(currentTime)
      onTimeUpdate?.(currentTime)
    }, [onTimeUpdate, updateProgress])

    const handleError = useCallback((reason: unknown) => {
      if (!trackingEnabled) return
      posthog.capture('video_playback_error', {
        lesson_id: lessonId,
        lesson_title: title,
        video_id: effectiveVideoId,
        video_provider: videoProvider,
        error_message: reason instanceof Error ? reason.message : 'player_error',
        error_type: 'vidstack_error',
      })
    }, [effectiveVideoId, lessonId, title, trackingEnabled, videoProvider])

    if (!videoProvider || !effectiveVideoId) {
      return <div className="flex h-full items-center justify-center bg-black text-sm text-white/70">目前沒有可播放的影片</div>
    }

    return (
      <div className={compactMode ? 'h-full w-full' : 'relative mx-auto aspect-video h-full w-full overflow-hidden bg-black'}>
        <UnifiedVideoPlayer
          ref={playerRef}
          mode="student"
          lessonId={lessonId}
          videoProvider={videoProvider}
          videoSourceId={effectiveVideoId}
          videoUrl={videoUrl}
          title={title}
          className="h-full w-full"
          watermark={watermark}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={setResolvedDuration}
          onError={handleError}
          subtitleUrl={subtitleUrl}
          subtitleLang={subtitleLang}
          subtitleLabel={subtitleLabel}
          onTamper={() => {
            reportPlaying(false)
            void flushProgress()
            if (trackingEnabled) {
              posthog.capture('video_watermark_tamper_detected', {
                lesson_id: lessonId,
                lesson_title: title,
                video_id: effectiveVideoId,
                video_provider: videoProvider,
              })
            }
          }}
        />
      </div>
    )
  },
)
