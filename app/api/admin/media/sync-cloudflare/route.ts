// app/api/admin/media/sync-cloudflare/route.ts
// 同步 Cloudflare Stream 影片：
// 1. 將 Cloudflare Dashboard 直接上傳、但本地 Media 表遺漏的影片補進來
// 2. 更新既有影片的處理狀態、duration、thumbnail
// 前端可用同一支 API 做手動同步與 30 秒自動輪詢。

import { NextResponse } from 'next/server'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import {
  getStreamVideoErrorMessage,
  listAllStreamVideos,
  type StreamVideoInfo,
} from '@/lib/cloudflare'
import { revalidatePath } from 'next/cache'

function getStreamState(video: StreamVideoInfo): string {
  return video.status?.state || (video.readyToStream ? 'ready' : 'processing')
}

function toPersistableSize(size: unknown, fallback = 0): number {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return fallback
  }

  return Math.min(Math.round(size), 2_147_483_647)
}

export async function POST() {
  try {
    // 同步整個 Cloudflare 帳號的影片屬於全站維護操作，僅限 ADMIN
    try {
      await requireOnlyAdminAuth()
    } catch {
      return NextResponse.json(
        { success: false, error: '權限不足' },
        { status: 403 }
      )
    }

    const result = await listAllStreamVideos()
    if (!result.success || !result.videos) {
      return NextResponse.json(
        { success: false, error: result.error || '無法取得 Cloudflare 影片列表' },
        { status: 500 }
      )
    }

    const remoteVideos = result.videos
    const remoteIds = remoteVideos.map((v) => v.uid).filter(Boolean)

    const existing = await prisma.media.findMany({
      where: { cfStreamId: { in: remoteIds } },
      select: {
        id: true,
        cfStreamId: true,
        cfStatus: true,
        duration: true,
        thumbnail: true,
        size: true,
      },
    })
    const existingByStreamId = new Map(
      existing
        .filter((m) => m.cfStreamId)
        .map((m) => [m.cfStreamId!, m])
    )

    const missing = remoteVideos.filter((v) => v.uid && !existingByStreamId.has(v.uid))

    let imported = 0
    let updated = 0
    let ready = 0
    let processing = 0
    let errorCount = 0
    const errors: Array<{
      uid: string
      name: string
      status: string
      error: string
    }> = []
    const importErrors: Array<{
      uid: string
      name: string
      error: string
    }> = []

    for (const video of remoteVideos) {
      const state = getStreamState(video)
      if (state === 'ready' || video.readyToStream) {
        ready += 1
      } else if (state === 'error') {
        errorCount += 1
        errors.push({
          uid: video.uid,
          name: video.meta?.name || `video-${video.uid}`,
          status: state,
          error:
            getStreamVideoErrorMessage(video) ||
            'Cloudflare Stream 處理失敗，請重新上傳或到 Cloudflare 後台查看原因',
        })
      } else {
        processing += 1
      }
    }

    for (const video of remoteVideos) {
      if (!video.uid) continue

      const existingMedia = existingByStreamId.get(video.uid)
      if (!existingMedia) continue

      const nextStatus = getStreamState(video) || existingMedia.cfStatus || 'pending'
      const nextDuration =
        typeof video.duration === 'number' && video.duration > 0
          ? Math.round(video.duration)
          : existingMedia.duration
      const nextThumbnail = video.thumbnail || existingMedia.thumbnail
      const nextSize = toPersistableSize(video.size, existingMedia.size)

      const shouldUpdate =
        existingMedia.cfStatus !== nextStatus ||
        existingMedia.duration !== nextDuration ||
        existingMedia.thumbnail !== nextThumbnail ||
        existingMedia.size !== nextSize

      if (!shouldUpdate) continue

      await prisma.media.update({
        where: { id: existingMedia.id },
        data: {
          cfStatus: nextStatus,
          duration: nextDuration,
          thumbnail: nextThumbnail,
          size: nextSize,
        },
      })
      updated += 1
    }

    for (const video of missing) {
      try {
        const nextStatus = getStreamState(video)
        await prisma.media.upsert({
          where: { cfStreamId: video.uid },
          update: {
            originalName: video.meta?.name || `video-${video.uid}`,
            size: toPersistableSize(video.size),
            cfStatus: nextStatus,
            duration:
              typeof video.duration === 'number' && video.duration > 0
                ? Math.round(video.duration)
                : undefined,
            thumbnail: video.thumbnail || undefined,
          },
          create: {
            type: 'VIDEO',
            filename: video.uid,
            originalName: video.meta?.name || `video-${video.uid}`,
            mimeType: 'video/mp4',
            size: toPersistableSize(video.size),
            url: `https://watch.cloudflarestream.com/${video.uid}`,
            cfStreamId: video.uid,
            cfStatus: nextStatus,
            duration:
              typeof video.duration === 'number' && video.duration > 0
                ? Math.round(video.duration)
                : undefined,
            thumbnail: video.thumbnail || undefined,
            sourceType: 'CLOUDFLARE_SYNC',
            sourceId: video.uid,
            sourceLabel: 'Cloudflare Stream 同步',
            sourceUrl: `https://watch.cloudflarestream.com/${video.uid}`,
          },
        })
        imported += 1
      } catch (error) {
        console.error(`[Sync Cloudflare] 匯入影片失敗 uid=${video.uid}:`, error)
        importErrors.push({
          uid: video.uid,
          name: video.meta?.name || `video-${video.uid}`,
          error: error instanceof Error ? error.message : '匯入影片時發生未知錯誤',
        })
      }
    }

    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')

    return NextResponse.json({
      success: true,
      total: remoteVideos.length,
      existing: existing.length,
      imported,
      updated,
      ready,
      processing,
      errorCount,
      hasProcessing: processing > 0,
      errors: errors.slice(0, 10),
      importErrors: importErrors.slice(0, 10),
      summary:
        errors.length > 0 || importErrors.length > 0
          ? {
              errorVideos: errors.length,
              importFailures: importErrors.length,
              truncated: errors.length > 10 || importErrors.length > 10,
            }
          : undefined,
    })
  } catch (error) {
    console.error('[Sync Cloudflare] 同步失敗:', error)
    return NextResponse.json(
      { success: false, error: '同步時發生錯誤' },
      { status: 500 }
    )
  }
}
