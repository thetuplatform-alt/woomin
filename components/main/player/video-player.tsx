"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Stream, type StreamPlayerApi } from "@cloudflare/stream-react";
import type VimeoPlayer from "@vimeo/player";
import type {
  DurationChangeEvent,
  ErrorEvent as VimeoErrorEvent,
  PlaybackRateChangeEvent,
  VimeoEvent,
  VolumeChangeEvent,
} from "@vimeo/player";
import {
  AlertCircle,
  Gauge,
  Loader2,
  Maximize,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useProgress } from "@/hooks/use-progress";
import { useWatchTime } from "@/hooks/use-watch-time";
import posthog from "posthog-js";
import {
  getVimeoWatchUrl,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  parseVimeoVideoSource,
} from "@/lib/video-source";
import { cn } from "@/lib/utils";
import { VideoWatermarkOverlay } from "./video-watermark-overlay";
import type { VideoWatermarkPayload } from "@/lib/video-watermark";

interface VideoPlayerProps {
  videoProvider: "youtube" | "cloudflare" | "vimeo" | "bunny" | null;
  videoSourceId: string | null;
  videoUrl?: string | null;
  videoId: string | null;
  title: string;
  lessonId: string;
  videoDuration?: number | null;
  onComplete?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  trackingEnabled?: boolean;
  watermark?: VideoWatermarkPayload;
  compactMode?: boolean;
}

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface StreamTokenResponse {
  success: boolean;
  signedUrl?: string;
  customerCode?: string;
  expiresIn?: number;
  error?: string;
  videoProcessing?: boolean;
  retryAfterSec?: number;
  cfStatus?: string;
  pctComplete?: number;
}

interface YouTubePlayerApi {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  destroy: () => void;
  setSize: (width: number, height: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  getAvailablePlaybackRates: () => number[];
  getPlayerState: () => number;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YouTubePlayerApi }) => void;
        onStateChange?: (event: {
          data: number;
          target: YouTubePlayerApi;
        }) => void;
        onError?: (event: { data: number; target: YouTubePlayerApi }) => void;
      };
    }
  ) => YouTubePlayerApi;
  PlayerState: {
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
    __youtubeIframeApiPromise?: Promise<YouTubeNamespace>;
  }
}

const YOUTUBE_DEFAULT_RATES = [0.75, 1, 1.25, 1.5, 2];
const VIMEO_DEFAULT_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const YOUTUBE_POLL_MS = 500;
const YOUTUBE_CONTROLS_HIDE_MS = 3000;
const PLAYER_VIEWPORT_WIDTH = "min(100%, calc((100dvh - 150px) * 16 / 9))";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function stopEventPropagation(
  event:
    | React.MouseEvent<HTMLElement>
    | React.PointerEvent<HTMLElement>
    | React.ChangeEvent<HTMLInputElement>
) {
  event.stopPropagation();
}

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainder
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function getNextPlaybackRate(
  currentRate: number,
  availableRates: number[]
): number {
  const rates = availableRates.length > 0 ? availableRates : YOUTUBE_DEFAULT_RATES;
  const currentIndex = rates.findIndex((rate) => rate === currentRate);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % rates.length : 1;
  return rates[nextIndex] ?? 1;
}

function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function getYouTubeErrorMessage(errorCode: number): string {
  switch (errorCode) {
    case 2:
      return "This YouTube link looks invalid. Please recheck the video URL or ID.";
    case 5:
      return "This YouTube video could not be played in the embedded player.";
    case 100:
      return "This YouTube video is unavailable or has been removed.";
    case 101:
    case 150:
      return "This YouTube video is blocked from embedded playback by YouTube. Open it on YouTube instead.";
    default:
      return `YouTube playback error (${errorCode})`;
  }
}

function getVimeoErrorMessage(error: unknown): string {
  const vimeoError = error as Partial<VimeoErrorEvent> | undefined;

  if (vimeoError?.name === "PrivacyError") {
    return "This Vimeo video is private or not allowed to play on this domain.";
  }

  if (vimeoError?.name === "PasswordError") {
    return "This Vimeo video requires a password and cannot be embedded directly.";
  }

  if (vimeoError?.name === "NotFoundError") {
    return "This Vimeo video could not be found.";
  }

  if (typeof vimeoError?.message === "string" && vimeoError.message.trim()) {
    return vimeoError.message;
  }

  return "Unable to initialize the Vimeo player";
}

function TamperUnavailableState({ title }: { title: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <div className="mx-4 flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-950/30 px-6 py-8 text-center shadow-2xl backdrop-blur">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertCircle className="h-7 w-7 text-red-300" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-red-100/85">
            偵測到浮水印保護被破壞，這支影片已在本次頁面中下架。
          </p>
          <p className="mt-2 text-xs text-red-100/60">
            請重新整理
          </p>
        </div>
      </div>
    </div>
  );
}

