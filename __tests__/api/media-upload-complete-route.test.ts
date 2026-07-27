jest.mock('@/lib/require-admin', () => ({
  requireAdminAuth: jest.fn(),
}))

jest.mock('@/lib/course-permissions', () => ({
  isFullAdmin: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    media: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock('@/lib/cloudflare', () => ({
  getStreamVideoErrorMessage: jest.fn(),
  getStreamVideoInfo: jest.fn(),
  getStreamThumbnailUrl: jest.fn(),
}))

jest.mock('@/lib/cloudflare-stream-sync', () => ({
  ensureStreamSyncScheduled: jest.fn(),
}))

jest.mock('@/lib/bunny', () => ({
  getVideoPlayData: jest.fn(),
}))

jest.mock('@/lib/bunny-stream-config', () => ({
  getBunnyStreamConfig: jest.fn(),
}))

import { POST } from '@/app/api/admin/media/upload-complete/route'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'
import { getVideoPlayData } from '@/lib/bunny'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'

const mockedPrisma = prisma as unknown as {
  media: { findUnique: jest.Mock; upsert: jest.Mock }
}
const mockedRequireAdminAuth = requireAdminAuth as jest.Mock
const mockedIsFullAdmin = isFullAdmin as unknown as jest.Mock
const mockedGetVideoPlayData = getVideoPlayData as jest.Mock
const mockedGetBunnyStreamConfig = getBunnyStreamConfig as jest.Mock

function buildRequest(body: Record<string, unknown>) {
  return new Request('https://realms.test/api/admin/media/upload-complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/media/upload-complete — Bunny 影片 URL 格式', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAdminAuth.mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
    mockedIsFullAdmin.mockReturnValue(true)
    mockedPrisma.media.findUnique.mockResolvedValue(null)
    mockedGetBunnyStreamConfig.mockResolvedValue({ libraryId: 'lib_1', apiKey: 'key_1' })
    mockedGetVideoPlayData.mockResolvedValue({ success: true, status: 200, video: {} })
    mockedPrisma.media.upsert.mockImplementation(({ create }: { create: Record<string, unknown> }) =>
      Promise.resolve({ id: 'media_1', ...create })
    )
  })

  it('儲存的 Media.url 同時包含 libraryId 與 videoId 兩段路徑', async () => {
    const response = await POST(
      buildRequest({ provider: 'bunny', videoId: 'video-guid-1', originalName: 'lesson.mp4', size: 1000 }) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.media.url).toBe('https://iframe.mediadelivery.net/embed/lib_1/video-guid-1')
    expect(mockedPrisma.media.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          url: 'https://iframe.mediadelivery.net/embed/lib_1/video-guid-1',
        }),
      })
    )
  })
})
