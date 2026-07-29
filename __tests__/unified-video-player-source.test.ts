import {
  resolveClientVideoSource,
  resolveStudentVideoSource,
} from '@/lib/unified-video-player'

describe('統一播放器來源解析', () => {
  it('YouTube 與 Vimeo 直接在前端組來源，不呼叫 fetch', () => {
    const originalFetch = global.fetch
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as typeof fetch

    expect(resolveClientVideoSource({ videoProvider: 'youtube', videoSourceId: 'abc123' })).toBe(
      'youtube/abc123'
    )
    expect(resolveClientVideoSource({ videoProvider: 'vimeo', videoSourceId: '987654' })).toBe(
      'vimeo/987654'
    )
    expect(
      resolveClientVideoSource({
        videoProvider: 'vimeo',
        videoSourceId: '123456789',
        videoUrl: 'https://vimeo.com/123456789/abcdef',
      }),
    ).toBe('vimeo/123456789?h=abcdef')
    expect(
      resolveClientVideoSource({
        videoProvider: 'vimeo',
        videoSourceId: '123456789',
        videoUrl: 'https://vimeo.com/123456789',
      }),
    ).toBe('vimeo/123456789')
    expect(fetchSpy).not.toHaveBeenCalled()

    global.fetch = originalFetch
  })

  it('學生模式的 Cloudflare 與 Bunny 透過既有學生 API 取得來源', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          signedUrl: 'cf-signed-token',
          customerCode: 'test-customer',
        }),
        { status: 200 },
      ),
    )

    await expect(
      resolveStudentVideoSource({
        lessonId: 'lesson-1',
        videoProvider: 'cloudflare',
        videoSourceId: 'video-1',
      }),
    ).resolves.toBe(
      'https://customer-test-customer.cloudflarestream.com/video-1/manifest/video.m3u8?token=cf-signed-token',
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/lesson/stream-url',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ lessonId: 'lesson-1', videoId: 'video-1' }),
      }),
    )
    fetchSpy.mockRestore()
  })
})
