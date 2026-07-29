jest.mock('@/lib/require-admin', () => ({
  requireOnlyAdminAuth: jest.fn(),
}))

jest.mock('@/lib/cloudflare', () => ({
  generateSignedStreamToken: jest.fn(),
}))

jest.mock('@/lib/bunny-stream-config', () => ({
  getBunnyStreamConfig: jest.fn(),
}))

jest.mock('@/lib/bunny-playback', () => ({
  bunnyPlaybackExpiry: jest.fn(() => 1_800_000_000),
  createBunnyPlaybackToken: jest.fn(() => 'bunny-token'),
}))

import { POST } from '@/app/api/admin/lesson/video-preview/route'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { generateSignedStreamToken } from '@/lib/cloudflare'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'

const mockedRequireOnlyAdminAuth = requireOnlyAdminAuth as jest.Mock
const mockedGenerateSignedStreamToken = generateSignedStreamToken as jest.Mock
const mockedGetBunnyStreamConfig = getBunnyStreamConfig as jest.Mock

function buildRequest(body: Record<string, unknown>) {
  return new Request('https://realms.test/api/admin/lesson/video-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/lesson/video-preview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('管理員可預覽尚未存進 lesson 的 Bunny 影片', async () => {
    mockedRequireOnlyAdminAuth.mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
    mockedGetBunnyStreamConfig.mockResolvedValue({ libraryId: 'lib_1', apiKey: 'key_1' })

    const response = await POST(
      buildRequest({ videoProvider: 'bunny', videoSourceId: 'never-saved-bunny-id' }) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.src).toContain('https://iframe.mediadelivery.net/embed/lib_1/never-saved-bunny-id')
  })

  it('非管理員不可取得任何播放來源', async () => {
    mockedRequireOnlyAdminAuth.mockRejectedValue(new Error('權限不足'))

    const response = await POST(
      buildRequest({ videoProvider: 'bunny', videoSourceId: 'never-saved-bunny-id' }) as never
    )
    const body = await response.json()

    expect([401, 403]).toContain(response.status)
    expect(body.src).toBeUndefined()
  })

  it('管理員預覽 Cloudflare 影片不查 lesson，直接回傳可播放來源', async () => {
    mockedRequireOnlyAdminAuth.mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
    mockedGenerateSignedStreamToken.mockResolvedValue({
      videoId: 'never-saved-cf-id',
      token: 'cf-token',
      customerCode: 'customer-test',
    })

    const response = await POST(
      buildRequest({ videoProvider: 'cloudflare', videoSourceId: 'never-saved-cf-id' }) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      src: 'https://customer-customer-test.cloudflarestream.com/never-saved-cf-id/manifest/video.m3u8?token=cf-token',
    })
    expect(mockedGenerateSignedStreamToken).toHaveBeenCalledWith('never-saved-cf-id', 7200)
  })
})
