export type UnifiedVideoProvider = 'youtube' | 'vimeo' | 'cloudflare' | 'bunny'

export interface UnifiedVideoSourceInput {
  videoProvider: UnifiedVideoProvider
  videoSourceId: string
  videoUrl?: string | null
}

export interface StudentVideoSourceInput extends UnifiedVideoSourceInput {
  lessonId: string
}

interface ParsedVimeoSource {
  id: string
  hash: string | null
}

function parseVimeoSource(videoUrl: string): ParsedVimeoSource | null {
  try {
    const url = new URL(videoUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    const idIndex = parts.findIndex((part) => /^\d{6,15}$/.test(part))
    if (idIndex < 0) return null

    return {
      id: parts[idIndex],
      hash: url.searchParams.get('h') || parts[idIndex + 1] || null,
    }
  } catch {
    return null
  }
}

export function resolveClientVideoSource({
  videoProvider,
  videoSourceId,
  videoUrl,
}: UnifiedVideoSourceInput): string {
  if (videoProvider !== 'youtube' && videoProvider !== 'vimeo') {
    throw new Error('Cloudflare 與 Bunny 影片必須透過後端取得播放來源')
  }

  if (videoProvider === 'vimeo') {
    const vimeoSource = videoUrl ? parseVimeoSource(videoUrl) : null
    const hash = vimeoSource?.hash
    return hash
      ? `vimeo/${encodeURIComponent(vimeoSource.id)}?h=${encodeURIComponent(hash)}`
      : `vimeo/${encodeURIComponent(vimeoSource?.id ?? videoSourceId)}`
  }

  return `${videoProvider}/${encodeURIComponent(videoSourceId)}`
}

export async function resolveAdminVideoSource(input: UnifiedVideoSourceInput): Promise<string> {
  if (input.videoProvider === 'youtube' || input.videoProvider === 'vimeo') {
    return resolveClientVideoSource(input)
  }

  const response = await fetch('/api/admin/lesson/video-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await response.json()) as { success?: boolean; src?: string; error?: string }

  if (!response.ok || !data.success || !data.src) {
    throw new Error(data.error || '無法取得影片播放來源')
  }

  return data.src
}

export async function resolveStudentVideoSource({
  lessonId,
  videoProvider,
  videoSourceId,
  videoUrl,
}: StudentVideoSourceInput): Promise<string> {
  if (videoProvider === 'youtube' || videoProvider === 'vimeo') {
    return resolveClientVideoSource({ videoProvider, videoSourceId, videoUrl })
  }

  const response = await fetch('/api/lesson/stream-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lessonId, videoId: videoSourceId }),
  })
  const data = (await response.json()) as {
    success?: boolean
    signedUrl?: string
    customerCode?: string
    error?: string
  }

  if (!response.ok || !data.success || !data.signedUrl) {
    throw new Error(data.error || '無法取得影片播放來源')
  }

  if (videoProvider === 'cloudflare') {
    if (!data.customerCode) throw new Error('無法取得 Cloudflare 播放來源')
    return `https://customer-${data.customerCode}.cloudflarestream.com/${encodeURIComponent(videoSourceId)}/manifest/video.m3u8?token=${encodeURIComponent(data.signedUrl)}`
  }

  return data.signedUrl
}
