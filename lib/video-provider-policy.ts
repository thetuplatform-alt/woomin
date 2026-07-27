export type CloudVideoProvider = 'cloudflare' | 'bunny'

export function normalizeCloudVideoProvider(value: string | null | undefined): CloudVideoProvider | null {
  return value === 'cloudflare' || value === 'bunny' ? value : null
}

export function getExclusiveCloudVideoProviders(provider: CloudVideoProvider) {
  return { cloudflare: provider === 'cloudflare', bunny: provider === 'bunny' }
}

export function getCloudVideoProviderFilter(provider: CloudVideoProvider) {
  return provider === 'bunny'
    ? { bunnyVideoId: { not: null } }
    : { cfStreamId: { not: null } }
}

export function getMediaUploadProvider(provider: CloudVideoProvider): CloudVideoProvider {
  return provider
}

export function getCloudVideoProviderSwitchWarning(
  current: CloudVideoProvider,
  next: CloudVideoProvider,
  count: number
) {
  const currentLabel = current === 'bunny' ? 'Bunny Stream' : 'Cloudflare Stream'
  const nextLabel = next === 'bunny' ? 'Bunny Stream' : 'Cloudflare Stream'
  return `切換到 ${nextLabel} 前，${currentLabel} 已有 ${count} 支影片會從媒體庫隱藏，但不會刪除。`
}

export function preservesLessonVideoProvider(lessonProvider: string, activeProvider: CloudVideoProvider) {
  void lessonProvider
  void activeProvider
  return true
}
