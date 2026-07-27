jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    lesson: { findUnique: jest.fn() },
    media: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/actions/lesson', () => ({
  checkLessonAccess: jest.fn(),
}))

jest.mock('@/lib/cloudflare', () => ({
  generateSignedStreamToken: jest.fn(),
  getStreamThumbnailUrl: jest.fn(),
  getStreamVideoInfo: jest.fn(),
}))

jest.mock('@/lib/cloudflare-stream-sync', () => ({
  ensureStreamSyncScheduled: jest.fn(),
}))

jest.mock('@/lib/bunny-stream-config', () => ({
  getBunnyStreamConfig: jest.fn(),
}))

import { POST } from '@/app/api/lesson/stream-url/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkLessonAccess } from '@/lib/actions/lesson'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'

const mockedAuth = auth as jest.Mock
const mockedPrisma = prisma as unknown as {
  lesson: { findUnique: jest.Mock }
  media: { findUnique: jest.Mock }
}
const mockedCheckLessonAccess = checkLessonAccess as jest.Mock
const mockedGetBunnyStreamConfig = getBunnyStreamConfig as jest.Mock

function buildRequest(body: Record<string, unknown>) {
  return new Request('https://realms.test/api/lesson/stream-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/lesson/stream-url — Bunny 路徑', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAuth.mockResolvedValue({ user: { id: 'user_1' } })
    mockedCheckLessonAccess.mockResolvedValue('granted')
    mockedPrisma.lesson.findUnique.mockResolvedValue({
      videoId: null,
      videoProvider: 'BUNNY',
      videoSourceId: 'bunny-guid',
      videoUrl: null,
      videoThumbnail: null,
      videoDuration: 90,
    })
  })

  it('回傳成功的簽名播放網址（重構後行為不變）', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({ duration: 120 })
    mockedGetBunnyStreamConfig.mockResolvedValue({ libraryId: 'lib_1', apiKey: 'key_1' })

    const response = await POST(
      buildRequest({ lessonId: 'lesson_1', videoId: 'bunny-guid' }) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.signedUrl).toContain('https://iframe.mediadelivery.net/embed/lib_1/bunny-guid')
    expect(mockedPrisma.media.findUnique).toHaveBeenCalledTimes(1)
    expect(mockedGetBunnyStreamConfig).toHaveBeenCalledTimes(1)
  })

  it('media 查詢與 getBunnyStreamConfig 平行執行，不互相等待（Promise.all）', async () => {
    // Gate：兩個查詢都「已經開始呼叫」後才讓兩者一起 resolve。
    // 若實作是循序 await（先 media 再 config），config 永遠不會開始呼叫，
    // media 的 promise 就會卡住不 resolve，測試逾時失敗。
    let startedCount = 0
    const pendingResolvers: Array<() => void> = []
    function registerGate(resolveFn: () => void) {
      startedCount++
      pendingResolvers.push(resolveFn)
      if (startedCount === 2) {
        pendingResolvers.forEach((fn) => fn())
      }
    }

    mockedPrisma.media.findUnique.mockImplementation(
      () => new Promise((resolve) => registerGate(() => resolve({ duration: 120 })))
    )
    mockedGetBunnyStreamConfig.mockImplementation(
      () =>
        new Promise((resolve) =>
          registerGate(() => resolve({ libraryId: 'lib_1', apiKey: 'key_1' }))
        )
    )

    const response = await POST(
      buildRequest({ lessonId: 'lesson_1', videoId: 'bunny-guid' }) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
