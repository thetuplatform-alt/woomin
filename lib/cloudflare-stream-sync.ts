// lib/cloudflare-stream-sync.ts
// 被動式 Cloudflare Stream 同步排程器
// 不依賴 webhook：Media 建立或被查詢時觸發，用 setTimeout 做 30 秒輪詢，
// 每次同步會去 Cloudflare API 拉最新 status/duration/thumbnail 寫回 DB。
// 任何一次拉到 ready 就停止，最多嘗試 MAX_ATTEMPTS 次。

import { prisma } from '@/lib/prisma'
import {
  getStreamVideoErrorMessage,
  getStreamVideoInfo,
  getStreamThumbnailUrl,
  listAllStreamVideos,
} from '@/lib/cloudflare'

const MAX_ATTEMPTS = 240
const POLL_INTERVAL_SECONDS = 30
const FIRST_POLL_DELAY_SECONDS = 5

const scheduled = new Map<string, NodeJS.Timeout>()

function isReady(state: string | null | undefined): boolean {
  return state === 'ready'
}

function toPersistableSize(size: unknown, fallback = 0): number {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return fallback
  }

  return Math.min(Math.round(size), 2_147_483_647)
}

async function syncOnce(mediaId: string): Promise<{ ready: boolean }> {
  const media = await prisma.media.findUnique({ where: { id: mediaId } })
  if (!media || !media.cfStreamId) {
    return { ready: true }
  }
  if (isReady(media.cfStatus)) {
    return { ready: true }
  }

  const info = await getStreamVideoInfo(media.cfStreamId)
  if (!info) {
    return { ready: false }
  }

  const nextStatus = info.status?.state || media.cfStatus || 'unknown'
  const statusError = getStreamVideoErrorMessage(info)
  const nextDuration =
    typeof info.duration === 'number' && info.duration > 0
      ? Math.round(info.duration)
      : undefined

  let thumbnail: string | undefined
  if (!media.thumbnail && isReady(nextStatus)) {
    const t = await getStreamThumbnailUrl(media.cfStreamId)
    if (t) thumbnail = t
  }

  await prisma.media.update({
    where: { id: mediaId },
    data: {
      cfStatus: nextStatus,
      ...(nextDuration ? { duration: nextDuration } : {}),
      ...(thumbnail ? { thumbnail } : {}),
      ...(statusError ? { sourceLabel: `Cloudflare Stream：${statusError}` } : {}),
    },
  })

  return { ready: isReady(nextStatus) }
}

function scheduleAttempt(mediaId: string, attempt: number) {
  if (attempt >= MAX_ATTEMPTS) {
    scheduled.delete(mediaId)
    return
  }

  const delayMs =
    (attempt === 0 ? FIRST_POLL_DELAY_SECONDS : POLL_INTERVAL_SECONDS) * 1000

  const timer = setTimeout(async () => {
    try {
      const { ready } = await syncOnce(mediaId)
      if (ready) {
        scheduled.delete(mediaId)
        return
      }
      scheduleAttempt(mediaId, attempt + 1)
    } catch (error) {
      console.error(
        `[CF Stream Sync] mediaId=${mediaId} attempt=${attempt} 失敗:`,
        error
      )
      scheduleAttempt(mediaId, attempt + 1)
    }
  }, delayMs)

  // Node.js 長駐環境中不阻塞程序退出
  if (typeof timer.unref === 'function') timer.unref()

  scheduled.set(mediaId, timer)
}

/**
 * 確保該 Media 有排程中的同步任務。若已排程或已 ready 則不做任何事。
 * 呼叫後立即返回，實際同步在背景執行。
 */
export function ensureStreamSyncScheduled(mediaId: string): void {
  if (scheduled.has(mediaId)) return
  scheduleAttempt(mediaId, 0)
}

export async function syncCloudflareStreamLibrary(): Promise<{
  total: number
  imported: number
  updated: number
  processing: number
  ready: number
}> {
  const result = await listAllStreamVideos()
  if (!result.success || !result.videos) {
    throw new Error(result.error || '無法取得 Cloudflare 影片列表')
  }

  const remoteVideos = result.videos
  const existing = await prisma.media.findMany({
    where: { type: 'VIDEO', cfStreamId: { not: null } },
    select: {
      id: true,
      cfStreamId: true,
      cfStatus: true,
      duration: true,
      thumbnail: true,
      size: true,
      originalName: true,
    },
  })

  const byStreamId = new Map(existing.map((item) => [item.cfStreamId, item]))
  let imported = 0
  let updated = 0
  let processing = 0
  let ready = 0

  for (const video of remoteVideos) {
    const status = video.status?.state || (video.readyToStream ? 'ready' : 'pending')
    if (status === 'ready') ready += 1
    else processing += 1

    const duration =
      typeof video.duration === 'number' && video.duration > 0
        ? Math.round(video.duration)
        : undefined

    const existingMedia = byStreamId.get(video.uid)
    if (!existingMedia) {
      await prisma.media.upsert({
        where: { cfStreamId: video.uid },
        update: {
          originalName: video.meta?.name || `video-${video.uid}`,
          size: toPersistableSize(video.size),
          cfStatus: status,
          duration,
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
          cfStatus: status,
          duration,
          thumbnail: video.thumbnail || undefined,
          sourceType: 'CLOUDFLARE_SYNC',
          sourceId: video.uid,
          sourceLabel: 'Cloudflare Stream 同步',
          sourceUrl: `https://watch.cloudflarestream.com/${video.uid}`,
        },
      })
      imported += 1
      continue
    }

    const nextData: {
      cfStatus?: string
      duration?: number
      thumbnail?: string
      size?: number
      originalName?: string
    } = {}

    if (existingMedia.cfStatus !== status) nextData.cfStatus = status
    if (duration && existingMedia.duration !== duration) nextData.duration = duration
    if (!existingMedia.thumbnail && video.thumbnail) nextData.thumbnail = video.thumbnail
    const size = toPersistableSize(video.size, existingMedia.size)
    if (existingMedia.size !== size) {
      nextData.size = size
    }
    if (video.meta?.name && existingMedia.originalName !== video.meta.name) {
      nextData.originalName = video.meta.name
    }

    if (Object.keys(nextData).length > 0) {
      await prisma.media.update({
        where: { id: existingMedia.id },
        data: nextData,
      })
      updated += 1
    }
  }

  return {
    total: remoteVideos.length,
    imported,
    updated,
    processing,
    ready,
  }
}
