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
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/cloudflare', () => ({
  getStreamVideoErrorMessage: jest.fn(),
  getStreamThumbnailUrl: jest.fn(),
  getStreamVideoInfo: jest.fn(),
}))

jest.mock('@/lib/cloudflare-stream-sync', () => ({
  ensureStreamSyncScheduled: jest.fn(),
}))

jest.mock('@/lib/bunny-stream-config', () => ({
  getBunnyStreamConfig: jest.fn(),
}))

jest.mock('@/lib/bunny', () => ({
  getVideoPlayData: jest.fn(),
}))

import { GET } from '@/app/api/admin/media/[id]/status/route'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'
import { getVideoPlayData } from '@/lib/bunny'

const mockedPrisma = prisma as unknown as {
  media: { findUnique: jest.Mock; update: jest.Mock }
}
const mockedRequireAdminAuth = requireAdminAuth as jest.Mock
const mockedIsFullAdmin = isFullAdmin as unknown as jest.Mock
const mockedGetBunnyStreamConfig = getBunnyStreamConfig as jest.Mock
const mockedGetVideoPlayData = getVideoPlayData as jest.Mock

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/admin/media/[id]/status — Bunny 同步行為', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAdminAuth.mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
    mockedIsFullAdmin.mockReturnValue(true)
  })

  it('bunnyStatus 為 processing 時查詢 Bunny 即時狀態並更新資料庫', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_1',
      bunnyVideoId: 'bunny-guid',
      bunnyStatus: 'processing',
      duration: null,
      thumbnail: null,
      size: 100,
      sourceType: 'MANUAL',
      sourceLabel: null,
      uploadedBy: 'admin_1',
    })
    mockedGetBunnyStreamConfig.mockResolvedValue({ libraryId: 'lib_1', apiKey: 'key_1' })
    mockedGetVideoPlayData.mockResolvedValue({
      success: true,
      status: 200,
      video: { status: 4, length: 120, thumbnailUrl: 'https://cdn.test/thumb.jpg' },
    })

    const response = await GET(
      new Request('https://realms.test/api/admin/media/media_1/status') as never,
      buildContext('media_1')
    )
    const body = await response.json()

    expect(mockedGetVideoPlayData).toHaveBeenCalledWith('lib_1', 'key_1', 'bunny-guid')
    expect(mockedPrisma.media.update).toHaveBeenCalledWith({
      where: { id: 'media_1' },
      data: { bunnyStatus: 'ready', duration: 120, thumbnail: 'https://cdn.test/thumb.jpg' },
    })
    expect(body.media.bunnyStatus).toBe('ready')
    expect(body.media.ready).toBe(true)
  })

  it('bunnyStatus 已是 ready 且已有 duration 時直接回傳，不呼叫 Bunny API', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_2',
      bunnyVideoId: 'bunny-guid-2',
      bunnyStatus: 'ready',
      duration: 60,
      thumbnail: 'https://cdn.test/existing.jpg',
      size: 100,
      sourceType: 'MANUAL',
      sourceLabel: null,
      uploadedBy: 'admin_1',
    })

    const response = await GET(
      new Request('https://realms.test/api/admin/media/media_2/status') as never,
      buildContext('media_2')
    )
    const body = await response.json()

    expect(mockedGetVideoPlayData).not.toHaveBeenCalled()
    expect(mockedPrisma.media.update).not.toHaveBeenCalled()
    expect(body.media.ready).toBe(true)
  })
})
