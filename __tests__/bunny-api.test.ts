import { createVideo, deleteVideo, getVideoPlayData, testLibraryConnection } from '@/lib/bunny'

describe('Bunny Stream API wrapper', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  it.each([
    [200, true],
    [401, false],
    [404, false],
  ])('maps library connection HTTP %i to success=%s', async (status, success) => {
    fetchMock.mockResolvedValue({ ok: status === 200, status, json: async () => ({}) })
    await expect(testLibraryConnection('416184', 'api-key')).resolves.toMatchObject({
      success,
      status,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://video.bunnycdn.com/library/416184',
      expect.objectContaining({ headers: { AccessKey: 'api-key' } })
    )
  })

  it('creates a video and returns the Bunny video id', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ guid: 'video-guid' }) })
    await expect(createVideo('416184', 'api-key', 'lesson.mp4')).resolves.toEqual({
      success: true,
      videoId: 'video-guid',
    })
  })

  it('deletes a video and reports API errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    await expect(deleteVideo('416184', 'api-key', 'video-guid')).resolves.toMatchObject({
      success: false,
      status: 404,
    })
  })

  it('reads Bunny playback metadata including the thumbnail URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ video: { status: 4, length: 53, thumbnailUrl: 'https://cdn.test/thumb.jpg' } }),
    })
    await expect(getVideoPlayData('416184', 'api-key', 'video-guid')).resolves.toMatchObject({
      success: true,
      video: { status: 4, length: 53, thumbnailUrl: 'https://cdn.test/thumb.jpg' },
    })
  })

  it.each([
    ['testLibraryConnection', () => testLibraryConnection('416184', 'api-key')],
    ['createVideo', () => createVideo('416184', 'api-key', 'lesson.mp4')],
    ['deleteVideo', () => deleteVideo('416184', 'api-key', 'video-guid')],
    ['getVideoPlayData', () => getVideoPlayData('416184', 'api-key', 'video-guid')],
  ])('%s 呼叫 fetch 時帶上 15 秒逾時的 AbortSignal', async (_name, call) => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ guid: 'video-guid' }) })
    await call()
    const options = fetchMock.mock.calls[0][1]
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    ['testLibraryConnection', () => testLibraryConnection('416184', 'api-key')],
    ['createVideo', () => createVideo('416184', 'api-key', 'lesson.mp4')],
    ['deleteVideo', () => deleteVideo('416184', 'api-key', 'video-guid')],
    ['getVideoPlayData', () => getVideoPlayData('416184', 'api-key', 'video-guid')],
  ])('%s 在逾時（fetch 拒絕）時回傳明確錯誤，不拋出例外', async (_name, call) => {
    const timeoutError = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    })
    fetchMock.mockRejectedValue(timeoutError)
    await expect(call()).resolves.toMatchObject({ success: false })
  })
})
