jest.mock('@/lib/prisma', () => ({
  prisma: {
    media: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/bunny-stream-config', () => ({
  getBunnyStreamConfig: jest.fn(),
}))

jest.mock('@/lib/bunny', () => ({
  getVideoPlayData: jest.fn(),
}))

import { POST } from '@/app/api/webhooks/bunny-stream/route'
import { prisma } from '@/lib/prisma'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'
import { getVideoPlayData } from '@/lib/bunny'
import { createBunnyWebhookSignature } from '@/lib/bunny-playback'

const mockedPrisma = prisma as unknown as {
  media: { findUnique: jest.Mock; update: jest.Mock }
}
const mockedGetBunnyStreamConfig = getBunnyStreamConfig as jest.Mock
const mockedGetVideoPlayData = getVideoPlayData as jest.Mock

const API_KEY = 'library-api-key'
const READ_ONLY_API_KEY = 'read-only-api-key'

function buildSignedRequest(
  payload: Record<string, unknown>,
  overrides?: { contentLength?: string; signingKey?: string }
) {
  const rawBody = JSON.stringify(payload)
  const signature = createBunnyWebhookSignature(overrides?.signingKey ?? READ_ONLY_API_KEY, rawBody)
  const headers: Record<string, string> = {
    'X-BunnyStream-Signature': signature,
    'content-length': overrides?.contentLength ?? String(Buffer.byteLength(rawBody)),
  }
  return new Request('https://realms.test/api/webhooks/bunny-stream', {
    method: 'POST',
    headers,
    body: rawBody,
  })
}

describe('POST /api/webhooks/bunny-stream', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetBunnyStreamConfig.mockResolvedValue({
      libraryId: 'lib_1',
      apiKey: API_KEY,
      readOnlyApiKey: READ_ONLY_API_KEY,
    })
  })

  it('readOnlyApiKey 簽名正確時接受請求並處理狀態更新', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_valid',
      bunnyStatus: 'processing',
      thumbnail: null,
      duration: null,
    })

    const request = buildSignedRequest({ VideoGuid: 'guid-valid', Status: 4, Length: 90 })
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(mockedPrisma.media.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bunnyStatus: 'ready', duration: 90 }),
      })
    )
  })

  it('簽名錯誤時回應 401 且不處理狀態更新', async () => {
    const request = buildSignedRequest(
      { VideoGuid: 'guid-wrong-sig', Status: 4, Length: 90 },
      { signingKey: 'wrong-key' }
    )
    const response = await POST(request as never)

    expect(response.status).toBe(401)
    expect(mockedPrisma.media.findUnique).not.toHaveBeenCalled()
  })

  it('readOnlyApiKey 未設定時直接拒絕，不回退用 apiKey 驗證', async () => {
    mockedGetBunnyStreamConfig.mockResolvedValue({
      libraryId: 'lib_1',
      apiKey: API_KEY,
      readOnlyApiKey: '',
    })
    // 故意用 apiKey 簽名，證明即使簽名剛好對得上 apiKey，未設定 readOnlyApiKey 也一律拒絕。
    const request = buildSignedRequest(
      { VideoGuid: 'guid-no-key', Status: 4, Length: 90 },
      { signingKey: API_KEY }
    )
    const response = await POST(request as never)

    expect(response.status).toBe(401)
    expect(mockedPrisma.media.findUnique).not.toHaveBeenCalled()
  })

  it('payload 已帶 Length 時不應呼叫 getVideoPlayData', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_1',
      bunnyStatus: 'processing',
      thumbnail: null,
      duration: null,
    })

    const request = buildSignedRequest({ VideoGuid: 'guid-1', Status: 4, Length: 90 })
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(mockedGetVideoPlayData).not.toHaveBeenCalled()
    expect(mockedPrisma.media.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bunnyStatus: 'ready', duration: 90 }),
      })
    )
  })

  it('Length 與 duration 皆缺席時才呼叫 getVideoPlayData 補查', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_2',
      bunnyStatus: 'processing',
      thumbnail: null,
      duration: null,
    })
    mockedGetVideoPlayData.mockResolvedValue({
      success: true,
      status: 200,
      video: { status: 4, length: 120, thumbnailUrl: 'https://cdn.test/thumb.jpg' },
    })

    const request = buildSignedRequest({ VideoGuid: 'guid-2', Status: 4 })
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(mockedGetVideoPlayData).toHaveBeenCalledWith('lib_1', API_KEY, 'guid-2')
    expect(mockedPrisma.media.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bunnyStatus: 'ready',
          duration: 120,
          thumbnail: 'https://cdn.test/thumb.jpg',
        }),
      })
    )
  })

  it('重複回呼且算出的新值與現有 media 記錄完全相同時不觸發 update（冪等）', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_3',
      bunnyStatus: 'ready',
      thumbnail: 'https://cdn.test/thumb.jpg',
      duration: 90,
    })

    const request = buildSignedRequest({ VideoGuid: 'guid-3', Status: 4, Length: 90 })
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(mockedPrisma.media.update).not.toHaveBeenCalled()
  })

  it('findUnique 只選取必要欄位（id／bunnyStatus／thumbnail／duration）', async () => {
    mockedPrisma.media.findUnique.mockResolvedValue({
      id: 'media_4',
      bunnyStatus: 'ready',
      thumbnail: 'https://cdn.test/thumb.jpg',
      duration: 90,
    })

    const request = buildSignedRequest({ VideoGuid: 'guid-4', Status: 4, Length: 90 })
    await POST(request as never)

    expect(mockedPrisma.media.findUnique).toHaveBeenCalledWith({
      where: { bunnyVideoId: 'guid-4' },
      select: { id: true, bunnyStatus: true, thumbnail: true, duration: true },
    })
  })

  it('Content-Length 超過 8KB 門檻時回應 413 且不解析 body', async () => {
    const request = buildSignedRequest(
      { VideoGuid: 'guid-5', Status: 4, Length: 90 },
      { contentLength: String(8 * 1024 + 1) }
    )

    const response = await POST(request as never)

    expect(response.status).toBe(413)
    expect(mockedPrisma.media.findUnique).not.toHaveBeenCalled()
  })
})
