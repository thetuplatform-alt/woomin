import {
  getCloudVideoProviderFilter,
  getCloudVideoProviderSwitchWarning,
  getMediaUploadProvider,
  getExclusiveCloudVideoProviders,
  preservesLessonVideoProvider,
} from '@/lib/video-provider-policy'
import {
  getVideoLibrarySubtitle,
  getCloudVideoProviderOptions,
  getVideoProviderSettingsView,
  isVideoProviderDirty,
  shouldShowCloudflareSyncButton,
} from '@/lib/video-provider-ui'

describe('網站層級 Cloud video provider 互斥政策', () => {
  it('媒體庫副標題只顯示目前生效的方案', () => {
    expect(getVideoLibrarySubtitle('bunny')).not.toContain('Cloudflare Stream')
    expect(getVideoLibrarySubtitle('bunny')).toContain('Bunny Stream')
    expect(getVideoLibrarySubtitle('cloudflare')).not.toContain('Bunny Stream')
    expect(getVideoLibrarySubtitle('cloudflare')).toContain('Cloudflare Stream')
  })

  it('影音設定選擇器只提供 Cloudflare 與 Bunny 二選一', () => {
    const options = getCloudVideoProviderOptions()

    expect(options.map((option) => option.label)).toEqual([
      'Cloudflare Stream',
      'Bunny Stream',
    ])
    expect(options.map((option) => option.value)).toEqual(['cloudflare', 'bunny'])
    expect(options.map((option) => option.description)).not.toContain('YouTube')
  })

  it('只顯示目前選中的雲端方案設定，切換後會標記為未儲存', () => {
    expect(getVideoProviderSettingsView('cloudflare')).toEqual({
      showCloudflare: true,
      showBunny: false,
    })
    expect(getVideoProviderSettingsView('bunny')).toEqual({
      showCloudflare: false,
      showBunny: true,
    })
    expect(isVideoProviderDirty('cloudflare', 'bunny')).toBe(true)
    expect(isVideoProviderDirty('bunny', 'bunny')).toBe(false)
  })

  it('只有 Cloudflare 生效時才顯示同步 Cloudflare 按鈕', () => {
    expect(shouldShowCloudflareSyncButton('cloudflare')).toBe(true)
    expect(shouldShowCloudflareSyncButton('bunny')).toBe(false)
  })

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
