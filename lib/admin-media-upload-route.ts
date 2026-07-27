import { NextRequest, NextResponse } from 'next/server'
import type { MediaSourceType, MediaType } from '@prisma/client'
import type { createMedia } from '@/lib/actions/media'
import type {
  getMediaUploadTarget,
  getPublicUrlForStorageKey,
  getStorageSettings,
  writeLocalUpload,
} from '@/lib/storage'

type SessionLike =
  | {
      user?: {
        role?: string | null
      } | null
    }
  | null
  | undefined

export interface UploadRouteDeps {
  auth: () => Promise<SessionLike>
  createMedia: typeof createMedia
  getMediaUploadTarget: typeof getMediaUploadTarget
  getStorageSettings: typeof getStorageSettings
  writeLocalUpload: typeof writeLocalUpload
  getPublicUrlForStorageKey: typeof getPublicUrlForStorageKey
}

function buildUnauthorizedResponse() {
  return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
}

function buildForbiddenResponse() {
  return NextResponse.json({ success: false, error: '權限不足' }, { status: 403 })
}

export async function requireAdminSessionWithDeps(deps: UploadRouteDeps) {
  const session = await deps.auth()

  if (!session?.user) {
    return buildUnauthorizedResponse()
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'INSTRUCTOR' && session.user.role !== 'EDITOR') {
    return buildForbiddenResponse()
  }

  return null
}

export function createUploadRouteHandlers(deps: UploadRouteDeps) {
  return {
    async GET(request: NextRequest) {
      const authError = await requireAdminSessionWithDeps(deps)
      if (authError) return authError

      const searchParams = request.nextUrl.searchParams
      const filename = searchParams.get('filename')
      const mimeType = searchParams.get('mimeType')

      if (!filename || !mimeType) {
        return NextResponse.json({ success: false, error: '缺少必要參數' }, { status: 400 })
      }

      const target = await deps.getMediaUploadTarget(filename, mimeType)

      if (!target.success) {
        return NextResponse.json(
          { success: false, error: target.error || '取得上傳資訊失敗' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        uploadUrl: target.uploadUrl,
        key: target.key,
        driver: target.driver,
      })
    },

    async PUT(request: NextRequest) {
      const authError = await requireAdminSessionWithDeps(deps)
      if (authError) return authError

      const settings = await deps.getStorageSettings()
      if (settings.driver !== 'local') {
        return NextResponse.json(
          { success: false, error: '目前儲存方案不是 local storage' },
          { status: 400 }
        )
      }

      const key = request.nextUrl.searchParams.get('key')
      if (!key) {
        return NextResponse.json({ success: false, error: '缺少 storage key' }, { status: 400 })
      }

      const body = Buffer.from(await request.arrayBuffer())
      const result = await deps.writeLocalUpload(key, body)

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 })
      }

      return new NextResponse(null, { status: 200 })
    },

    async POST(request: NextRequest) {
      const authError = await requireAdminSessionWithDeps(deps)
      if (authError) return authError

      const body = await request.json()
      const {
        key,
        originalName,
        mimeType,
        size,
        type,
        sourceType,
        sourceId,
        sourceLabel,
        sourceUrl,
        allowDownload,
        dynamicWatermarkEnabled,
      } = body as {
        key: string
        originalName: string
        mimeType: string
        size: number
        type?: MediaType
        sourceType?: MediaSourceType
        sourceId?: string | null
        sourceLabel?: string | null
        sourceUrl?: string | null
        allowDownload?: boolean
        dynamicWatermarkEnabled?: boolean
      }

      if (!key || !originalName || !mimeType || !size) {
        return NextResponse.json({ success: false, error: '缺少必要參數' }, { status: 400 })
      }

      let mediaType: MediaType = type || 'ATTACHMENT'
      if (!type) {
        mediaType = mimeType.startsWith('image/') ? 'IMAGE' : 'ATTACHMENT'
      }

      if (mediaType === 'IMAGE' && !mimeType.startsWith('image/')) {
        return NextResponse.json({ success: false, error: '圖片類型必須搭配 image MIME' }, { status: 400 })
      }

      const maxSize = mediaType === 'IMAGE' ? 10 * 1024 * 1024 : 50 * 1024 * 1024
      if (size > maxSize) {
        return NextResponse.json(
          {
            success: false,
            error: `檔案大小超過限制 (${mediaType === 'IMAGE' ? '10MB' : '50MB'})`,
          },
          { status: 400 }
        )
      }

      const url = await deps.getPublicUrlForStorageKey(key)

      const mediaResult = await deps.createMedia({
        type: mediaType,
        filename: key,
        originalName,
        mimeType,
        size,
        url,
        sourceType: sourceType ?? 'MANUAL',
        sourceId: sourceId ?? null,
        sourceLabel: sourceLabel ?? null,
        sourceUrl: sourceUrl ?? null,
        allowDownload: allowDownload ?? true,
        dynamicWatermarkEnabled: dynamicWatermarkEnabled ?? false,
      })

      if (!mediaResult.success) {
        return NextResponse.json({ success: false, error: mediaResult.error }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        media: mediaResult.media,
        url,
      })
    },
  }
}
