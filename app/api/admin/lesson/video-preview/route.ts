import { NextRequest, NextResponse } from 'next/server'
import { generateSignedStreamToken } from '@/lib/cloudflare'
import { createBunnyPlaybackToken, bunnyPlaybackExpiry } from '@/lib/bunny-playback'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import type { UnifiedVideoProvider } from '@/lib/unified-video-player'

const providers = new Set<UnifiedVideoProvider>(['youtube', 'vimeo', 'cloudflare', 'bunny'])

export async function POST(request: NextRequest) {
  try {
    try {
      await requireOnlyAdminAuth()
    } catch {
      return NextResponse.json({ success: false, error: '權限不足' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      videoProvider?: string
      videoSourceId?: string
    }
    const videoProvider = body.videoProvider as UnifiedVideoProvider | undefined
    const videoSourceId = body.videoSourceId?.trim()

    if (!videoSourceId || !videoProvider || !providers.has(videoProvider)) {
      return NextResponse.json({ success: false, error: '影片來源格式不正確' }, { status: 400 })
    }

    if (videoProvider === 'youtube' || videoProvider === 'vimeo') {
      return NextResponse.json({
        success: true,
        src: `${videoProvider}/${encodeURIComponent(videoSourceId)}`,
      })
    }

    if (videoProvider === 'cloudflare') {
      const signedToken = await generateSignedStreamToken(videoSourceId, 7200)
      if (!signedToken) {
        return NextResponse.json({ success: false, error: '無法產生 Cloudflare 播放來源' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        src: `https://customer-${signedToken.customerCode}.cloudflarestream.com/${videoSourceId}/manifest/video.m3u8?token=${encodeURIComponent(signedToken.token)}`,
      })
    }

    const config = await getBunnyStreamConfig()
    if (!config.libraryId || !config.apiKey) {
      return NextResponse.json({ success: false, error: 'Bunny Stream 尚未設定' }, { status: 500 })
    }

    const expires = bunnyPlaybackExpiry(Math.floor(Date.now() / 1000), null)
    const token = createBunnyPlaybackToken(config.apiKey, videoSourceId, expires)
    return NextResponse.json({
      success: true,
      src: `https://iframe.mediadelivery.net/embed/${config.libraryId}/${videoSourceId}?token=${token}&expires=${expires}`,
      token,
      expires,
    })
  } catch {
    return NextResponse.json({ success: false, error: '取得影片預覽來源失敗' }, { status: 500 })
  }
}
