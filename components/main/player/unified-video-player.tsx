'use client'

import {
  forwardRef,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance,
} from '@vidstack/react'
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
  type DefaultLayoutTranslations,
} from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import {
  resolveAdminVideoSource,
  resolveStudentVideoSource,
  type UnifiedVideoProvider,
} from '@/lib/unified-video-player'
import { VideoWatermarkOverlay } from './video-watermark-overlay'
import type { VideoWatermarkPayload } from '@/lib/video-watermark'

export type UnifiedVideoPlayerMode = 'student' | 'adminPreview'

export interface UnifiedVideoPlayerHandle {
  seekTo: (seconds: number) => void
}

export interface UnifiedVideoPlayerProps {
  videoProvider: UnifiedVideoProvider
  videoSourceId: string
  videoUrl?: string | null
  title: string
  mode?: UnifiedVideoPlayerMode
  lessonId?: string
  poster?: string | null
  className?: string
  watermark?: VideoWatermarkPayload
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onDurationChange?: (duration: number) => void
  onError?: (error: unknown) => void
  onTamper?: (reason: string) => void
  subtitleUrl?: string | null
  subtitleLang?: string | null
  subtitleLabel?: string | null
}

const TRADITIONAL_CHINESE_TRANSLATIONS: DefaultLayoutTranslations = {
  'Announcements': '公告',
  'Accessibility': '無障礙功能',
  'AirPlay': 'AirPlay',
  'Audio': '音訊',
  'Auto': '自動',
  'Boost': '增強',
  'Captions': '字幕',
  'Caption Styles': '字幕樣式',
  'Captions look like this': '字幕預覽',
  'Chapters': '章節',
  'Closed-Captions Off': '關閉字幕',
  'Closed-Captions On': '開啟字幕',
  'Connected': '已連線',
  'Continue': '繼續',
  'Connecting': '連線中',
  'Default': '預設',
  'Disabled': '停用',
  'Disconnected': '未連線',
  'Display Background': '顯示背景',
  'Download': '下載',
  'Enter Fullscreen': '進入全螢幕',
  'Enter PiP': '進入子母畫面',
  'Exit Fullscreen': '離開全螢幕',
  'Exit PiP': '離開子母畫面',
  'Font': '字型',
  'Family': '字體',
  'Fullscreen': '全螢幕',
  'Google Cast': 'Google Cast',
  'Keyboard Animations': '鍵盤動畫',
  'LIVE': '直播',
  'Loop': '循環播放',
  'Mute': '靜音',
  'Normal': '正常',
  'Off': '關閉',
  'Pause': '暫停',
  'Play': '播放',
  'Playback': '播放',
  'PiP': '子母畫面',
  'Quality': '畫質',
  'Replay': '重播',
  'Reset': '重設',
  'Seek Backward': '向後跳轉',
  'Seek Forward': '向前跳轉',
  'Seek': '跳轉',
  'Settings': '設定',
  'Skip To Live': '跳至直播點',
  'Speed': '速度',
  'Size': '大小',
  'Color': '顏色',
  'Opacity': '不透明度',
  'Shadow': '陰影',
  'Text': '文字',
  'Text Background': '文字背景',
  'Track': '文字軌',
  'Unmute': '取消靜音',
  'Volume': '音量',
}

function LoadingState({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center p-4 text-sm text-white/70">{message}</div>
}

export const UnifiedVideoPlayer = forwardRef<UnifiedVideoPlayerHandle, UnifiedVideoPlayerProps>(
  function UnifiedVideoPlayer(
    {
      videoProvider,
      videoSourceId,
      videoUrl,
      title,
      mode = 'adminPreview',
      lessonId,
      poster,
      className,
      watermark,
      onPlay,
      onPause,
      onEnded,
      onTimeUpdate,
      onDurationChange,
      onError,
      onTamper,
      subtitleUrl,
      subtitleLang,
      subtitleLabel,
    },
    ref,
  ) {
    const playerRef = useRef<MediaPlayerInstance>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [src, setSrc] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [tamperDetected, setTamperDetected] = useState(false)

    const handleTamper = (reason: string) => {
      playerRef.current?.pause()
      setTamperDetected(true)
      onTamper?.(reason)
    }

    useImperativeHandle(ref, () => ({
      seekTo: (seconds) => {
        if (playerRef.current) playerRef.current.currentTime = seconds
      },
    }), [])

    useEffect(() => {
      let cancelled = false
      let retryTimer: ReturnType<typeof setTimeout> | null = null
      setSrc(null)
      setError(null)
      setTamperDetected(false)

      if (mode === 'student' && !lessonId) {
        setError('缺少課程單元資訊')
        return () => undefined
      }

      const loadSource = async (): Promise<void> => {
        try {
          const nextSrc = mode === 'student'
            ? await resolveStudentVideoSource({ lessonId: lessonId!, videoProvider, videoSourceId, videoUrl })
            : await resolveAdminVideoSource({ videoProvider, videoSourceId, videoUrl })
          if (!cancelled) setSrc(nextSrc)
        } catch (reason) {
          if (cancelled) return
          if (reason instanceof Error && reason.message.includes('影片仍在處理中')) {
            retryTimer = setTimeout(loadSource, 5000)
            return
          }
          const message = reason instanceof Error ? reason.message : '無法載入影片'
          setError(message)
          onError?.(reason)
        }
      }

      void loadSource()
      return () => {
        cancelled = true
        if (retryTimer) clearTimeout(retryTimer)
      }
    }, [lessonId, mode, onError, videoProvider, videoSourceId, videoUrl])

    if (error) {
      return <div className="flex h-full items-center justify-center p-4 text-sm text-white">{error}</div>
    }

    if (tamperDetected) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white">
          <p className="text-lg font-semibold">{title}</p>
          <p className="text-sm text-white/75">偵測到浮水印保護被破壞，這支影片已暫停。</p>
          <p className="text-xs text-white/50">請重新整理頁面後再試。</p>
        </div>
      )
    }

    if (!src) return <LoadingState message={mode === 'student' ? '正在準備影片…' : '正在載入影片預覽…'} />

    const frameClassName = className || 'h-full w-full'

    return (
      <div ref={containerRef} className="relative h-full w-full">
        {videoProvider === 'bunny' ? (
          <iframe
            src={src}
            className={frameClassName}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={title}
          />
        ) : (
          <MediaPlayer
            ref={playerRef}
            className={frameClassName}
            src={src}
            title={title}
            load="eager"
            playsInline
            onPlay={onPlay}
            onPause={onPause}
            onEnded={onEnded}
            onTimeUpdate={() => onTimeUpdate?.(Math.floor(playerRef.current?.currentTime || 0))}
            onDurationChange={() => onDurationChange?.(Math.floor(playerRef.current?.duration || 0))}
            onError={onError}
          >
            <MediaProvider>
              {poster ? <Poster className="vds-poster" src={poster} alt={title} /> : null}
            </MediaProvider>
            {subtitleUrl ? (
              <Track
                src={subtitleUrl}
                type={subtitleUrl.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt'}
                kind="subtitles"
                lang={subtitleLang || 'zh-TW'}
                label={subtitleLabel || '字幕'}
                default
              />
            ) : null}
            <DefaultVideoLayout
              icons={defaultLayoutIcons}
              translations={TRADITIONAL_CHINESE_TRANSLATIONS}
            />
          </MediaPlayer>
        )}
        <VideoWatermarkOverlay
          watermark={watermark}
          containerRef={containerRef as RefObject<HTMLElement | null>}
          onTamper={handleTamper}
        />
      </div>
    )
  },
)
