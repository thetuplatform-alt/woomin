// lib/actions/media.ts
// 媒體管理 Server Actions
// 提供媒體 CRUD 操作

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'
import {
  deleteStreamVideo,
  getStreamVideoInfo,
} from '@/lib/cloudflare'
import { deleteStorageObject, getStorageObjectRefFromUrl } from '@/lib/storage'
import type { MediaSourceType, MediaType, Media, Prisma } from '@prisma/client'
import { getCloudVideoProviderFilter } from '@/lib/video-provider-policy'

/**
 * 媒體歸屬檢查：ADMIN 可管理所有媒體，講師僅能管理自己上傳的媒體。
 * 避免講師刪除/修改其他講師課程使用中的影片或附件。
 */
function canManageMedia(
  actor: { id: string; role: string },
  media: { uploadedBy: string | null }
) {
  return isFullAdmin(actor.role) || media.uploadedBy === actor.id
}

/**
 * 媒體列表查詢參數
 */
export interface GetMediaParams {
  type?: MediaType | 'ALL'
  search?: string
  page?: number
  pageSize?: number
  provider?: 'cloudflare' | 'bunny'
}

/**
 * 媒體列表回傳結果
 */
export interface GetMediaResult {
  media: Media[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 建立媒體記錄參數
 */
export interface CreateMediaData {
  type: MediaType
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  cfStreamId?: string
  cfStatus?: string
  duration?: number
  thumbnail?: string
  sourceType?: MediaSourceType
  sourceId?: string | null
  sourceLabel?: string | null
  sourceUrl?: string | null
  allowDownload?: boolean
  dynamicWatermarkEnabled?: boolean
  watermarkConfig?: Prisma.InputJsonValue
}

interface ImageUsage {
  label: string
  location: string
}

function urlsReferToSameAsset(primaryUrl: string, candidateUrl: string | null | undefined): boolean {
  if (!candidateUrl) {
    return false
  }

  if (primaryUrl === candidateUrl) {
    return true
  }

  try {
    const primary = new URL(primaryUrl)
    if (primary.pathname === candidateUrl) {
      return true
    }
  } catch {
    // Ignore relative primaryUrl values.
  }

  try {
    const candidate = new URL(candidateUrl)
    if (candidate.pathname === primaryUrl) {
      return true
    }
  } catch {
    // Ignore relative candidateUrl values.
  }

  return false
}

async function findImageUsages(url: string): Promise<ImageUsage[]> {
  const usages: ImageUsage[] = []

  const [siteSettings, courses, lessons] = await Promise.all([
    prisma.siteSetting.findMany({
      where: { key: { in: ['site_logo'] } },
      select: { key: true, value: true },
    }),
    prisma.course.findMany({
      where: {
        OR: [
          { coverImage: { not: null } },
          { ogImage: { not: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        coverImage: true,
        ogImage: true,
      },
    }),
    prisma.lesson.findMany({
      where: { comingSoonImage: { not: null } },
      select: {
        id: true,
        title: true,
        comingSoonImage: true,
        chapter: {
          select: {
            title: true,
            course: {
              select: { title: true },
            },
          },
        },
      },
    }),
  ])

  for (const setting of siteSettings) {
    if (urlsReferToSameAsset(url, setting.value)) {
      usages.push({
        label: '站點 Logo',
        location: 'SiteSetting.site_logo',
      })
    }
  }

  for (const course of courses) {
    if (urlsReferToSameAsset(url, course.coverImage)) {
      usages.push({
        label: `課程封面: ${course.title}`,
        location: `Course(${course.id}).coverImage`,
      })
    }

    if (urlsReferToSameAsset(url, course.ogImage)) {
      usages.push({
        label: `課程 OG 圖: ${course.title}`,
        location: `Course(${course.id}).ogImage`,
      })
    }
  }

  for (const lesson of lessons) {
    if (urlsReferToSameAsset(url, lesson.comingSoonImage)) {
      usages.push({
        label: `製作中預覽圖: ${lesson.chapter.course.title} / ${lesson.chapter.title} / ${lesson.title}`,
        location: `Lesson(${lesson.id}).comingSoonImage`,
      })
    }
  }

  return usages
}

// requireAdminAuth 從 @/lib/require-admin 引入（直接查 DB 確保角色即時生效）

/**
 * 取得媒體列表（含搜尋、篩選、分頁）
 */
export async function getMediaList(
  params: GetMediaParams = {}
): Promise<GetMediaResult> {
  const actor = await requireAdminAuth()

  const { type, search, page = 1, pageSize = 20, provider } = params

  // 建立查詢條件
  const where: Prisma.MediaWhereInput = {}

  // 講師只能瀏覽自己上傳的媒體（ADMIN 可見全部）
  if (!isFullAdmin(actor.role)) {
    where.uploadedBy = actor.id
  }

  if (type && type !== 'ALL') {
    where.type = type
  }

  if (provider === 'bunny') {
    Object.assign(where, getCloudVideoProviderFilter(provider))
  } else if (provider === 'cloudflare') {
    Object.assign(where, getCloudVideoProviderFilter(provider))
  }

  if (search) {
    where.OR = [
      { filename: { contains: search, mode: 'insensitive' } },
      { originalName: { contains: search, mode: 'insensitive' } },
    ]
  }

  // 查詢總數
  const total = await prisma.media.count({ where })

  // 查詢媒體列表
  const media = await prisma.media.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  return {
    media,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * 取得單一媒體
 */
export async function getMediaById(id: string): Promise<Media | null> {
  await requireAdminAuth()

  const media = await prisma.media.findUnique({
    where: { id },
  })

  return media
}

/**
 * 根據 Cloudflare Stream ID 取得媒體
 */
export async function getMediaByCfStreamId(cfStreamId: string): Promise<Media | null> {
  await requireAdminAuth()

  const media = await prisma.media.findFirst({
    where: { cfStreamId },
  })

  return media
}

/**
 * 建立媒體記錄
 */
export async function createMedia(
  data: CreateMediaData
): Promise<{ success: boolean; media?: Media; error?: string }> {
  try {
    const user = await requireAdminAuth()

    const media = await prisma.media.create({
      data: {
        type: data.type,
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        url: data.url,
        cfStreamId: data.cfStreamId ?? null,
        cfStatus: data.cfStatus ?? null,
        duration: data.duration ?? null,
        thumbnail: data.thumbnail ?? null,
        uploadedBy: user.id as string,
        sourceType: data.sourceType ?? 'MANUAL',
        sourceId: data.sourceId ?? null,
        sourceLabel: data.sourceLabel ?? null,
        sourceUrl: data.sourceUrl ?? null,
        allowDownload: data.allowDownload ?? true,
        dynamicWatermarkEnabled: data.dynamicWatermarkEnabled ?? false,
        watermarkConfig: data.watermarkConfig ?? undefined,
      },
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')
    revalidatePath('/admin/media/images')
    revalidatePath('/admin/media/attachments')

    return { success: true, media }
  } catch (error) {
    console.error('建立媒體記錄失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '建立媒體記錄時發生錯誤' }
  }
}

/**
 * 更新媒體記錄
 */
export async function updateMedia(
  id: string,
  data: Partial<CreateMediaData>
): Promise<{ success: boolean; media?: Media; error?: string }> {
  try {
    const actor = await requireAdminAuth()

    const existingMedia = await prisma.media.findUnique({
      where: { id },
    })

    if (!existingMedia) {
      return { success: false, error: '媒體不存在' }
    }

    if (!canManageMedia(actor, existingMedia)) {
      return { success: false, error: '沒有此媒體的管理權限' }
    }

    const media = await prisma.media.update({
      where: { id },
      data: {
        ...(data.filename && { filename: data.filename }),
        ...(data.originalName && { originalName: data.originalName }),
        ...(data.mimeType && { mimeType: data.mimeType }),
        ...(data.size && { size: data.size }),
        ...(data.url && { url: data.url }),
        ...(data.cfStreamId !== undefined && { cfStreamId: data.cfStreamId }),
        ...(data.cfStatus !== undefined && { cfStatus: data.cfStatus }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.thumbnail !== undefined && { thumbnail: data.thumbnail }),
        ...(data.sourceType !== undefined && { sourceType: data.sourceType }),
        ...(data.sourceId !== undefined && { sourceId: data.sourceId }),
        ...(data.sourceLabel !== undefined && { sourceLabel: data.sourceLabel }),
        ...(data.sourceUrl !== undefined && { sourceUrl: data.sourceUrl }),
        ...(data.allowDownload !== undefined && { allowDownload: data.allowDownload }),
        ...(data.dynamicWatermarkEnabled !== undefined && {
          dynamicWatermarkEnabled: data.dynamicWatermarkEnabled,
        }),
        ...(data.watermarkConfig !== undefined && { watermarkConfig: data.watermarkConfig }),
      },
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')
    revalidatePath('/admin/media/images')
    revalidatePath('/admin/media/attachments')

    return { success: true, media }
  } catch (error) {
    console.error('更新媒體記錄失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新媒體記錄時發生錯誤' }
  }
}

export async function updatePdfSecuritySettings(
  id: string,
  data: {
    allowDownload?: boolean
    dynamicWatermarkEnabled?: boolean
  }
): Promise<{ success: boolean; media?: Media; error?: string }> {
  try {
    const admin = await requireAdminAuth()

    const media = await prisma.media.findUnique({
      where: { id },
    })

    if (!media) {
      return { success: false, error: '媒體不存在' }
    }

    if (!canManageMedia(admin, media)) {
      return { success: false, error: '沒有此媒體的管理權限' }
    }

    if (media.type !== 'ATTACHMENT' || media.mimeType !== 'application/pdf') {
      return { success: false, error: '只有 PDF 文件可以設定閱讀權限' }
    }

    const updatedMedia = await prisma.media.update({
      where: { id },
      data: {
        ...(data.allowDownload !== undefined && { allowDownload: data.allowDownload }),
        ...(data.dynamicWatermarkEnabled !== undefined && {
          dynamicWatermarkEnabled: data.dynamicWatermarkEnabled,
        }),
      },
    })

    await prisma.adminLog.create({
      data: {
        adminId: admin.id,
        action: 'UPDATE_SETTINGS',
        targetType: 'Media',
        targetId: id,
        details: {
          settingType: 'PDF_SECURITY',
          allowDownload: updatedMedia.allowDownload,
          dynamicWatermarkEnabled: updatedMedia.dynamicWatermarkEnabled,
        },
      },
    })

    revalidatePath('/admin/media')
    revalidatePath('/admin/media/attachments')

    return { success: true, media: updatedMedia }
  } catch (error) {
    console.error('更新 PDF 安全設定失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '更新 PDF 安全設定時發生錯誤' }
  }
}

/**
 * 重新命名媒體
 */
export async function renameMedia(
  id: string,
  newName: string
): Promise<{ success: boolean; media?: Media; error?: string }> {
  try {
    const actor = await requireAdminAuth()

    if (!newName.trim()) {
      return { success: false, error: '名稱不能為空' }
    }

    const existingMedia = await prisma.media.findUnique({ where: { id } })
    if (!existingMedia) {
      return { success: false, error: '媒體不存在' }
    }
    if (!canManageMedia(actor, existingMedia)) {
      return { success: false, error: '沒有此媒體的管理權限' }
    }

    const media = await prisma.media.update({
      where: { id },
      data: { originalName: newName.trim() },
    })

    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')
    revalidatePath('/admin/media/images')

    return { success: true, media }
  } catch (error) {
    console.error('重新命名媒體失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '重新命名媒體時發生錯誤' }
  }
}

/**
 * 檢查影片是否被課程單元使用中
 * 根據 cfStreamId 查找所有引用該影片的 Lesson
 */
export async function checkMediaUsage(
  id: string
): Promise<{
  success: boolean
  usages?: { lessonId: string; lessonTitle: string; chapterTitle: string; courseTitle: string }[]
  error?: string
}> {
  try {
    await requireAdminAuth()

    const media = await prisma.media.findUnique({ where: { id } })
    if (!media) return { success: false, error: '媒體不存在' }

    // 影片才需要檢查（圖片不追蹤使用情況）；依 cfStreamId／bunnyVideoId 何者存在分流查詢
    if (media.type !== 'VIDEO' || (!media.cfStreamId && !media.bunnyVideoId)) {
      return { success: true, usages: [] }
    }

    const lessons = await prisma.lesson.findMany({
      where: media.cfStreamId
        ? {
            OR: [
              { videoId: media.cfStreamId },
              {
                videoProvider: 'CLOUDFLARE',
                videoSourceId: media.cfStreamId,
              },
            ],
          }
        : {
            videoProvider: 'BUNNY',
            videoSourceId: media.bunnyVideoId,
          },
      select: {
        id: true,
        title: true,
        chapter: {
          select: {
            title: true,
            course: {
              select: { title: true },
            },
          },
        },
      },
    })

    return {
      success: true,
      usages: lessons.map((l) => ({
        lessonId: l.id,
        lessonTitle: l.title,
        chapterTitle: l.chapter.title,
        courseTitle: l.chapter.course.title,
      })),
    }
  } catch (error) {
    console.error('檢查媒體使用情況失敗:', error)
    return { success: false, error: '檢查使用情況時發生錯誤' }
  }
}

/**
 * 刪除媒體
 * 注意：此操作會先刪除外部儲存，成功後再刪除資料庫記錄
 * 若外部儲存刪除失敗，整個操作將中止以避免產生孤兒資源
 */
export async function deleteMedia(
  id: string,
  options?: { forceDeleteDb?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireAdminAuth()

    // 取得媒體資訊
    const media = await prisma.media.findUnique({
      where: { id },
    })

    if (!media) {
      return { success: false, error: '媒體不存在' }
    }

    // 講師只能刪除自己上傳的媒體，避免刪到其他講師課程使用中的影片/附件
    if (!canManageMedia(actor, media)) {
      return { success: false, error: '沒有此媒體的管理權限' }
    }

    if (media.type === 'IMAGE') {
      const usages = await findImageUsages(media.url)
      if (usages.length > 0 && !options?.forceDeleteDb) {
        const usageSummary = usages.slice(0, 3).map((usage) => usage.label).join('、')
        const suffix = usages.length > 3 ? ` 等 ${usages.length} 處` : ''
        return {
          success: false,
          error: `圖片仍被使用中，無法刪除：${usageSummary}${suffix}`,
        }
      }
    }

    // 根據類型刪除實際檔案（必須先成功才能刪除資料庫記錄）
    if (media.type === 'VIDEO' && media.cfStreamId) {
      // 刪除 Cloudflare Stream 影片
      const deleteResult = await deleteStreamVideo(media.cfStreamId)
      if (!deleteResult.success) {
        console.error('刪除 Stream 影片失敗:', deleteResult.error)
        // 如果不是強制刪除，中止操作
        if (!options?.forceDeleteDb) {
          return {
            success: false,
            error: `刪除外部儲存失敗: ${deleteResult.error}。如需強制刪除資料庫記錄，請聯繫管理員。`
          }
        }
      }
    } else if (media.type === 'IMAGE' || media.type === 'ATTACHMENT') {
      // 刪除圖片/附件對應的 storage object
      const storageRef = await getStorageObjectRefFromUrl(media.url)
      if (storageRef) {
        const deleteResult = await deleteStorageObject(storageRef.key, storageRef.driver)
        if (!deleteResult.success) {
          console.error('刪除 storage object 失敗:', deleteResult.error)
          // 如果不是強制刪除，中止操作
          if (!options?.forceDeleteDb) {
            return {
              success: false,
              error: `刪除外部儲存失敗: ${deleteResult.error}。如需強制刪除資料庫記錄，請聯繫管理員。`
            }
          }
        }
      }
    }

    // 外部儲存刪除成功後，刪除資料庫記錄
    await prisma.media.delete({
      where: { id },
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')
    revalidatePath('/admin/media/images')

    return { success: true }
  } catch (error) {
    console.error('刪除媒體失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '刪除媒體時發生錯誤' }
  }
}

/**
 * 批量刪除媒體
 */
export async function deleteMediaBatch(
  ids: string[]
): Promise<{ success: boolean; error?: string; failedIds?: string[] }> {
  try {
    await requireAdminAuth()

    const failedIds: string[] = []

    for (const id of ids) {
      const result = await deleteMedia(id)
      if (!result.success) {
        failedIds.push(id)
      }
    }

    if (failedIds.length > 0) {
      return {
        success: false,
        error: `部分媒體刪除失敗`,
        failedIds,
      }
    }

    return { success: true }
  } catch (error) {
    console.error('批量刪除媒體失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '批量刪除媒體時發生錯誤' }
  }
}

/**
 * 同步影片資訊（從 Cloudflare Stream 取得最新的 duration 和 status）
 */
export async function syncMediaInfo(
  id: string
): Promise<{ success: boolean; media?: Media; error?: string }> {
  try {
    const actor = await requireAdminAuth()

    const media = await prisma.media.findUnique({
      where: { id },
    })

    if (!media) {
      return { success: false, error: '媒體不存在' }
    }

    if (!canManageMedia(actor, media)) {
      return { success: false, error: '沒有此媒體的管理權限' }
    }

    if (media.type !== 'VIDEO' || !media.cfStreamId) {
      return { success: false, error: '只有 Cloudflare Stream 影片可以同步' }
    }

    // 從 Cloudflare 取得影片資訊
    const videoInfo = await getStreamVideoInfo(media.cfStreamId)

    if (!videoInfo) {
      return { success: false, error: '無法從 Cloudflare 取得影片資訊' }
    }

    // 更新媒體記錄
    const updatedMedia = await prisma.media.update({
      where: { id },
      data: {
        cfStatus: videoInfo.status?.state || media.cfStatus,
        duration: videoInfo.duration ? Math.round(videoInfo.duration) : media.duration,
      },
    })

    // 重新驗證頁面快取
    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')

    return { success: true, media: updatedMedia }
  } catch (error) {
    console.error('同步媒體資訊失敗:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '同步媒體資訊時發生錯誤' }
  }
}

/**
 * 批量同步所有缺少 duration 的影片
 */
export async function syncAllPendingMedia(): Promise<{
  success: boolean
  syncedCount: number
  failedCount: number
  error?: string
}> {
  try {
    const actor = await requireAdminAuth()

    // 找出所有缺少 duration 的影片（講師僅同步自己上傳的）
    const pendingMedia = await prisma.media.findMany({
      where: {
        type: 'VIDEO',
        cfStreamId: { not: null },
        ...(isFullAdmin(actor.role) ? {} : { uploadedBy: actor.id }),
        OR: [
          { duration: null },
          { cfStatus: { not: 'ready' } },
        ],
      },
    })

    let syncedCount = 0
    let failedCount = 0

    for (const media of pendingMedia) {
      if (!media.cfStreamId) continue

      const videoInfo = await getStreamVideoInfo(media.cfStreamId)

      if (videoInfo) {
        await prisma.media.update({
          where: { id: media.id },
          data: {
            cfStatus: videoInfo.status?.state || media.cfStatus,
            duration: videoInfo.duration ? Math.round(videoInfo.duration) : media.duration,
          },
        })
        syncedCount++
      } else {
        failedCount++
      }
    }

    // 重新驗證頁面快取
    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')

    return { success: true, syncedCount, failedCount }
  } catch (error) {
    console.error('批量同步媒體資訊失敗:', error)

    if (error instanceof Error) {
      return { success: false, syncedCount: 0, failedCount: 0, error: error.message }
    }

    return { success: false, syncedCount: 0, failedCount: 0, error: '批量同步媒體資訊時發生錯誤' }
  }
}

/**
 * 取得媒體統計
 */
export async function getMediaStats(): Promise<{
  totalVideos: number
  totalImages: number
  totalAttachments: number
  totalSize: number
}> {
  const actor = await requireAdminAuth()

  // 講師統計僅涵蓋自己上傳的媒體
  const ownerScope: Prisma.MediaWhereInput = isFullAdmin(actor.role)
    ? {}
    : { uploadedBy: actor.id }

  const [videoStats, imageStats, attachmentStats] = await Promise.all([
    prisma.media.aggregate({
      where: { ...ownerScope, type: 'VIDEO' },
      _count: true,
      _sum: { size: true },
    }),
    prisma.media.aggregate({
      where: { ...ownerScope, type: 'IMAGE' },
      _count: true,
      _sum: { size: true },
    }),
    prisma.media.aggregate({
      where: { ...ownerScope, type: 'ATTACHMENT' },
      _count: true,
      _sum: { size: true },
    }),
  ])

  return {
    totalVideos: videoStats._count,
    totalImages: imageStats._count,
    totalAttachments: attachmentStats._count,
    totalSize:
      (videoStats._sum.size || 0) +
      (imageStats._sum.size || 0) +
      (attachmentStats._sum.size || 0),
  }
}
