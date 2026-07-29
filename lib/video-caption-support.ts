import type { UnifiedVideoProvider } from './unified-video-player'

export type VideoCaptionSupport = 'hls-embedded' | 'unsupported'

export function getVideoCaptionSupport(provider: UnifiedVideoProvider): VideoCaptionSupport {
  return provider === 'cloudflare' ? 'hls-embedded' : 'unsupported'
}

export function getVideoCaptionNotice(provider: UnifiedVideoProvider): string | null {
  if (provider === 'bunny') {
    return 'Bunny 目前使用嵌入播放器，無法在 VidStack 顯示字幕選單。'
  }

  if (provider === 'youtube' || provider === 'vimeo') {
    return '此來源目前不支援字幕選單。'
  }

  return null
}
