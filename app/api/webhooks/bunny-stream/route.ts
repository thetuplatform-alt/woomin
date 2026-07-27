import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'
import { bunnyStatusFromCode, isValidBunnyWebhookSignature } from '@/lib/bunny-playback'
import { getVideoPlayData } from '@/lib/bunny'

// Bunny webhook payload 只有幾個欄位（VideoGuid／Status／Length／duration），
// 8KB 門檻遠大於已知的實際大小，超過視為異常請求，直接拒絕不解析 body。
const MAX_WEBHOOK_BODY_BYTES = 8 * 1024

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ success: false, error: '請求內容過大' }, { status: 413 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('X-BunnyStream-Signature') || ''
  const config = await getBunnyStreamConfig()
  if (!config.readOnlyApiKey) {
    return NextResponse.json({ success: false, error: 'Bunny Stream webhook 尚未設定' }, { status: 401 })
  }
  if (!isValidBunnyWebhookSignature(config.readOnlyApiKey, rawBody, signature)) {
    return NextResponse.json({ success: false, error: '簽名驗證失敗' }, { status: 401 })
  }
  try {
    const payload = JSON.parse(rawBody) as { VideoGuid?: string; Status?: number; Length?: number; duration?: number }
    if (!payload.VideoGuid) return NextResponse.json({ success: true })
    const media = await prisma.media.findUnique({
      where: { bunnyVideoId: payload.VideoGuid },
      select: { id: true, bunnyStatus: true, thumbnail: true, duration: true },
    })
    if (!media) {
      console.warn('[Bunny webhook] 找不到 Media', payload.VideoGuid)
      return NextResponse.json({ success: true })
    }

    const statusCode = Number(payload.Status)
    // payload 已帶 Length／duration 時視為足夠資訊，不再多打一次 Bunny API 補查（冪等 + 省成本）
    const hasProvidedMetrics = payload.Length != null || payload.duration != null
    const playData =
      (statusCode === 3 || statusCode === 4) && config.libraryId && !hasProvidedMetrics
        ? await getVideoPlayData(config.libraryId, config.apiKey, payload.VideoGuid)
        : null

    const nextStatus = bunnyStatusFromCode(statusCode)
    const nextThumbnail = playData?.video?.thumbnailUrl || media.thumbnail
    const rawDuration = playData?.video?.length || payload.Length || payload.duration
    const nextDuration = rawDuration ? Math.round(rawDuration) : media.duration

    const isUnchanged =
      nextStatus === media.bunnyStatus &&
      nextThumbnail === media.thumbnail &&
      nextDuration === media.duration

    if (isUnchanged) {
      return NextResponse.json({ success: true })
    }

    await prisma.media.update({
      where: { id: media.id },
      data: {
        bunnyStatus: nextStatus,
        thumbnail: nextThumbnail,
        duration: nextDuration,
      },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Webhook 資料格式錯誤' }, { status: 400 })
  }
}
