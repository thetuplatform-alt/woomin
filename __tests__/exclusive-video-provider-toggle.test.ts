import {
  getCloudVideoProviderFilter,
  getCloudVideoProviderSwitchWarning,
  getMediaUploadProvider,
  getExclusiveCloudVideoProviders,
  preservesLessonVideoProvider,
} from '@/lib/video-provider-policy'

describe('網站層級 Cloud video provider 互斥政策', () => {
  it('Cloudflare 與 Bunny 同時只能有一個生效方案', () => {
    expect(getExclusiveCloudVideoProviders('cloudflare')).toEqual({
      cloudflare: true,
      bunny: false,
    })
    expect(getExclusiveCloudVideoProviders('bunny')).toEqual({
      cloudflare: false,
      bunny: true,
    })
  })

  it('媒體庫只過濾目前生效方案的影片', () => {
    expect(getCloudVideoProviderFilter('cloudflare')).toEqual({
      cfStreamId: { not: null },
    })
    expect(getCloudVideoProviderFilter('bunny')).toEqual({
      bunnyVideoId: { not: null },
    })
  })

  it('媒體庫上傳使用目前生效方案', () => {
    expect(getMediaUploadProvider('cloudflare')).toBe('cloudflare')
    expect(getMediaUploadProvider('bunny')).toBe('bunny')
  })

  it('切換前會警告另一方案已有影片，並列出數量', () => {
    expect(getCloudVideoProviderSwitchWarning('cloudflare', 'bunny', 5)).toBe(
      '切換到 Bunny Stream 前，Cloudflare Stream 已有 5 支影片會從媒體庫隱藏，但不會刪除。'
    )
  })

  it('切換網站方案不會改變既有課程單元的播放 provider', () => {
    expect(preservesLessonVideoProvider('CLOUDFLARE', 'bunny')).toBe(true)
    expect(preservesLessonVideoProvider('BUNNY', 'cloudflare')).toBe(true)
  })
})
