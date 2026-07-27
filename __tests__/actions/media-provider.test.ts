import { getMediaList, checkMediaUsage } from '@/lib/actions/media'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    media: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    lesson: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/require-admin', () => ({
  requireAdminAuth: jest.fn(),
}))

jest.mock('@/lib/course-permissions', () => ({
  isFullAdmin: jest.fn(),
}))

jest.mock('@/lib/cloudflare', () => ({
  deleteStreamVideo: jest.fn(),
  getStreamVideoInfo: jest.fn(),
}))

jest.mock('@/lib/storage', () => ({
  deleteStorageObject: jest.fn(),
  getStorageObjectRefFromUrl: jest.fn(),
}))

const mockedPrisma = prisma as unknown as {
  media: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock }
  lesson: { findMany: jest.Mock }
}
const mockedRequireAdminAuth = requireAdminAuth as jest.Mock
const mockedIsFullAdmin = isFullAdmin as unknown as jest.Mock

describe('getMediaList 依 provider 篩選', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAdminAuth.mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
    mockedIsFullAdmin.mockReturnValue(true)
    mockedPrisma.media.count.mockResolvedValue(0)
    mockedPrisma.media.findMany.mockResolvedValue([])
  })

  it('provider=bunny 時只查詢 bunnyVideoId 非空的媒體', async () => {
    await getMediaList({ provider: 'bunny' })

    const where = mockedPrisma.media.findMany.mock.calls[0][0].where
    expect(where.bunnyVideoId).toEqual({ not: null })
    expect(where.cfStreamId).toBeUndefined()
  })

  it('provider=cloudflare 時只查詢 cfStreamId 非空的媒體', async () => {
    await getMediaList({ provider: 'cloudflare' })

    const where = mockedPrisma.media.findMany.mock.calls[0][0].where
    expect(where.cfStreamId).toEqual({ not: null })
    expect(where.bunnyVideoId).toBeUndefined()
  })

  it('未指定 provider 時不加上任何 provider 篩選條件', async () => {
    await getMediaList({})

    const where = mockedPrisma.media.findMany.mock.calls[0][0].where
    expect(where.cfStreamId).toBeUndefined()
    expect(where.bunnyVideoId).toBeUndefined()
  })
})

describe('checkMediaUsage 涵蓋所有 provider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAdminAuth.mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
  })

  it('被課程引用的 Bunny 影片刪除時回傳對應 usages', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_1',
      type: 'VIDEO',
      cfStreamId: null,
      bunnyVideoId: 'bunny-guid-1',
    })
    mockedPrisma.lesson.findMany.mockResolvedValue([
      {
        id: 'lesson_1',
        title: '單元一',
        chapter: { title: '章節一', course: { title: '課程一' } },
      },
    ])

    const result = await checkMediaUsage('media_1')

    expect(result.success).toBe(true)
    expect(result.usages).toEqual([
      {
        lessonId: 'lesson_1',
        lessonTitle: '單元一',
        chapterTitle: '章節一',
        courseTitle: '課程一',
      },
    ])
    expect(mockedPrisma.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { videoProvider: 'BUNNY', videoSourceId: 'bunny-guid-1' },
      })
    )
  })

  it('未被引用的 Bunny 影片刪除時回傳空陣列', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_2',
      type: 'VIDEO',
      cfStreamId: null,
      bunnyVideoId: 'bunny-guid-2',
    })
    mockedPrisma.lesson.findMany.mockResolvedValue([])

    const result = await checkMediaUsage('media_2')

    expect(result.success).toBe(true)
    expect(result.usages).toEqual([])
  })
})
