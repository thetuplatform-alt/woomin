// app/api/lesson/stream-url/route.ts
// 影片串流簽名 URL API
// POST: 取得帶簽名的 Cloudflare Stream URL

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  generateSignedStreamToken,
  getStreamThumbnailUrl,
  getStreamVideoInfo,
} from '@/lib/cloudflare'
import { checkLessonAccess } from '@/lib/actions/lesson'
import { getEffectiveLessonVideo } from '@/lib/video-source'
import { ensureStreamSyncScheduled } from '@/lib/cloudflare-stream-sync'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'
import { bunnyPlaybackExpiry, createBunnyPlaybackToken } from '@/lib/bunny-playback'

/**
 * 請求格式
 */
interface StreamUrlRequest {
  lessonId: string
  videoId: string
}

/**
 * POST /api/lesson/stream-url
 * 取得帶簽名的影片串流 URL
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證登入狀態
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    // 解析請求內容
    const body: StreamUrlRequest = await request.json()
    const { lessonId, videoId } = body

    // 驗證必要參數
    if (!lessonId || !videoId) {
      return NextResponse.json(
        { success: false, error: '缺少必要參數' },
        { status: 400 }
      )
    }

    // 檢查用戶是否有權限存取此單元
    const accessStatus = await checkLessonAccess(lessonId)

    // 明確的狀態碼
    if (accessStatus === 'not_found') {
      return NextResponse.json(
        { success: false, error: '單元不存在' },
        { status: 404 }
      )
    }

    if (accessStatus === 'not_logged_in') {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    // allowlist：僅 granted / free 放行；not_purchased / expired 等一律拒絕
    //（修 PRD §9：過期用戶原可經 denylist 落穿取得簽名影片 URL）
    if (accessStatus !== 'granted' && accessStatus !== 'free') {
      return NextResponse.json(
        {
          success: false,
          error:
            accessStatus === 'expired'
              ? '您的課程觀看權限已到期'
              : '您尚未購買此課程',
        },
        { status: 403 }
      )
    }

    // 取得單元資訊，驗證 videoId 是否匹配
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        videoId: true,
        videoProvider: true,
        videoSourceId: true,
        videoUrl: true,
        videoThumbnail: true,
        videoDuration: true,
      },
    })

    if (!lesson) {
      return NextResponse.json(
        { success: false, error: '單元不存在' },
        { status: 404 }
      )
    }

    // 驗證請求的 videoId 與單元的 videoId 是否匹配
    const effectiveVideo = getEffectiveLessonVideo(lesson)

    if (effectiveVideo.videoProvider === 'bunny') {
      if (effectiveVideo.videoSourceId !== videoId) {
        return NextResponse.json({ success: false, error: '影片 ID 不匹配' }, { status: 400 })
      }
      // 兩個查詢互不依賴，平行執行縮短回應時間
      const [media, config] = await Promise.all([
        prisma.media.findUnique({
          where: { bunnyVideoId: videoId },
          select: { duration: true },
        }),
        getBunnyStreamConfig(),
      ])
      if (!config.libraryId || !config.apiKey) {
        return NextResponse.json({ success: false, error: 'Bunny Stream 尚未設定' }, { status: 500 })
      }
      const expires = bunnyPlaybackExpiry(Math.floor(Date.now() / 1000), media?.duration ?? lesson.videoDuration)
      const token = createBunnyPlaybackToken(config.apiKey, videoId, expires)
      return NextResponse.json({
        success: true,
        signedUrl: `https://iframe.mediadelivery.net/embed/${config.libraryId}/${videoId}?token=${token}&expires=${expires}`,
        token,
        expires,
      })
    }

    if (
      effectiveVideo.videoProvider !== 'cloudflare' ||
      effectiveVideo.videoSourceId !== videoId
    ) {
      return NextResponse.json(
        { success: false, error: '影片 ID 不匹配' },
        { status: 400 }
      )
    }

    const media = await prisma.media.findUnique({
      where: { cfStreamId: videoId },
      select: {
        id: true,
        cfStatus: true,
        duration: true,
        thumbnail: true,
      },
    })

    if (media && media.cfStatus !== 'ready') {
      ensureStreamSyncScheduled(media.id)

      const videoInfo = await getStreamVideoInfo(videoId)
      const nextStatus = videoInfo?.status?.state || media.cfStatus || 'pending'
      const isReady = nextStatus === 'ready' || videoInfo?.readyToStream === true
      const nextDuration =
        typeof videoInfo?.duration === 'number' && videoInfo.duration > 0
          ? Math.round(videoInfo.duration)
          : media.duration
      let nextThumbnail = media.thumbnail

      if (isReady && !nextThumbnail) {
        nextThumbnail = (await getStreamThumbnailUrl(videoId)) || media.thumbnail
      }

      await prisma.media.update({
        where: { id: media.id },
        data: {
          cfStatus: nextStatus,
          duration: nextDuration,
          thumbnail: nextThumbnail,
        },
      })

      if (!isReady) {
        return NextResponse.json(
          {
            success: false,
            error: '影片仍在處理中，請稍候',
            videoProcessing: true,
            retryAfterSec: 5,
            cfStatus: nextStatus,
            pctComplete: videoInfo?.status?.pctComplete,
          },
          { status: 409 }
        )
      }
    }

    // 產生簽名資訊（2 小時有效）
    const expiresIn = 7200
    const signedToken = await generateSignedStreamToken(videoId, expiresIn)

    if (!signedToken) {
      return NextResponse.json(
        { success: false, error: '無法產生影片串流 Token' },
        { status: 500 }
      )
    }

    // 構建 signed URL 格式：signedToken
    // @cloudflare/stream-react 的 src 接受這種格式
    const signedUrl = signedToken.token

    return NextResponse.json({
      success: true,
      signedUrl,
      customerCode: signedToken.customerCode,
      expiresIn,
    })
  } catch (error) {
    console.error('取得影片串流 URL 失敗:', error)
    return NextResponse.json(
      { success: false, error: '取得影片串流 URL 失敗' },
      { status: 500 }
    )
  }
}
