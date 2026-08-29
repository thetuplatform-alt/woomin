import { GET } from '@/app/api/cron/cloudflare-stream-sync/route'
import { getCloudflareStreamConfigStatus } from '@/lib/cloudflare-stream-config'
import { syncCloudflareStreamLibrary } from '@/lib/cloudflare-stream-sync'

jest.mock('@/lib/cloudflare-stream-config', () => ({
  getCloudflareStreamConfigStatus: jest.fn(),
}))

jest.mock('@/lib/cloudflare-stream-sync', () => ({
  syncCloudflareStreamLibrary: jest.fn(),
}))

describe('Cloudflare Stream sync cron route', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    process.env.CRON_SECRET = 'cron_secret_123'
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  it('未設定 Cloudflare Stream 時安全跳過，不執行同步或記錄錯誤', async () => {
    ;(getCloudflareStreamConfigStatus as jest.Mock).mockResolvedValue({
      hasUploadConfig: false,
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await GET(
      new Request('https://realms.test/api/cron/cloudflare-stream-sync', {
        headers: { authorization: 'Bearer cron_secret_123' },
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      skipped: true,
      reason: 'cloudflare_stream_not_configured',
    })
    expect(syncCloudflareStreamLibrary).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('Cloudflare Stream 已設定但同步失敗時維持 500 與錯誤紀錄', async () => {
    ;(getCloudflareStreamConfigStatus as jest.Mock).mockResolvedValue({
      hasUploadConfig: true,
    })
    const syncError = new Error('Cloudflare API unavailable')
    ;(syncCloudflareStreamLibrary as jest.Mock).mockRejectedValue(syncError)
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await GET(
      new Request('https://realms.test/api/cron/cloudflare-stream-sync', {
        headers: { authorization: 'Bearer cron_secret_123' },
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Cloudflare API unavailable',
    })
    expect(syncCloudflareStreamLibrary).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('[Cron Cloudflare Sync] 同步失敗:', syncError)

    errorSpy.mockRestore()
  })
})