function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API is only available in the browser"));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__youtubeIframeApiPromise) {
    return window.__youtubeIframeApiPromise;
  }

  window.__youtubeIframeApiPromise = new Promise<YouTubeNamespace>(
    (resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://www.youtube.com/iframe_api"]'
      );

      const cleanupError = () => {
        reject(new Error("Failed to load YouTube IFrame API"));
      };

      window.onYouTubeIframeAPIReady = () => {
        if (window.YT?.Player) {
          resolve(window.YT);
          return;
        }

        reject(new Error("YouTube API loaded without Player interface"));
      };

      if (existingScript) {
        existingScript.addEventListener("error", cleanupError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = cleanupError;
      document.head.appendChild(script);
    }
  );

  return window.__youtubeIframeApiPromise;
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
    },
    ref
  ) {
    const [streamData, setStreamData] = useState<{
      signedUrl: string;
      customerCode: string;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [streamCurrentTime, setStreamCurrentTime] = useState(0);
    const [streamDuration, setStreamDuration] = useState(videoDuration ?? 0);
    const [streamSeekValue, setStreamSeekValue] = useState(0);
    const [streamIsSeeking, setStreamIsSeeking] = useState(false);
    const [streamIsPlaying, setStreamIsPlaying] = useState(false);
    const [streamVolume, setStreamVolume] = useState(1);
    const [streamMuted, setStreamMuted] = useState(false);
    const [youtubeReady, setYoutubeReady] = useState(false);
    const [youtubeHasStarted, setYoutubeHasStarted] = useState(false);
    const [youtubeIsPlaying, setYoutubeIsPlaying] = useState(false);
    const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
    const [youtubeDuration, setYoutubeDuration] = useState(videoDuration ?? 0);
    const [youtubeSeekValue, setYoutubeSeekValue] = useState(0);
    const [youtubeIsSeeking, setYoutubeIsSeeking] = useState(false);
    const [youtubeVolume, setYoutubeVolume] = useState(100);
    const [youtubeMuted, setYoutubeMuted] = useState(false);
    const [youtubePlaybackRate, setYoutubePlaybackRate] = useState(1);
    const [youtubePlaybackRates, setYoutubePlaybackRates] = useState<number[]>(
      YOUTUBE_DEFAULT_RATES
    );
    const [vimeoReady, setVimeoReady] = useState(false);
    const [vimeoHasStarted, setVimeoHasStarted] = useState(false);
    const [vimeoIsPlaying, setVimeoIsPlaying] = useState(false);
    const [vimeoCurrentTime, setVimeoCurrentTime] = useState(0);
    const [vimeoDuration, setVimeoDuration] = useState(videoDuration ?? 0);
    const [vimeoSeekValue, setVimeoSeekValue] = useState(0);
    const [vimeoIsSeeking, setVimeoIsSeeking] = useState(false);
    const [vimeoVolume, setVimeoVolume] = useState(1);
    const [vimeoMuted, setVimeoMuted] = useState(false);
    const [vimeoPlaybackRate, setVimeoPlaybackRate] = useState(1);
    const [vimeoPlaybackRates] = useState<number[]>(VIMEO_DEFAULT_RATES);
    const [isNativeFullscreen, setIsFullscreen] = useState(false);
    const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
    const isFullscreen = isNativeFullscreen || isPseudoFullscreen;
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const [tamperDetected, setTamperDetected] = useState(false);

    const streamRef = useRef<StreamPlayerApi>(undefined);
    const youtubeHostRef = useRef<HTMLDivElement | null>(null);
    const youtubePlayerRef = useRef<YouTubePlayerApi | null>(null);
    const youtubeShellRef = useRef<HTMLDivElement | null>(null);
    const vimeoIframeRef = useRef<HTMLIFrameElement | null>(null);
    const vimeoPlayerRef = useRef<VimeoPlayer | null>(null);
    const vimeoShellRef = useRef<HTMLDivElement | null>(null);
    const streamFrameRef = useRef<HTMLDivElement | null>(null);
    const playerContainerRef = useRef<HTMLDivElement | null>(null);
    const controlsHideTimerRef = useRef<number | null>(null);
    const currentTimeRef = useRef(0);
    const isPlayingRef = useRef(false);
    const hasTrackedPlayStartRef = useRef(false);
    const tamperTriggeredRef = useRef(false);

    const effectiveVideoId = videoSourceId ?? videoId;
    const youtubeEmbedUrl =
      videoProvider === "youtube" && effectiveVideoId
        ? videoUrl ?? getYouTubeEmbedUrl(effectiveVideoId)
        : null;
    const youtubeWatchUrl =
      videoProvider === "youtube" && effectiveVideoId
        ? getYouTubeWatchUrl(effectiveVideoId)
        : null;
    const youtubePosterUrl =
      videoProvider === "youtube" && effectiveVideoId
        ? getYouTubeThumbnailUrl(effectiveVideoId)
        : null;
    const vimeoSource =
      videoProvider === "vimeo" && effectiveVideoId
        ? parseVimeoVideoSource(videoUrl ?? effectiveVideoId)
        : null;
    const vimeoEmbedUrl = vimeoSource?.url ?? null;
    const vimeoWatchUrl = vimeoSource
      ? getVimeoWatchUrl(vimeoSource.id, vimeoSource.hash)
      : null;
    const resolvedVideoDuration =
      videoProvider === "youtube" && youtubeDuration > 0
        ? youtubeDuration
        : videoProvider === "vimeo" && vimeoDuration > 0
          ? vimeoDuration
        : videoDuration;

    const { updateProgress, flushProgress, markComplete } = useProgress({
      lessonId,
      enabled: trackingEnabled,
      videoDuration: resolvedVideoDuration,
      debounceMs: 5000,
      completeThreshold: 90,
      onComplete: () => {
        onComplete?.();
      },
    });

    const { reportPlaying } = useWatchTime({
      lessonId,
      enabled: trackingEnabled,
    });

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (seconds: number) => {
          if (videoProvider === "cloudflare" && streamRef.current) {
            streamRef.current.currentTime = seconds;
            return;
          }

          if (videoProvider === "youtube" && youtubePlayerRef.current) {
            youtubePlayerRef.current.seekTo(seconds, true);
            setYoutubeCurrentTime(seconds);
            setYoutubeSeekValue(seconds);
            return;
          }

          if (videoProvider === "vimeo" && vimeoPlayerRef.current) {
            void vimeoPlayerRef.current.setCurrentTime(seconds).catch(() => {});
            setVimeoCurrentTime(seconds);
            setVimeoSeekValue(seconds);
          }
        },
      }),
      [videoProvider]
    );

    const handlePlaybackStarted = useCallback(() => {
      isPlayingRef.current = true;
      if (videoProvider === "cloudflare") {
        setStreamIsPlaying(true);
      }
      if (videoProvider === "vimeo") {
        setVimeoIsPlaying(true);
      }
      reportPlaying(true);

      if (trackingEnabled && !hasTrackedPlayStartRef.current) {
        hasTrackedPlayStartRef.current = true;
        posthog.capture("video_play_started", {
          lesson_id: lessonId,
          lesson_title: title,
          video_id: effectiveVideoId,
          video_provider: videoProvider,
          video_duration: resolvedVideoDuration,
        });
      }
    }, [
      effectiveVideoId,
      lessonId,
      reportPlaying,
      resolvedVideoDuration,
      trackingEnabled,
      title,
      videoProvider,
    ]);

    const handlePlaybackPaused = useCallback(() => {
      isPlayingRef.current = false;
      if (videoProvider === "cloudflare") {
        setStreamIsPlaying(false);
      }
      if (videoProvider === "vimeo") {
        setVimeoIsPlaying(false);
      }
      reportPlaying(false);
      flushProgress();
    }, [flushProgress, reportPlaying, videoProvider]);

    const handlePlaybackEnded = useCallback(() => {
      isPlayingRef.current = false;
      if (videoProvider === "cloudflare") {
        setStreamIsPlaying(false);
      }
      if (videoProvider === "vimeo") {
        setVimeoIsPlaying(false);
      }
      reportPlaying(false);
      markComplete();

      if (trackingEnabled) {
        posthog.capture("lesson_completed", {
          lesson_id: lessonId,
          lesson_title: title,
          video_duration: resolvedVideoDuration,
          video_provider: videoProvider,
          completion_method: "video_ended",
        });
      }
    }, [
      lessonId,
      markComplete,
      reportPlaying,
      resolvedVideoDuration,
      trackingEnabled,
      title,
      videoProvider,
    ]);

    const handlePlaybackStartedEvent = useEffectEvent(() => {
      handlePlaybackStarted();
    });

    const handlePlaybackPausedEvent = useEffectEvent(() => {
      handlePlaybackPaused();
    });

    const handlePlaybackEndedEvent = useEffectEvent(() => {
      handlePlaybackEnded();
    });

    const handleWatermarkTamper = useCallback(
      (reason: string) => {
        if (tamperTriggeredRef.current) return;

        tamperTriggeredRef.current = true;
        setTamperDetected(true);
        isPlayingRef.current = false;
        reportPlaying(false);
        flushProgress();

        if (videoProvider === "cloudflare") {
          (streamRef.current as { pause?: () => void } | undefined)?.pause?.();
        }

        if (videoProvider === "youtube" && youtubePlayerRef.current) {
          youtubePlayerRef.current.pauseVideo();
          setYoutubeIsPlaying(false);
          setIsControlsVisible(true);
        }

        if (videoProvider === "vimeo" && vimeoPlayerRef.current) {
          void vimeoPlayerRef.current.pause().catch(() => {});
          setVimeoIsPlaying(false);
          setIsControlsVisible(true);
        }

        if (trackingEnabled) {
          posthog.capture("video_watermark_tamper_detected", {
            lesson_id: lessonId,
            lesson_title: title,
            video_id: effectiveVideoId,
            video_provider: videoProvider,
            tamper_reason: reason,
          });
        }
      },
      [
        effectiveVideoId,
        flushProgress,
        lessonId,
        reportPlaying,
        title,
        trackingEnabled,
        videoProvider,
      ]
    );

    const handleStreamTimeUpdate = useCallback(() => {
      if (streamRef.current?.currentTime === undefined) {
        return;
      }

      const currentTime = Math.floor(streamRef.current.currentTime);
      const duration = Math.floor(streamRef.current.duration || videoDuration || 0);
      currentTimeRef.current = currentTime;
      if (!streamIsSeeking) {
        setStreamCurrentTime(currentTime);
        setStreamSeekValue(currentTime);
      }
      if (duration > 0) {
        setStreamDuration(duration);
      }
      setStreamVolume(streamRef.current.volume ?? 1);
      setStreamMuted(streamRef.current.muted ?? false);
      if (isPlayingRef.current) {
        updateProgress(currentTime);
      }
      onTimeUpdate?.(currentTime);
    }, [onTimeUpdate, streamIsSeeking, updateProgress, videoDuration]);

    const toggleStreamPlayback = useCallback(() => {
      if (tamperDetected) return;

      const player = streamRef.current;
      if (!player) return;

      if (streamIsPlaying) {
        player.pause();
        return;
      }

      void player.play();
    }, [streamIsPlaying, tamperDetected]);

    const commitStreamSeek = useCallback((seconds: number) => {
      if (tamperDetected) return;

      const player = streamRef.current;
      if (!player) return;

      player.currentTime = seconds;
      setStreamCurrentTime(seconds);
      setStreamSeekValue(seconds);
      currentTimeRef.current = seconds;
      onTimeUpdate?.(seconds);
    }, [onTimeUpdate, tamperDetected]);

    const handleStreamSeekChange = (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      setStreamSeekValue(Number(event.target.value));
    };

    const toggleStreamMute = useCallback(() => {
      if (tamperDetected) return;

      const player = streamRef.current;
      if (!player) return;

      player.muted = !player.muted;
      setStreamMuted(player.muted);
    }, [tamperDetected]);

    const handleStreamVolumeChange = useCallback((
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      if (tamperDetected) return;

      const player = streamRef.current;
      const nextVolume = Number(event.target.value) / 100;
      setStreamVolume(nextVolume);
      setStreamMuted(nextVolume === 0);

      if (!player) return;

      player.volume = nextVolume;
      player.muted = nextVolume === 0;
    }, [tamperDetected]);

    const syncYouTubeMetrics = useCallback(() => {
      const player = youtubePlayerRef.current;
      if (!player) return;

      const nextDuration = Math.floor(player.getDuration() || 0);
      const nextCurrentTime = Math.floor(player.getCurrentTime() || 0);
      const nextVolume = Math.round(player.getVolume?.() ?? youtubeVolume);
      const nextMuted = player.isMuted?.() ?? false;
      const nextRate = player.getPlaybackRate?.() ?? 1;
      const availableRates = player.getAvailablePlaybackRates?.() ?? [];

      if (nextDuration > 0) {
        setYoutubeDuration(nextDuration);
      }

      if (!youtubeIsSeeking) {
        setYoutubeCurrentTime(nextCurrentTime);
        setYoutubeSeekValue(nextCurrentTime);
      }

      setYoutubeVolume(nextVolume);
      setYoutubeMuted(nextMuted);
      setYoutubePlaybackRate(nextRate);
      if (availableRates.length > 0) {
        setYoutubePlaybackRates(availableRates);
      }

      currentTimeRef.current = nextCurrentTime;

      if (isPlayingRef.current) {
        updateProgress(nextCurrentTime);
      }

      onTimeUpdate?.(nextCurrentTime);
    }, [
      onTimeUpdate,
      updateProgress,
      youtubeIsSeeking,
      youtubeVolume,
    ]);

    const syncYouTubeMetricsEvent = useEffectEvent(() => {
      syncYouTubeMetrics();
    });

    const syncYouTubePlayerSize = useCallback(() => {
      const player = youtubePlayerRef.current;
      const shell = youtubeShellRef.current;
      if (!player || !shell) return;

      const width = shell.clientWidth;
      const height = shell.clientHeight;
      if (width > 0 && height > 0) {
        player.setSize(width, height);
      }
    }, []);

    const syncYouTubePlayerSizeEvent = useEffectEvent(() => {
      syncYouTubePlayerSize();
    });

    const showControls = useCallback((persist = false) => {
      setIsControlsVisible(true);

      if (controlsHideTimerRef.current) {
        window.clearTimeout(controlsHideTimerRef.current);
        controlsHideTimerRef.current = null;
      }

      const shouldAutoHide =
        videoProvider === "youtube"
          ? youtubeHasStarted && youtubeIsPlaying
          : videoProvider === "vimeo"
            ? vimeoHasStarted && vimeoIsPlaying
          : videoProvider === "cloudflare"
            ? streamIsPlaying
            : false;

      if (persist || !shouldAutoHide) {
        return;
      }

      controlsHideTimerRef.current = window.setTimeout(() => {
        setIsControlsVisible(false);
      }, YOUTUBE_CONTROLS_HIDE_MS);
    }, [
      streamIsPlaying,
      videoProvider,
      vimeoHasStarted,
      vimeoIsPlaying,
      youtubeHasStarted,
      youtubeIsPlaying,
    ]);

    const showControlsEvent = useEffectEvent((persist = false) => {
      showControls(persist);
    });

    const handleFullscreenPointerMoveEvent = useEffectEvent(() => {
      showControls();
    });

    const toggleYouTubePlayback = useCallback(() => {
      if (tamperDetected) return;

      const player = youtubePlayerRef.current;
      if (!player) return;

      setYoutubeHasStarted(true);
      showControls();

      if (youtubeIsPlaying) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }, [showControls, tamperDetected, youtubeIsPlaying]);

    const toggleYouTubeMute = useCallback(() => {
      if (tamperDetected) return;

      const player = youtubePlayerRef.current;
      if (!player) return;

      showControls();

      if (player.isMuted()) {
        player.unMute();
        if (youtubeVolume === 0) {
          player.setVolume(100);
          setYoutubeVolume(100);
        }
        setYoutubeMuted(false);
      } else {
        player.mute();
        setYoutubeMuted(true);
      }
    }, [showControls, tamperDetected, youtubeVolume]);

    const handleYouTubeVolumeChange = useCallback((
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      if (tamperDetected) return;

      const player = youtubePlayerRef.current;
      const nextVolume = Number(event.target.value);
      setYoutubeVolume(nextVolume);
      showControls();

      if (!player) return;

      player.setVolume(nextVolume);
      if (nextVolume === 0) {
        player.mute();
        setYoutubeMuted(true);
      } else {
        player.unMute();
        setYoutubeMuted(false);
      }
    }, [showControls, tamperDetected]);

    const commitYouTubeSeek = useCallback((seconds: number) => {
      if (tamperDetected) return;

      const player = youtubePlayerRef.current;
      if (!player) return;

      player.seekTo(seconds, true);
      setYoutubeCurrentTime(seconds);
      setYoutubeSeekValue(seconds);
      currentTimeRef.current = seconds;
      onTimeUpdate?.(seconds);
      showControls();
    }, [onTimeUpdate, showControls, tamperDetected]);

    const handleYouTubeSeekChange = (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      setYoutubeSeekValue(Number(event.target.value));
      showControls(true);
    };

    const cycleYouTubePlaybackRate = useCallback(() => {
      if (tamperDetected) return;

      const player = youtubePlayerRef.current;
      if (!player) return;

      const nextRate = getNextPlaybackRate(
        youtubePlaybackRate,
        youtubePlaybackRates
      );
      player.setPlaybackRate(nextRate);
      setYoutubePlaybackRate(nextRate);
      showControls();
    }, [showControls, tamperDetected, youtubePlaybackRate, youtubePlaybackRates]);

    const handleVimeoTimeUpdate = useCallback((data?: VimeoEvent) => {
      const currentTime = Math.floor(data?.seconds ?? currentTimeRef.current);
      const duration = Math.floor(data?.duration || vimeoDuration || videoDuration || 0);
      currentTimeRef.current = currentTime;

      if (!vimeoIsSeeking) {
        setVimeoCurrentTime(currentTime);
        setVimeoSeekValue(currentTime);
      }

      if (duration > 0) {
        setVimeoDuration(duration);
      }

      if (isPlayingRef.current) {
        updateProgress(currentTime);
      }

      onTimeUpdate?.(currentTime);
    }, [
      onTimeUpdate,
      updateProgress,
      videoDuration,
      vimeoDuration,
      vimeoIsSeeking,
    ]);

    const syncVimeoMetrics = useCallback(async () => {
      const player = vimeoPlayerRef.current;
      if (!player) return;

      try {
        const [duration, currentTime, volume, muted, playbackRate] =
          await Promise.all([
            player.getDuration().catch(() => videoDuration ?? 0),
            player.getCurrentTime().catch(() => currentTimeRef.current),
            player.getVolume().catch(() => vimeoVolume),
            player.getMuted().catch(() => vimeoMuted),
            player.getPlaybackRate().catch(() => vimeoPlaybackRate),
          ]);

        const nextDuration = Math.floor(duration || videoDuration || 0);
        const nextCurrentTime = Math.floor(currentTime || 0);

        if (nextDuration > 0) {
          setVimeoDuration(nextDuration);
        }

        if (!vimeoIsSeeking) {
          setVimeoCurrentTime(nextCurrentTime);
          setVimeoSeekValue(nextCurrentTime);
        }

        setVimeoVolume(volume);
        setVimeoMuted(muted);
        setVimeoPlaybackRate(playbackRate);
        currentTimeRef.current = nextCurrentTime;

        if (isPlayingRef.current) {
          updateProgress(nextCurrentTime);
        }

        onTimeUpdate?.(nextCurrentTime);
      } catch {
        // Vimeo can reject individual capability calls depending on privacy/account settings.
      }
    }, [
      onTimeUpdate,
      updateProgress,
      videoDuration,
      vimeoIsSeeking,
      vimeoMuted,
      vimeoPlaybackRate,
      vimeoVolume,
    ]);

    const syncVimeoMetricsEvent = useEffectEvent(() => {
      void syncVimeoMetrics();
    });

    const handleVimeoTimeUpdateEvent = useEffectEvent((data?: VimeoEvent) => {
      handleVimeoTimeUpdate(data);
    });

    const toggleVimeoPlayback = useCallback(() => {
      if (tamperDetected) return;

      const player = vimeoPlayerRef.current;
      if (!player) return;

      setVimeoHasStarted(true);
      showControls();

      if (vimeoIsPlaying) {
        void player.pause().catch(() => {});
      } else {
        void player.play().catch((err) => {
          setError(getVimeoErrorMessage(err));
        });
      }
    }, [showControls, tamperDetected, vimeoIsPlaying]);

    const toggleVimeoMute = useCallback(() => {
      if (tamperDetected) return;

      const player = vimeoPlayerRef.current;
      if (!player) return;

      const nextMuted = !vimeoMuted;
      showControls();
      setVimeoMuted(nextMuted);
      void player.setMuted(nextMuted).catch(() => {});
    }, [showControls, tamperDetected, vimeoMuted]);

    const handleVimeoVolumeChange = useCallback((
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      if (tamperDetected) return;

      const player = vimeoPlayerRef.current;
      const nextVolume = Number(event.target.value) / 100;
      setVimeoVolume(nextVolume);
      setVimeoMuted(nextVolume === 0);
      showControls();

      if (!player) return;

      void Promise.all([
        player.setVolume(nextVolume),
        player.setMuted(nextVolume === 0),
      ]).catch(() => {});
    }, [showControls, tamperDetected]);

    const commitVimeoSeek = useCallback((seconds: number) => {
      if (tamperDetected) return;

      const player = vimeoPlayerRef.current;
      if (!player) return;

      void player.setCurrentTime(seconds).catch(() => {});
      setVimeoCurrentTime(seconds);
      setVimeoSeekValue(seconds);
      currentTimeRef.current = seconds;
      onTimeUpdate?.(seconds);
      showControls();
    }, [onTimeUpdate, showControls, tamperDetected]);

    const handleVimeoSeekChange = (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      setVimeoSeekValue(Number(event.target.value));
      showControls(true);
    };

    const cycleVimeoPlaybackRate = useCallback(() => {
      if (tamperDetected) return;

      const player = vimeoPlayerRef.current;
      if (!player) return;

      const nextRate = getNextPlaybackRate(vimeoPlaybackRate, vimeoPlaybackRates);
      showControls();
      void player
        .setPlaybackRate(nextRate)
        .then((rate) => {
          setVimeoPlaybackRate(rate);
        })
        .catch(() => {
          setVimeoPlaybackRate(1);
        });
    }, [
      showControls,
      tamperDetected,
      vimeoPlaybackRate,
      vimeoPlaybackRates,
    ]);

    // 模擬全螢幕：不呼叫原生 requestFullscreen，改用 position:fixed 覆蓋視窗
    // 原因：原生全螢幕會把 <video>/iframe 元素提升到獨立 layer，
    // 導致兄弟節點的浮水印 overlay 消失。模擬全螢幕則保留同一個 DOM 結構，
    // 浮水印會自然跟著容器縮放，確保防盜錄機制有效。
    const toggleFullscreen = useCallback(() => {
      if (tamperDetected) return;
      setIsPseudoFullscreen((prev) => !prev);
      showControls();
    }, [showControls, tamperDetected]);

    // 攔截原生 fullscreenchange：部分播放器（如 Cloudflare Stream 內建 UI）
    // 會自行觸發原生全螢幕，這邊偵測到後立即退出並切到模擬全螢幕模式。
    useEffect(() => {
      const handleFullscreenChange = () => {
        const isNative = !!document.fullscreenElement;
        setIsFullscreen(isNative);
        if (isNative) {
          // 立即退出原生全螢幕，改為模擬全螢幕
          document.exitFullscreen().catch(() => {});
          setIsPseudoFullscreen(true);
        }
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      };
    }, []);

    // 模擬全螢幕時：鎖定 body 捲動、ESC 鍵退出
    useEffect(() => {
      if (!isPseudoFullscreen) return;

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.body.classList.add("video-pseudo-fullscreen-active");

      const handleKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsPseudoFullscreen(false);
        }
      };
      document.addEventListener("keydown", handleKey);

      return () => {
        document.body.style.overflow = previousOverflow;
        document.body.classList.remove("video-pseudo-fullscreen-active");
        document.removeEventListener("keydown", handleKey);
      };
    }, [isPseudoFullscreen]);

    useEffect(() => {
      return () => {
        if (controlsHideTimerRef.current) {
          window.clearTimeout(controlsHideTimerRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (videoProvider === "youtube") {
        showControls(!youtubeHasStarted || !youtubeIsPlaying);
        return;
      }

      if (videoProvider === "vimeo") {
        showControls(!vimeoHasStarted || !vimeoIsPlaying);
        return;
      }

      if (videoProvider === "cloudflare") {
        showControls(!streamIsPlaying);
      }
    }, [
      showControls,
      streamIsPlaying,
      videoProvider,
      vimeoHasStarted,
      vimeoIsPlaying,
      youtubeHasStarted,
      youtubeIsPlaying,
    ]);

    useEffect(() => {
      if (
        (videoProvider === "youtube" &&
          (!youtubeHasStarted || !youtubeIsPlaying)) ||
        (videoProvider === "vimeo" &&
          (!vimeoHasStarted || !vimeoIsPlaying)) ||
        (videoProvider === "cloudflare" && !streamIsPlaying) ||
        (videoProvider !== "youtube" &&
          videoProvider !== "vimeo" &&
          videoProvider !== "cloudflare")
      ) {
        return;
      }

      const shell =
        videoProvider === "youtube"
          ? youtubeShellRef.current
          : videoProvider === "vimeo"
            ? vimeoShellRef.current
            : playerContainerRef.current;
      const handlePointerMove = () => {
        handleFullscreenPointerMoveEvent();
      };

      shell?.addEventListener("mousemove", handlePointerMove, true);
      shell?.addEventListener("pointermove", handlePointerMove, true);
      document.addEventListener("mousemove", handlePointerMove, true);
      document.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("mousemove", handlePointerMove, true);
      window.addEventListener("pointermove", handlePointerMove, true);

      return () => {
        shell?.removeEventListener("mousemove", handlePointerMove, true);
        shell?.removeEventListener("pointermove", handlePointerMove, true);
        document.removeEventListener("mousemove", handlePointerMove, true);
        document.removeEventListener("pointermove", handlePointerMove, true);
        window.removeEventListener("mousemove", handlePointerMove, true);
        window.removeEventListener("pointermove", handlePointerMove, true);
      };
    }, [
      streamIsPlaying,
      videoProvider,
      vimeoHasStarted,
      vimeoIsPlaying,
      youtubeHasStarted,
      youtubeIsPlaying,
    ]);

    useEffect(() => {
      if (videoProvider !== "youtube" || !youtubeReady) {
        return;
      }

      syncYouTubePlayerSize();

      const shell = youtubeShellRef.current;
      if (!shell || typeof ResizeObserver === "undefined") {
        return;
      }

      const observer = new ResizeObserver(() => {
        syncYouTubePlayerSize();
      });

      observer.observe(shell);

      return () => {
        observer.disconnect();
      };
    }, [syncYouTubePlayerSize, videoProvider, youtubeReady]);

    useEffect(() => {
      return () => {
        flushProgress();
      };
    }, [flushProgress]);

    useEffect(() => {
      isPlayingRef.current = false;
      currentTimeRef.current = 0;
      hasTrackedPlayStartRef.current = false;
      tamperTriggeredRef.current = false;
      setTamperDetected(false);
      setYoutubeHasStarted(false);
      setYoutubeIsPlaying(false);
      setYoutubeCurrentTime(0);
      setYoutubeSeekValue(0);
      setYoutubeDuration(videoDuration ?? 0);
      setVimeoHasStarted(false);
      setVimeoIsPlaying(false);
      setVimeoCurrentTime(0);
      setVimeoSeekValue(0);
      setVimeoDuration(videoDuration ?? 0);
      setStreamCurrentTime(0);
      setStreamSeekValue(0);
      setStreamDuration(videoDuration ?? 0);
      setStreamIsPlaying(false);
    }, [lessonId, videoDuration]);

    useEffect(() => {
      setStreamData(null);
      setError(null);

      if ((videoProvider !== "cloudflare" && videoProvider !== "bunny") || !effectiveVideoId) {
        return;
      }

      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let isCancelled = false;

      const fetchSignedUrl = async () => {
        if (isCancelled) return;
        setIsLoading(true);
        setError(null);

        try {
          const response = await fetch("/api/lesson/stream-url", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lessonId,
              videoId: effectiveVideoId,
            }),
          });

          const data: StreamTokenResponse = await response.json();

          if (!data.success) {
            if (response.status === 409 && data.videoProcessing) {
              const retryAfterMs = Math.max(3, data.retryAfterSec ?? 5) * 1000;
              retryTimer = setTimeout(fetchSignedUrl, retryAfterMs);
              return;
            }

            const errorMessage = data.error || "Failed to load video stream";
            setError(errorMessage);
            if (trackingEnabled) {
              posthog.capture("video_playback_error", {
                lesson_id: lessonId,
                lesson_title: title,
                video_id: effectiveVideoId,
                video_provider: videoProvider,
                error_message: errorMessage,
                error_type: "stream_url_fetch_failed",
              });
            }
            return;
          }

          if (data.signedUrl && (data.customerCode || videoProvider === "bunny")) {
            setStreamData({
              signedUrl: data.signedUrl,
              customerCode: data.customerCode || "",
            });
          }
        } catch (err) {
          console.error("Failed to fetch signed stream URL:", err);
          const errorMessage = "Unable to load the protected stream";
          setError(errorMessage);
          if (trackingEnabled) {
            posthog.capture("video_playback_error", {
              lesson_id: lessonId,
              lesson_title: title,
              video_id: effectiveVideoId,
              video_provider: videoProvider,
              error_message: errorMessage,
              error_type: "network_error",
            });
            posthog.captureException(err);
          }
        } finally {
          if (!isCancelled) setIsLoading(false);
        }
      };

      fetchSignedUrl();

      return () => {
        isCancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
      };
    }, [effectiveVideoId, lessonId, title, trackingEnabled, videoProvider]);

    useEffect(() => {
      if (videoProvider !== "youtube" || !effectiveVideoId) {
        return;
      }

      let isMounted = true;
      setError(null);
      setIsLoading(true);
      setYoutubeReady(false);

      const mountYoutubePlayer = async () => {
        try {
          const YT = await loadYouTubeIframeApi();

          if (!isMounted || !youtubeHostRef.current) {
            return;
          }

          youtubePlayerRef.current?.destroy();
          youtubeHostRef.current.innerHTML = "";

          youtubePlayerRef.current = new YT.Player(youtubeHostRef.current, {
            videoId: effectiveVideoId,
            host: "https://www.youtube-nocookie.com",
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              rel: 0,
              playsinline: 1,
              modestbranding: 1,
              iv_load_policy: 3,
              cc_load_policy: 0,
              origin: window.location.origin,
            },
            events: {
              onReady: (event) => {
                if (!isMounted) return;

                const duration = Math.floor(event.target.getDuration() || 0);
                const volume = Math.round(event.target.getVolume?.() ?? 100);
                const availableRates =
                  event.target.getAvailablePlaybackRates?.() ??
                  YOUTUBE_DEFAULT_RATES;

                setYoutubeReady(true);
                setYoutubeDuration(duration || videoDuration || 0);
                setYoutubeVolume(volume);
                setYoutubeMuted(event.target.isMuted?.() ?? false);
                setYoutubePlaybackRate(
                  event.target.getPlaybackRate?.() ?? 1
                );
                setYoutubePlaybackRates(
                  availableRates.length > 0
                    ? availableRates
                    : YOUTUBE_DEFAULT_RATES
                );
                syncYouTubePlayerSizeEvent();
                setIsLoading(false);
              },
              onStateChange: (event) => {
                if (!isMounted) return;

                if (event.data === YT.PlayerState.PLAYING) {
                  if (tamperTriggeredRef.current) {
                    event.target.pauseVideo();
                    setYoutubeIsPlaying(false);
                    showControlsEvent(true);
                    return;
                  }

                  setYoutubeHasStarted(true);
                  setYoutubeIsPlaying(true);
                  handlePlaybackStartedEvent();
                  syncYouTubeMetricsEvent();
                  showControlsEvent();
                  return;
                }

                if (event.data === YT.PlayerState.PAUSED) {
                  setYoutubeIsPlaying(false);
                  handlePlaybackPausedEvent();
                  syncYouTubeMetricsEvent();
                  showControlsEvent(true);
                  return;
                }

                if (event.data === YT.PlayerState.ENDED) {
                  const finalDuration = Math.floor(
                    event.target.getDuration() || videoDuration || 0
                  );
                  setYoutubeIsPlaying(false);
                  setYoutubeCurrentTime(finalDuration);
                  setYoutubeSeekValue(finalDuration);
                  handlePlaybackEndedEvent();
                  showControlsEvent(true);
                }
              },
              onError: (event) => {
                if (!isMounted) return;

                setIsLoading(false);
                setError(getYouTubeErrorMessage(event.data));
                if (trackingEnabled) {
                  posthog.capture("video_playback_error", {
                    lesson_id: lessonId,
                    lesson_title: title,
                    video_id: effectiveVideoId,
                    video_provider: videoProvider,
                    error_message: `youtube_error_${event.data}`,
                    error_type: "youtube_iframe_error",
                  });
                }
              },
            },
          });
        } catch (err) {
          console.error("Failed to initialize YouTube player:", err);
          setIsLoading(false);
          setError("Unable to initialize the YouTube player");
        }
      };

      mountYoutubePlayer();

      return () => {
        isMounted = false;
        setYoutubeReady(false);
        setYoutubeIsPlaying(false);
        youtubePlayerRef.current?.destroy();
        youtubePlayerRef.current = null;
      };
    }, [
      effectiveVideoId,
      lessonId,
      title,
      trackingEnabled,
      videoDuration,
      videoProvider,
    ]);

    useEffect(() => {
      if (videoProvider !== "youtube" || !youtubeReady) {
        return;
      }

      const interval = window.setInterval(() => {
        syncYouTubeMetricsEvent();
      }, YOUTUBE_POLL_MS);

      return () => {
        window.clearInterval(interval);
      };
    }, [videoProvider, youtubeReady, youtubeIsSeeking]);

    useEffect(() => {
      if (videoProvider !== "youtube") {
        return;
      }

      const shell = youtubeShellRef.current;
      if (!shell) {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }

        const player = youtubePlayerRef.current;
        if (!player) return;

        if (
          [
            " ",
            "k",
            "K",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "j",
            "J",
            "l",
            "L",
            "m",
            "M",
            "f",
            "F",
          ].includes(event.key)
        ) {
          event.preventDefault();
          showControls();
        }

        switch (event.key) {
          case " ":
          case "k":
          case "K":
            toggleYouTubePlayback();
            break;
          case "ArrowLeft":
            commitYouTubeSeek(Math.max(0, currentTimeRef.current - 5));
            break;
          case "ArrowRight":
            commitYouTubeSeek(
              clamp(
                currentTimeRef.current + 5,
                0,
                Math.max(1, youtubeDuration || videoDuration || 1)
              )
            );
            break;
          case "j":
          case "J":
            commitYouTubeSeek(Math.max(0, currentTimeRef.current - 10));
            break;
          case "l":
          case "L":
            commitYouTubeSeek(
              clamp(
                currentTimeRef.current + 10,
                0,
                Math.max(1, youtubeDuration || videoDuration || 1)
              )
            );
            break;
          case "ArrowUp":
            handleYouTubeVolumeChange({
              target: {
                value: String(clamp((youtubeMuted ? 0 : youtubeVolume) + 5, 0, 100)),
              },
            } as React.ChangeEvent<HTMLInputElement>);
            break;
          case "ArrowDown":
            handleYouTubeVolumeChange({
              target: {
                value: String(clamp((youtubeMuted ? 0 : youtubeVolume) - 5, 0, 100)),
              },
            } as React.ChangeEvent<HTMLInputElement>);
            break;
          case "m":
          case "M":
            toggleYouTubeMute();
            break;
          case "f":
          case "F":
            void toggleFullscreen();
            break;
          default:
            break;
        }
      };

      shell.addEventListener("keydown", handleKeyDown);
      return () => {
        shell.removeEventListener("keydown", handleKeyDown);
      };
    }, [
      commitYouTubeSeek,
      handleYouTubeVolumeChange,
      showControls,
      toggleFullscreen,
      toggleYouTubeMute,
      toggleYouTubePlayback,
      videoDuration,
      videoProvider,
      youtubeDuration,
      youtubeMuted,
      youtubeVolume,
    ]);

    useEffect(() => {
      if (videoProvider !== "vimeo" || !vimeoEmbedUrl) {
        return;
      }

      const iframe = vimeoIframeRef.current;
      if (!iframe) {
        return;
      }

      let isMounted = true;
      setError(null);
      setIsLoading(true);
      setVimeoReady(false);

      const initializeVimeoPlayer = async () => {
        try {
          const { default: VimeoPlayerClass } = await import("@vimeo/player");
          if (!isMounted) return;

          const player = new VimeoPlayerClass(iframe);
          vimeoPlayerRef.current = player;

          const handlePlay = (data: VimeoEvent) => {
            if (!isMounted) return;

            if (tamperTriggeredRef.current) {
              void player.pause().catch(() => {});
              setVimeoIsPlaying(false);
              showControlsEvent(true);
              return;
            }

            setVimeoHasStarted(true);
            setVimeoIsPlaying(true);
            handlePlaybackStartedEvent();
            handleVimeoTimeUpdateEvent(data);
            showControlsEvent();
          };

          const handlePause = (data: VimeoEvent) => {
            if (!isMounted) return;
            setVimeoIsPlaying(false);
            handlePlaybackPausedEvent();
            handleVimeoTimeUpdateEvent(data);
            showControlsEvent(true);
          };

          const handleEnded = (data: VimeoEvent) => {
            if (!isMounted) return;
            const finalDuration = Math.floor(data.duration || videoDuration || 0);
            setVimeoIsPlaying(false);
            setVimeoCurrentTime(finalDuration);
            setVimeoSeekValue(finalDuration);
            handlePlaybackEndedEvent();
            showControlsEvent(true);
          };

          const handleTimeUpdate = (data: VimeoEvent) => {
            if (!isMounted) return;
            handleVimeoTimeUpdateEvent(data);
          };

          const handleDurationChange = (data: DurationChangeEvent) => {
            if (!isMounted) return;
            if (data.duration > 0) {
              setVimeoDuration(Math.floor(data.duration));
            }
          };

          const handleVolumeChange = (data: VolumeChangeEvent) => {
            if (!isMounted) return;
            setVimeoVolume(data.volume);
            setVimeoMuted(data.muted);
          };

          const handlePlaybackRateChange = (data: PlaybackRateChangeEvent) => {
            if (!isMounted) return;
            setVimeoPlaybackRate(data.playbackRate);
          };

          const handleError = (data: VimeoErrorEvent) => {
            if (!isMounted) return;
            const errorMessage = getVimeoErrorMessage(data);
            setError(errorMessage);
            setIsLoading(false);
            if (trackingEnabled) {
              posthog.capture("video_playback_error", {
                lesson_id: lessonId,
                lesson_title: title,
                video_id: effectiveVideoId,
                video_provider: videoProvider,
                error_message: errorMessage,
                error_type: "vimeo_player_error",
              });
            }
          };

          player.on("play", handlePlay);
          player.on("pause", handlePause);
          player.on("ended", handleEnded);
          player.on("timeupdate", handleTimeUpdate);
          player.on("durationchange", handleDurationChange);
          player.on("volumechange", handleVolumeChange);
          player.on("playbackratechange", handlePlaybackRateChange);
          player.on("error", handleError);

          await player.ready();
          if (!isMounted) return;

          setVimeoReady(true);
          setIsLoading(false);
          syncVimeoMetricsEvent();
        } catch (err) {
          if (!isMounted) return;
          console.error("Failed to initialize Vimeo player:", err);
          const errorMessage = getVimeoErrorMessage(err);
          setIsLoading(false);
          setError(errorMessage);
          if (trackingEnabled) {
            posthog.capture("video_playback_error", {
              lesson_id: lessonId,
              lesson_title: title,
              video_id: effectiveVideoId,
              video_provider: videoProvider,
              error_message: errorMessage,
              error_type: "vimeo_initialization_error",
            });
            posthog.captureException(err);
          }
        }
      };

      initializeVimeoPlayer();

      return () => {
        isMounted = false;
        setVimeoReady(false);
        setVimeoIsPlaying(false);
        const player = vimeoPlayerRef.current;
        vimeoPlayerRef.current = null;
        void player?.destroy().catch(() => {});
      };
    }, [
      effectiveVideoId,
      lessonId,
      title,
      trackingEnabled,
      videoDuration,
      videoProvider,
      vimeoEmbedUrl,
    ]);

    useEffect(() => {
      if (videoProvider !== "vimeo") {
        return;
      }

      const shell = vimeoShellRef.current;
      if (!shell) {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }

        const player = vimeoPlayerRef.current;
        if (!player) return;

        if (
          [
            " ",
            "k",
            "K",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "j",
            "J",
            "l",
            "L",
            "m",
            "M",
            "f",
            "F",
          ].includes(event.key)
        ) {
          event.preventDefault();
          showControls();
        }

        switch (event.key) {
          case " ":
          case "k":
          case "K":
            toggleVimeoPlayback();
            break;
          case "ArrowLeft":
            commitVimeoSeek(Math.max(0, currentTimeRef.current - 5));
            break;
          case "ArrowRight":
            commitVimeoSeek(
              clamp(
                currentTimeRef.current + 5,
                0,
                Math.max(1, vimeoDuration || videoDuration || 1)
              )
            );
            break;
          case "j":
          case "J":
            commitVimeoSeek(Math.max(0, currentTimeRef.current - 10));
            break;
          case "l":
          case "L":
            commitVimeoSeek(
              clamp(
                currentTimeRef.current + 10,
                0,
                Math.max(1, vimeoDuration || videoDuration || 1)
              )
            );
            break;
          case "ArrowUp":
            handleVimeoVolumeChange({
              target: {
                value: String(clamp((vimeoMuted ? 0 : vimeoVolume * 100) + 5, 0, 100)),
              },
            } as React.ChangeEvent<HTMLInputElement>);
            break;
          case "ArrowDown":
            handleVimeoVolumeChange({
              target: {
                value: String(clamp((vimeoMuted ? 0 : vimeoVolume * 100) - 5, 0, 100)),
              },
            } as React.ChangeEvent<HTMLInputElement>);
            break;
          case "m":
          case "M":
            toggleVimeoMute();
            break;
          case "f":
          case "F":
            void toggleFullscreen();
            break;
          default:
            break;
        }
      };

      shell.addEventListener("keydown", handleKeyDown);
      return () => {
        shell.removeEventListener("keydown", handleKeyDown);
      };
    }, [
      commitVimeoSeek,
      handleVimeoVolumeChange,
      showControls,
      toggleFullscreen,
      toggleVimeoMute,
      toggleVimeoPlayback,
      videoDuration,
      videoProvider,
      vimeoDuration,
      vimeoMuted,
      vimeoVolume,
    ]);

    if (!effectiveVideoId || !videoProvider) {
      return (
        <div className="relative flex h-full w-full items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-divider bg-white shadow-sm">
              <Play className="h-8 w-8 text-caption" />
            </div>
            <div className="max-w-md px-4">
              <h3 className="text-lg font-bold text-heading">{title}</h3>
              <p className="mt-2 text-sm text-caption">
                No video source is connected to this lesson yet.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (tamperDetected) {
      return <TamperUnavailableState title={title} />;
    }

    if (videoProvider === "youtube" && youtubeEmbedUrl) {
      const progressMax = Math.max(1, youtubeDuration || videoDuration || 1);
      const displayedSeekValue = youtubeIsSeeking
        ? youtubeSeekValue
        : youtubeCurrentTime;
      const youtubeControlsOverlayClass = cn(
        "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/92 via-35% to-transparent transition-all duration-200",
        compactMode ? "px-3 pb-2 pt-7" : "px-4 pb-4 pt-16",
        isControlsVisible || !youtubeHasStarted || !youtubeIsPlaying
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-3 opacity-0 pointer-events-none"
      );
      const youtubeControlsGlowClass = compactMode
        ? "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-black/90 blur-xl"
        : "pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-black/95 blur-2xl";

      return (
        <div
          ref={playerContainerRef}
          className={
            isPseudoFullscreen
              ? "fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black"
              : "relative mx-auto aspect-video w-full overflow-hidden bg-black"
          }
          style={
            isPseudoFullscreen
              ? undefined
              : {
                  width: PLAYER_VIEWPORT_WIDTH,
                }
          }
        >
          <div
            ref={youtubeShellRef}
            className={
              isPseudoFullscreen
                ? "group relative aspect-video max-h-[100dvh] w-full max-w-[calc(100dvh*16/9)] overflow-hidden bg-black"
                : "group absolute inset-0 overflow-hidden bg-black"
            }
            tabIndex={0}
            onMouseMove={() => {
              if (!tamperDetected) showControls();
            }}
            onMouseLeave={() => {
              if (!tamperDetected) showControls();
            }}
            onClick={(event) => {
              if (
                !tamperDetected &&
                event.target === event.currentTarget &&
                youtubeHasStarted
              ) {
                toggleYouTubePlayback();
              }
            }}
            onDoubleClick={(event) => {
              if (!tamperDetected && event.target === event.currentTarget) {
                void toggleFullscreen();
              }
            }}
          >
            <div
              ref={youtubeHostRef}
              className="absolute inset-0 [&>*]:!h-full [&>*]:!w-full [&>div]:!h-full [&>div]:!w-full [&>iframe]:!h-full [&>iframe]:!w-full [&>iframe]:pointer-events-none"
            />

            {!youtubeHasStarted && youtubePosterUrl && (
              <button
                type="button"
                onClick={(event) => {
                  stopEventPropagation(event);
                  toggleYouTubePlayback();
                }}
                disabled={!youtubeReady || tamperDetected}
                className="absolute inset-0 z-20 flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black"
                style={{
                  backgroundImage: `linear-gradient(to top, rgba(0,0,0,.7), rgba(0,0,0,.15)), url(${youtubePosterUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/92 text-black shadow-2xl transition-transform group-hover:scale-105">
                  {isLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Play className="ml-1 h-8 w-8 fill-current" />
                  )}
                </div>
              </button>
            )}

            {youtubeHasStarted && !youtubeIsPlaying && (
              <button
                type="button"
                onClick={(event) => {
                  stopEventPropagation(event);
                  toggleYouTubePlayback();
                }}
                disabled={tamperDetected}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/10"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-xl">
                  <Play className="ml-1 h-6 w-6 fill-current" />
                </div>
              </button>
            )}

            <div className={youtubeControlsOverlayClass}>
              <div className={youtubeControlsGlowClass} />
              <div className={cn("relative", compactMode ? "space-y-2" : "space-y-3")}>
                <input
                  type="range"
                  min={0}
                  max={progressMax}
                  step={1}
                  value={displayedSeekValue}
                  onPointerDown={() => {
                    setYoutubeIsSeeking(true);
                    showControls(true);
                  }}
                  onClick={stopEventPropagation}
                  onPointerUp={(event) => {
                    const nextValue = Number(
                      (event.target as HTMLInputElement).value || 0
                    );
                    commitYouTubeSeek(nextValue);
                    setYoutubeIsSeeking(false);
                    showControls();
                  }}
                  onChange={handleYouTubeSeekChange}
                  className={cn(
                    "w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white",
                    compactMode ? "h-1" : "h-1.5"
                  )}
                  aria-label="Video progress"
                />

                <div
                  className={cn(
                    "relative flex items-center text-white",
                    compactMode ? "gap-2" : "flex-wrap gap-3"
                  )}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      stopEventPropagation(event);
                      toggleYouTubePlayback();
                    }}
                    disabled={tamperDetected}
                    className={cn(
                      "flex items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-[1.03]",
                      compactMode ? "h-9 w-9 shrink-0" : "h-11 w-11"
                    )}
                    aria-label={youtubeIsPlaying ? "Pause video" : "Play video"}
                  >
                    {youtubeIsPlaying ? (
                      <Pause className={cn("fill-current", compactMode ? "h-4 w-4" : "h-5 w-5")} />
                    ) : (
                      <Play className={cn("ml-0.5 fill-current", compactMode ? "h-4 w-4" : "h-5 w-5")} />
                    )}
                  </button>

                  <div
                    className={cn(
                      "font-medium tabular-nums text-white/90",
                      compactMode ? "min-w-0 flex-1 truncate text-xs" : "min-w-[88px] text-sm"
                    )}
                  >
                    {formatTime(displayedSeekValue)} / {formatTime(progressMax)}
                  </div>

                  <div
                    className={cn(
                      "ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/70 backdrop-blur",
                      compactMode ? "px-2 py-2" : "px-3 py-2"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        stopEventPropagation(event);
                        toggleYouTubeMute();
                      }}
                      className="text-white/90 transition hover:text-white"
                      aria-label={youtubeMuted ? "Unmute video" : "Mute video"}
                    >
                      {youtubeMuted || youtubeVolume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    {!compactMode && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={youtubeMuted ? 0 : youtubeVolume}
                        onClick={stopEventPropagation}
                        onChange={(event) => {
                          stopEventPropagation(event);
                          handleYouTubeVolumeChange(event);
                        }}
                        className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
                        aria-label="Volume"
                      />
                    )}
                  </div>

                  {!compactMode && (
                    <button
                      type="button"
                      onClick={(event) => {
                        stopEventPropagation(event);
                        cycleYouTubePlaybackRate();
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/12 hover:text-white"
                      aria-label="Change playback speed"
                    >
                      <Gauge className="h-4 w-4" />
                      {youtubePlaybackRate.toFixed(
                        Number.isInteger(youtubePlaybackRate) ? 0 : 2
                      )}
                      x
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(event) => {
                      stopEventPropagation(event);
                      void toggleFullscreen();
                    }}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/90 backdrop-blur transition hover:bg-white/12 hover:text-white",
                      compactMode ? "h-9 w-9 shrink-0" : "h-10 w-10"
                    )}
                    aria-label={
                      isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                    }
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-6 text-center">
                <div className="flex max-w-md flex-col items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                    <AlertCircle className="h-7 w-7 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm text-white/70">{error}</p>
                  </div>
                  {youtubeWatchUrl && (
                    <a
                      href={youtubeWatchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                    >
                      Open on YouTube
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <VideoWatermarkOverlay
            watermark={watermark}
            containerRef={playerContainerRef}
            videoFrameRef={youtubeShellRef}
            onTamper={handleWatermarkTamper}
          />

        </div>
      );
    }

    if (videoProvider === "vimeo" && vimeoEmbedUrl) {
      const progressMax = Math.max(1, vimeoDuration || videoDuration || 1);
      const displayedSeekValue = vimeoIsSeeking
        ? vimeoSeekValue
        : vimeoCurrentTime;
      const vimeoControlsOverlayClass = cn(
        "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/92 via-35% to-transparent transition-all duration-200",
        compactMode ? "px-3 pb-2 pt-7" : "px-4 pb-4 pt-16",
        isControlsVisible || !vimeoHasStarted || !vimeoIsPlaying
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-3 opacity-0 pointer-events-none"
      );
      const vimeoControlsGlowClass = compactMode
        ? "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-black/90 blur-xl"
        : "pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-black/95 blur-2xl";

      return (
        <div
          ref={playerContainerRef}
          className={
            isPseudoFullscreen
              ? "fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black"
              : "relative mx-auto aspect-video w-full overflow-hidden bg-black"
          }
          style={
            isPseudoFullscreen
              ? undefined
              : {
                  width: PLAYER_VIEWPORT_WIDTH,
                }
          }
        >
          <div
            ref={vimeoShellRef}
            className={
              isPseudoFullscreen
                ? "group relative aspect-video max-h-[100dvh] w-full max-w-[calc(100dvh*16/9)] overflow-hidden bg-black"
                : "group absolute inset-0 overflow-hidden bg-black"
            }
            tabIndex={0}
            onMouseMove={() => {
              if (!tamperDetected) showControls();
            }}
            onMouseLeave={() => {
              if (!tamperDetected) showControls();
            }}
            onClick={(event) => {
              if (
                !tamperDetected &&
                event.target === event.currentTarget &&
                vimeoHasStarted
              ) {
                toggleVimeoPlayback();
              }
            }}
            onDoubleClick={(event) => {
              if (!tamperDetected && event.target === event.currentTarget) {
                void toggleFullscreen();
              }
            }}
          >
            <iframe
              ref={vimeoIframeRef}
              src={vimeoEmbedUrl}
              title={title}
              className="absolute inset-0 h-full w-full pointer-events-none"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />

            {!vimeoHasStarted && (
              <button
                type="button"
                onClick={(event) => {
                  stopEventPropagation(event);
                  toggleVimeoPlayback();
                }}
                disabled={!vimeoReady || tamperDetected}
                className="absolute inset-0 z-20 flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black/40"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/92 text-black shadow-2xl transition-transform group-hover:scale-105">
                  {isLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Play className="ml-1 h-8 w-8 fill-current" />
                  )}
                </div>
              </button>
            )}

            {vimeoHasStarted && !vimeoIsPlaying && (
              <button
                type="button"
                onClick={(event) => {
                  stopEventPropagation(event);
                  toggleVimeoPlayback();
                }}
                disabled={tamperDetected}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/10"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-xl">
                  <Play className="ml-1 h-6 w-6 fill-current" />
                </div>
              </button>
            )}

            <div className={vimeoControlsOverlayClass}>
              <div className={vimeoControlsGlowClass} />
              <div className={cn("relative", compactMode ? "space-y-2" : "space-y-3")}>
                <input
                  type="range"
                  min={0}
                  max={progressMax}
                  step={1}
                  value={displayedSeekValue}
                  onPointerDown={() => {
                    setVimeoIsSeeking(true);
                    showControls(true);
                  }}
                  onClick={stopEventPropagation}
                  onPointerUp={(event) => {
                    const nextValue = Number(
                      (event.target as HTMLInputElement).value || 0
                    );
                    commitVimeoSeek(nextValue);
                    setVimeoIsSeeking(false);
                    showControls();
                  }}
                  onChange={handleVimeoSeekChange}
                  className={cn(
                    "w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white",
                    compactMode ? "h-1" : "h-1.5"
                  )}
                  aria-label="Video progress"
                />

                <div
                  className={cn(
                    "relative flex items-center text-white",
                    compactMode ? "gap-2" : "flex-wrap gap-3"
                  )}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      stopEventPropagation(event);
                      toggleVimeoPlayback();
                    }}
                    disabled={tamperDetected}
                    className={cn(
                      "flex items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-[1.03]",
                      compactMode ? "h-9 w-9 shrink-0" : "h-11 w-11"
                    )}
                    aria-label={vimeoIsPlaying ? "Pause video" : "Play video"}
                  >
                    {vimeoIsPlaying ? (
                      <Pause className={cn("fill-current", compactMode ? "h-4 w-4" : "h-5 w-5")} />
                    ) : (
                      <Play className={cn("ml-0.5 fill-current", compactMode ? "h-4 w-4" : "h-5 w-5")} />
                    )}
                  </button>

                  <div
                    className={cn(
                      "font-medium tabular-nums text-white/90",
                      compactMode ? "min-w-0 flex-1 truncate text-xs" : "min-w-[88px] text-sm"
                    )}
                  >
                    {formatTime(displayedSeekValue)} / {formatTime(progressMax)}
                  </div>

                  <div
                    className={cn(
                      "ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/70 backdrop-blur",
                      compactMode ? "px-2 py-2" : "px-3 py-2"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        stopEventPropagation(event);
                        toggleVimeoMute();
                      }}
                      className="text-white/90 transition hover:text-white"
                      aria-label={vimeoMuted ? "Unmute video" : "Mute video"}
                    >
                      {vimeoMuted || vimeoVolume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    {!compactMode && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={vimeoMuted ? 0 : Math.round(vimeoVolume * 100)}
                        onClick={stopEventPropagation}
                        onChange={(event) => {
                          stopEventPropagation(event);
                          handleVimeoVolumeChange(event);
                        }}
                        className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
                        aria-label="Volume"
                      />
                    )}
                  </div>

                  {!compactMode && (
                    <button
                      type="button"
                      onClick={(event) => {
                        stopEventPropagation(event);
                        cycleVimeoPlaybackRate();
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/12 hover:text-white"
                      aria-label="Change playback speed"
                    >
                      <Gauge className="h-4 w-4" />
                      {vimeoPlaybackRate.toFixed(
                        Number.isInteger(vimeoPlaybackRate) ? 0 : 2
                      )}
                      x
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(event) => {
                      stopEventPropagation(event);
                      void toggleFullscreen();
                    }}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/90 backdrop-blur transition hover:bg-white/12 hover:text-white",
                      compactMode ? "h-9 w-9 shrink-0" : "h-10 w-10"
                    )}
                    aria-label={
                      isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                    }
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-6 text-center">
                <div className="flex max-w-md flex-col items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                    <AlertCircle className="h-7 w-7 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm text-white/70">{error}</p>
                  </div>
                  {vimeoWatchUrl && (
                    <a
                      href={vimeoWatchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                    >
                      Open on Vimeo
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <VideoWatermarkOverlay
            watermark={watermark}
            containerRef={playerContainerRef}
            videoFrameRef={vimeoShellRef}
            onTamper={handleWatermarkTamper}
          />
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="relative flex h-full w-full items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-cta" />
            <p className="text-sm text-body">Loading video...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="relative flex h-full w-full items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="max-w-md px-4">
              <h3 className="text-lg font-bold text-heading">{title}</h3>
              <p className="mt-2 text-sm text-red-500">{error}</p>
            </div>
            {youtubeWatchUrl && (
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full bg-heading px-4 py-2 text-sm font-medium text-white transition hover:bg-heading/90"
              >
                Open on YouTube
              </a>
            )}
          </div>
        </div>
      );
    }

    if (videoProvider === "bunny" && streamData) {
      const bunnyEmbedUrl = new URL(streamData.signedUrl);
      bunnyEmbedUrl.searchParams.set("autoplay", "false");
      return (
        <div className="relative mx-auto aspect-video w-full overflow-hidden bg-black" style={{ width: PLAYER_VIEWPORT_WIDTH }}>
          <iframe src={bunnyEmbedUrl.toString()} className="h-full w-full" allow="fullscreen; picture-in-picture" allowFullScreen title={title} />
        </div>
      );
    }

    if (!streamData) {
      return (
        <div className="relative flex h-full w-full items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-cta" />
            <p className="text-sm text-body">Preparing secure stream...</p>
          </div>
        </div>
      );
    }

    const streamProgressMax = Math.max(1, streamDuration || videoDuration || 1);
    const displayedStreamSeekValue = streamIsSeeking
      ? streamSeekValue
      : streamCurrentTime;
    const streamControlsOverlayClass = cn(
      "absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/92 via-35% to-transparent transition-all duration-200",
      compactMode ? "px-3 pb-2 pt-7" : "px-4 pb-4 pt-16",
      isControlsVisible || !streamIsPlaying
        ? "translate-y-0 opacity-100 pointer-events-auto"
        : "translate-y-3 opacity-0 pointer-events-none"
    );
    const streamControlsGlowClass = compactMode
      ? "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-black/90 blur-xl"
      : "pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-black/95 blur-2xl";

    return (
      <div
        ref={playerContainerRef}
        className={
          isPseudoFullscreen
            ? "fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black"
            : "relative mx-auto aspect-video w-full overflow-hidden bg-black"
        }
        style={
          isPseudoFullscreen
            ? undefined
            : {
                width: PLAYER_VIEWPORT_WIDTH,
              }
        }
        onMouseMove={() => {
          if (!tamperDetected) showControls();
        }}
        onPointerMove={() => {
          if (!tamperDetected) showControls();
        }}
        onMouseLeave={() => {
          if (!tamperDetected) showControls();
        }}
      >
        <div
          ref={streamFrameRef}
          className={
            isPseudoFullscreen
              ? "relative aspect-video max-h-[100dvh] w-full max-w-[calc(100dvh*16/9)] bg-black [&>*]:!h-full [&>*]:!w-full"
              : "absolute inset-0"
          }
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              toggleStreamPlayback();
            }
          }}
        >
          <Stream
            height="100%"
            src={streamData.signedUrl}
            customerCode={streamData.customerCode}
            streamRef={streamRef}
            controls={false}
            autoplay={false}
            responsive
            onPlay={() => {
              if (tamperTriggeredRef.current) {
                (streamRef.current as { pause?: () => void } | undefined)?.pause?.();
                return;
              }

              handlePlaybackStarted();
            }}
            onPause={handlePlaybackPaused}
            onTimeUpdate={handleStreamTimeUpdate}
            onEnded={handlePlaybackEnded}
            onLoadedMetaData={handleStreamTimeUpdate}
            onDurationChange={handleStreamTimeUpdate}
          />
        </div>

        {!streamIsPlaying && (
          <button
            type="button"
            onClick={(event) => {
              stopEventPropagation(event);
              toggleStreamPlayback();
            }}
            disabled={tamperDetected}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/10"
            aria-label="播放影片"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-xl">
              <Play className="ml-1 h-6 w-6 fill-current" />
            </div>
          </button>
        )}

        <div className={streamControlsOverlayClass}>
          <div className={streamControlsGlowClass} />
          <div className={cn("relative", compactMode ? "space-y-2" : "space-y-3")}>
            <input
              type="range"
              min={0}
              max={streamProgressMax}
              step={1}
              value={displayedStreamSeekValue}
              onPointerDown={() => {
                setStreamIsSeeking(true);
                showControls(true);
              }}
              onClick={stopEventPropagation}
              onPointerUp={(event) => {
                const nextValue = Number(
                  (event.target as HTMLInputElement).value || 0
                );
                commitStreamSeek(nextValue);
                setStreamIsSeeking(false);
                showControls();
              }}
              onChange={handleStreamSeekChange}
              className={cn(
                "w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white",
                compactMode ? "h-1" : "h-1.5"
              )}
              aria-label="Video progress"
            />

            <div
              className={cn(
                "relative flex items-center text-white",
                compactMode ? "gap-2" : "flex-wrap gap-3"
              )}
            >
              <button
                type="button"
                onClick={(event) => {
                  stopEventPropagation(event);
                  showControls();
                  toggleStreamPlayback();
                }}
                disabled={tamperDetected}
                className={cn(
                  "flex items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-[1.03]",
                  compactMode ? "h-9 w-9 shrink-0" : "h-11 w-11"
                )}
                aria-label={streamIsPlaying ? "暫停影片" : "播放影片"}
              >
                {streamIsPlaying ? (
                  <Pause className={cn("fill-current", compactMode ? "h-4 w-4" : "h-5 w-5")} />
                ) : (
                  <Play className={cn("ml-0.5 fill-current", compactMode ? "h-4 w-4" : "h-5 w-5")} />
                )}
              </button>

              <div
                className={cn(
                  "font-medium tabular-nums text-white/90",
                  compactMode ? "min-w-0 flex-1 truncate text-xs" : "min-w-[88px] text-sm"
                )}
              >
                {formatTime(displayedStreamSeekValue)} / {formatTime(streamProgressMax)}
              </div>

              <div
                className={cn(
                  "ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/70 backdrop-blur",
                  compactMode ? "px-2 py-2" : "px-3 py-2"
                )}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    stopEventPropagation(event);
                    showControls();
                    toggleStreamMute();
                  }}
                  className="text-white/90 transition hover:text-white"
                  aria-label={streamMuted ? "開啟聲音" : "靜音影片"}
                >
                  {streamMuted || streamVolume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                {!compactMode && (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={streamMuted ? 0 : Math.round(streamVolume * 100)}
                    onClick={stopEventPropagation}
                    onChange={(event) => {
                      stopEventPropagation(event);
                      showControls();
                      handleStreamVolumeChange(event);
                    }}
                    className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
                    aria-label="Volume"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={(event) => {
                  stopEventPropagation(event);
                  showControls();
                  void toggleFullscreen();
                }}
                className={cn(
                  "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/90 backdrop-blur transition hover:bg-white/12 hover:text-white",
                  compactMode ? "h-9 w-9 shrink-0" : "h-10 w-10"
                )}
                aria-label={isFullscreen ? "退出全螢幕" : "進入全螢幕"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {!isPseudoFullscreen && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void toggleFullscreen();
            }}
            className={`absolute right-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/90 shadow-2xl backdrop-blur transition hover:bg-black/90 hover:text-white ${
              isControlsVisible || !streamIsPlaying
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            aria-label="進入全螢幕"
          >
            <Maximize className="h-5 w-5" />
          </button>
        )}

        {/* Cloudflare Stream 模擬全螢幕時提供的退出按鈕 */}
        {isPseudoFullscreen && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsPseudoFullscreen(false);
            }}
            className="absolute right-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/90 backdrop-blur transition hover:bg-black/90 hover:text-white"
            aria-label="退出全螢幕"
          >
            <Minimize2 className="h-5 w-5" />
          </button>
        )}

        <VideoWatermarkOverlay
          watermark={watermark}
          containerRef={playerContainerRef}
          videoFrameRef={streamFrameRef}
          onTamper={handleWatermarkTamper}
        />

      </div>
    );
  }
);
