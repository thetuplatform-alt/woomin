import { auth } from '@/lib/auth'
import { createMedia } from '@/lib/actions/media'
import {
  getMediaUploadTarget,
  getPublicUrlForStorageKey,
  getStorageSettings,
  writeLocalUpload,
} from '@/lib/storage'
import { createUploadRouteHandlers } from '@/lib/admin-media-upload-route'

export const runtime = 'nodejs'

const handlers = createUploadRouteHandlers({
  auth,
  createMedia,
  getMediaUploadTarget,
  getStorageSettings,
  writeLocalUpload,
  getPublicUrlForStorageKey,
})

export const GET = handlers.GET
export const PUT = handlers.PUT
export const POST = handlers.POST
