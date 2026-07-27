// app/api/admin/media/[id]/status/route.ts
// 取得媒體處理狀態
// 用於輪詢影片處理進度和時長

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'
import { prisma } from '@/lib/prisma'
import {
  getStreamVideoErrorMessage,
  getStreamThumbnailUrl,
  getStreamVideoInfo,
} from '@/lib/cloudflare'
import { ensureStreamSyncScheduled } from '@/lib/cloudflare-stream-sync'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'
import { bunnyStatusFromCode } from '@/lib/bunny-playback'
import { getVideoPlayData } from '@/lib/bunny'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/admin/media/[id]/status
 * 取得媒體處理狀態（包含最新的 duration）
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // M18：改用 requireAdminAuth（直接查 DB 角色，避免 JWT 過期前的舊角色），取代 JWT role 判權
    let actor
    try {
      actor = await requireAdminAuth()
    } catch {
      return NextResponse.json(
        { success: false, error: '權限不足' },
        { status: 403 }
      )
    }

    const { id } = await context.params

    // 取得 Media 記錄
    const media = await prisma.media.findUnique({
      where: { id },
    })

    if (!media) {
      return NextResponse.json(
        { success: false, error: '找不到媒體記錄' },
        { status: 404 }
      )
    }

    // M18：歸屬檢查 — 非 ADMIN 只能查詢 / 同步自己上傳的媒體，
    // 避免講師枚舉他人媒體的 cfStreamId、窺看課程結構，或越權寫入他人媒體狀態。
    if (!isFullAdmin(actor.role) && media.uploadedBy !== actor.id) {
      return NextResponse.json(
        { success: false, error: '沒有此媒體的存取權限' },
        { status: 403 }
      )
    }

    if (media.bunnyVideoId) {
      if (media.bunnyStatus === 'ready' && media.duration && media.duration > 0) {
        return NextResponse.json({
          success: true,
          media: {
            id: media.id,
            bunnyVideoId: media.bunnyVideoId,
            bunnyStatus: media.bunnyStatus,
            duration: media.duration,
            thumbnail: media.thumbnail,
            ready: true,
            size: media.size,
            sourceType: media.sourceType,
            sourceLabel: media.sourceLabel,
          },
        })
      }

      const config = await getBunnyStreamConfig()
      if (!config.libraryId || !config.apiKey) {
        return NextResponse.json({ success: false, error: 'Bunny Stream 尚未設定' }, { status: 500 })
      }

      const playData = await getVideoPlayData(config.libraryId, config.apiKey, media.bunnyVideoId)
      if (!playData.success || !playData.video) {
        return NextResponse.json({
          success: true,
          media: {
            id: media.id,
            bunnyVideoId: media.bunnyVideoId,
            bunnyStatus: media.bunnyStatus,
            duration: media.duration,
            thumbnail: media.thumbnail,
            ready: media.bunnyStatus === 'ready',
            size: media.size,
            sourceType: media.sourceType,
            sourceLabel: media.sourceLabel,
          },
        })
      }

      const nextStatus = bunnyStatusFromCode(Number(playData.video.status))
      const nextDuration = typeof playData.video.length === 'number' && playData.video.length > 0
        ? Math.round(playData.video.length)
        : media.duration
      const nextThumbnail = playData.video.thumbnailUrl || media.thumbnail
      const isReady = nextStatus === 'ready'
      await prisma.media.update({
        where: { id: media.id },
        data: {
          bunnyStatus: nextStatus,
          duration: nextDuration,
          thumbnail: nextThumbnail,
        },
      })

      return NextResponse.json({
        success: true,
        media: {
          id: media.id,
          bunnyVideoId: media.bunnyVideoId,
          bunnyStatus: nextStatus,
          duration: nextDuration,
          thumbnail: nextThumbnail,
          ready: isReady,
          size: media.size,
          sourceType: media.sourceType,
          sourceLabel: media.sourceLabel,
        },
      })
    }

    // 如果已 ready 且有 duration，直接返回
    if (media.cfStatus === 'ready' && media.duration && media.duration > 0) {
      return NextResponse.json({
        success: true,
        media: {
          id: media.id,
          cfStreamId: media.cfStreamId,
          cfStatus: media.cfStatus,
          duration: media.duration,
          ready: true,
          size: media.size,
          sourceType: media.sourceType,
          sourceLabel: media.sourceLabel,
        },
      })
    }

    // 尚未 ready：確保背景 30 秒輪詢同步已排程
    if (media.cfStreamId) {
      ensureStreamSyncScheduled(media.id)
    }

    // 如果沒有 cfStreamId，無法查詢
    if (!media.cfStreamId) {
      return NextResponse.json({
        success: true,
        media: {
          id: media.id,
          cfStreamId: null,
          cfStatus: media.cfStatus,
          duration: null,
          ready: false,
          size: media.size,
          sourceType: media.sourceType,
          sourceLabel: media.sourceLabel,
        },
      })
    }

    // 從 Cloudflare API 取得最新狀態
    const videoInfo = await getStreamVideoInfo(media.cfStreamId)

    if (!videoInfo) {
      return NextResponse.json({
        success: true,
        media: {
          id: media.id,
          cfStreamId: media.cfStreamId,
          cfStatus: media.cfStatus,
          duration: null,
          ready: false,
          size: media.size,
          sourceType: media.sourceType,
          sourceLabel: media.sourceLabel,
        },
      })
    }

    const nextStatus = videoInfo.status?.state || media.cfStatus || 'processing'
    const isReady = nextStatus === 'ready' || videoInfo.readyToStream
    const statusError = getStreamVideoErrorMessage(videoInfo)
    const roundedDuration =
      typeof videoInfo.duration === 'number' && videoInfo.duration > 0
        ? Math.round(videoInfo.duration)
        : media.duration
    let thumbnail = media.thumbnail

    if (!thumbnail && isReady && media.cfStreamId) {
      thumbnail = (await getStreamThumbnailUrl(media.cfStreamId)) || media.thumbnail
    }

    await prisma.media.update({
      where: { id: media.id },
      data: {
        cfStatus: nextStatus,
        duration: roundedDuration,
        thumbnail,
        sourceLabel: statusError
          ? `Cloudflare Stream：${statusError}`
          : media.sourceLabel,
      },
    })

    return NextResponse.json({
      success: true,
      media: {
        id: media.id,
        cfStreamId: media.cfStreamId,
        cfStatus: nextStatus,
        duration: roundedDuration,
        thumbnail,
        ready: isReady,
        pctComplete: videoInfo.status?.pctComplete,
        statusError,
        size: media.size,
        sourceType: media.sourceType,
        sourceLabel: statusError
          ? `Cloudflare Stream：${statusError}`
          : media.sourceLabel,
      },
    })
  } catch (error) {
    console.error('取得媒體狀態失敗:', error)
    return NextResponse.json(
      { success: false, error: '取得媒體狀態時發生錯誤' },
      { status: 500 }
    )
  }
}
