// app/api/admin/media/upload-complete/route.ts
// 上傳完成回調
// 建立 Media 記錄

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'
import { prisma } from '@/lib/prisma'
import {
  getStreamVideoErrorMessage,
  getStreamVideoInfo,
  getStreamThumbnailUrl,
} from '@/lib/cloudflare'
import { ensureStreamSyncScheduled } from '@/lib/cloudflare-stream-sync'
import { getVideoPlayData } from '@/lib/bunny'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'

const POSTGRES_INT_MAX = 2_147_483_647

function toPersistableSize(size: unknown): number {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return 0
  }

  return Math.min(Math.round(size), POSTGRES_INT_MAX)
}

/**
 * POST /api/admin/media/upload-complete
 * 影片上傳完成後建立 Media 記錄
 */
export async function POST(request: NextRequest) {
  try {
    // M18/L41：改用 requireAdminAuth（查 DB 角色）取代 JWT role
    let actor
    try {
      actor = await requireAdminAuth()
    } catch {
      return NextResponse.json(
        { success: false, error: '權限不足' },
        { status: 403 }
      )
    }

    // 解析請求內容
    const body = await request.json()
    const { uid, videoId, provider, originalName, size } = body

    if (provider === 'bunny') {
      if (!videoId) {
        return NextResponse.json({ success: false, error: '缺少 Bunny 影片 ID' }, { status: 400 })
      }
      const existingBunny = await prisma.media.findUnique({
        where: { bunnyVideoId: videoId },
        select: { uploadedBy: true },
      })
      if (existingBunny && !isFullAdmin(actor.role) && existingBunny.uploadedBy !== actor.id) {
        return NextResponse.json({ success: false, error: '此影片已由其他帳號上傳，無法認領' }, { status: 403 })
      }
      const bunnyConfig = await getBunnyStreamConfig()
      const playData = bunnyConfig.libraryId && bunnyConfig.apiKey
        ? await getVideoPlayData(bunnyConfig.libraryId, bunnyConfig.apiKey, videoId)
        : null
      const bunnyVideo = playData?.video
      const mediaData = {
        type: 'VIDEO' as const,
        filename: videoId,
        originalName: originalName || `video-${videoId}`,
        mimeType: 'video/mp4',
        size: toPersistableSize(size),
        url: `https://iframe.mediadelivery.net/embed/${bunnyConfig.libraryId}/${videoId}`,
        bunnyStatus: 'processing',
        duration: bunnyVideo?.length ? Math.round(bunnyVideo.length) : null,
        thumbnail: bunnyVideo?.thumbnailUrl ?? null,
        uploadedBy: actor.id,
        sourceType: 'MANUAL' as const,
        sourceLabel: 'Bunny Stream 後台影片上傳',
      }
      const media = await prisma.media.upsert({
        where: { bunnyVideoId: videoId },
        update: mediaData,
        create: { ...mediaData, bunnyVideoId: videoId },
      })
      return NextResponse.json({ success: true, media })
    }

    if (!uid) {
      return NextResponse.json(
        { success: false, error: '缺少影片 ID' },
        { status: 400 }
      )
    }

    // L41：若此 cfStreamId 已有 Media 記錄且屬於他人，非 ADMIN 不得認領 / 覆寫，
    // 避免講師以他人的影片 uid 竄改 / 接管媒體記錄。
    const existingMedia = await prisma.media.findUnique({
      where: { cfStreamId: uid },
      select: { uploadedBy: true },
    })
    if (
      existingMedia &&
      !isFullAdmin(actor.role) &&
      existingMedia.uploadedBy !== actor.id
    ) {
      return NextResponse.json(
        { success: false, error: '此影片已由其他帳號上傳，無法認領' },
        { status: 403 }
      )
    }

    // 取得影片資訊
    const videoInfo = await getStreamVideoInfo(uid)
    const thumbnailUrl = await getStreamThumbnailUrl(uid)
    const cfStatus = videoInfo?.status?.state || 'pending'
    const cfError = videoInfo ? getStreamVideoErrorMessage(videoInfo) : null

    const mediaData = {
      type: 'VIDEO' as const,
      filename: uid,
      originalName: originalName || `video-${uid}`,
      mimeType: 'video/mp4',
      size: toPersistableSize(size),
      url: `https://watch.cloudflarestream.com/${uid}`,
      cfStatus,
      duration: videoInfo?.duration ? Math.round(videoInfo.duration) : null,
      thumbnail: thumbnailUrl || null,
      uploadedBy: actor.id,
      sourceType: 'MANUAL' as const,
      sourceLabel: cfError ? `後台影片上傳：${cfError}` : '後台影片上傳',
    }

    const media = await prisma.media.upsert({
      where: { cfStreamId: uid },
      update: mediaData,
      create: {
        ...mediaData,
        cfStreamId: uid,
      },
    })

    if (cfStatus !== 'ready') {
      ensureStreamSyncScheduled(media.id)
    }

    return NextResponse.json({
      success: true,
      media,
      cloudflareStatus: {
        state: cfStatus,
        pctComplete: videoInfo?.status?.pctComplete,
        error: cfError,
      },
    })
  } catch (error) {
    console.error('建立媒體記錄失敗:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `建立媒體記錄時發生錯誤：${error.message}`
            : '建立媒體記錄時發生錯誤',
      },
      { status: 500 }
    )
  }
}
