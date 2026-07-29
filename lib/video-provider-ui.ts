import type { CloudVideoProvider } from './video-provider-policy'

export function getVideoLibrarySubtitle(provider: CloudVideoProvider) {
  const providerLabel = provider === 'bunny' ? 'Bunny Stream' : 'Cloudflare Stream'
  return `管理上傳到平台、可重複綁定到課程單元的 ${providerLabel} 影片`
}

export function getCloudVideoProviderOptions() {
  return [
    {
      value: 'cloudflare' as const,
      label: 'Cloudflare Stream',
      description: '媒體庫顯示並上傳 Cloudflare 影片。',
    },
    {
      value: 'bunny' as const,
      label: 'Bunny Stream',
      description: '媒體庫顯示並上傳 Bunny 影片。',
    },
  ]
}

export function getVideoProviderSettingsView(provider: CloudVideoProvider) {
  return {
    showCloudflare: provider === 'cloudflare',
    showBunny: provider === 'bunny',
  }
}

export function isVideoProviderDirty(
  initialProvider: CloudVideoProvider,
  selectedProvider: CloudVideoProvider
) {
  return initialProvider !== selectedProvider
}

export function shouldShowCloudflareSyncButton(provider: CloudVideoProvider) {
  return provider === 'cloudflare'
}
