export type AppVideoProvider = 'youtube' | 'cloudflare' | 'vimeo' | 'bunny'

export interface VimeoVideoSource {
  id: string
  hash: string | null
  url: string
}

export interface LessonVideoFields {
  videoProvider: AppVideoProvider | null
  videoSourceId: string | null
  videoUrl: string | null
  videoThumbnail: string | null
  videoDuration: number | null
  legacyVideoId: string | null
}

type LessonVideoInput = Partial<{
  videoProvider: string | null
  videoSourceId: string | null
  videoUrl: string | null
  videoThumbnail: string | null
  videoDuration: number | null
  videoId: string | null
}>

export function parseYouTubeVideoId(input: string): string | null {
  const value = input.trim()
  if (!value) return null

  const directMatch = value.match(/^[a-zA-Z0-9_-]{11}$/)
  if (directMatch) return directMatch[0]

  try {
    const url = new URL(value)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }

    if (url.hostname.includes('youtube.com')) {
      const watchId = url.searchParams.get('v')
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId

      const parts = url.pathname.split('/').filter(Boolean)
      const embedLikeId = parts.at(-1)
      return embedLikeId && /^[a-zA-Z0-9_-]{11}$/.test(embedLikeId)
        ? embedLikeId
        : null
    }
  } catch {
    return null
  }

  return null
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function parseVimeoVideoSource(input: string): VimeoVideoSource | null {
  const value = input.trim()
  if (!value) return null

  const directIdMatch = value.match(/^\d{6,15}$/)
  if (directIdMatch) {
    const id = directIdMatch[0]
    return {
      id,
      hash: null,
      url: getVimeoEmbedUrl(id),
    }
  }

  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    const isVimeoHost =
      hostname === 'vimeo.com' ||
      hostname.endsWith('.vimeo.com') ||
      hostname === 'player.vimeo.com'

    if (!isVimeoHost) return null

    const parts = url.pathname.split('/').filter(Boolean)
    const id =
      hostname === 'player.vimeo.com'
        ? parts[0] === 'video'
          ? parts[1]
          : null
        : findVimeoIdInPath(parts)

    if (!id || !/^\d{6,15}$/.test(id)) return null

    const hashFromQuery = normalizeString(url.searchParams.get('h'))
    const hashFromPath = getVimeoPathHash(parts, id)
    const hash = normalizeVimeoHash(hashFromQuery ?? hashFromPath)

    return {
      id,
      hash,
      url: getVimeoEmbedUrl(id, hash),
    }
  } catch {
    return null
  }
}

// 保留舊版呼叫介面，讓既有客製功能升級後不用一起改名。
export function parseVimeoVideoId(input: string): string | null {
  return parseVimeoVideoSource(input)?.id ?? null
}

export function getVimeoEmbedUrl(videoId: string, hash?: string | null): string {
  const params = new URLSearchParams({
    controls: '0',
    dnt: '1',
    portrait: '0',
    title: '0',
    byline: '0',
  })
  const normalizedHash = normalizeVimeoHash(hash ?? null)
  if (normalizedHash) params.set('h', normalizedHash)
  return `https://player.vimeo.com/video/${videoId}?${params.toString()}`
}

export function getVimeoWatchUrl(videoId: string, hash?: string | null): string {
  const normalizedHash = normalizeVimeoHash(hash ?? null)
  return normalizedHash
    ? `https://vimeo.com/${videoId}/${normalizedHash}`
    : `https://vimeo.com/${videoId}`
}

export function normalizeLessonVideoFields(
  input: LessonVideoInput
): LessonVideoFields {
  const rawProvider = input.videoProvider?.toLowerCase().trim()
  const fallbackCloudflareId = normalizeString(input.videoSourceId) ?? normalizeString(input.videoId)

  if (rawProvider === 'youtube') {
    const rawYoutubeInput =
      normalizeString(input.videoUrl) ?? normalizeString(input.videoSourceId)
    const youtubeId = rawYoutubeInput ? parseYouTubeVideoId(rawYoutubeInput) : null

    return {
      videoProvider: youtubeId ? 'youtube' : null,
      videoSourceId: youtubeId,
      videoUrl: youtubeId ? getYouTubeEmbedUrl(youtubeId) : null,
      videoThumbnail:
        youtubeId
          ? normalizeString(input.videoThumbnail) ?? getYouTubeThumbnailUrl(youtubeId)
          : null,
      videoDuration: normalizeDuration(input.videoDuration),
      legacyVideoId: null,
    }
  }

  if (rawProvider === 'vimeo') {
    const rawVimeoInput =
      normalizeString(input.videoUrl) ?? normalizeString(input.videoSourceId)
    const vimeo = rawVimeoInput ? parseVimeoVideoSource(rawVimeoInput) : null

    return {
      videoProvider: vimeo ? 'vimeo' : null,
      videoSourceId: vimeo?.id ?? null,
      videoUrl: vimeo?.url ?? null,
      videoThumbnail: vimeo ? normalizeString(input.videoThumbnail) : null,
      videoDuration: normalizeDuration(input.videoDuration),
      legacyVideoId: null,
    }
  }

  if (rawProvider === 'bunny') {
    const bunnyId = normalizeString(input.videoSourceId) ?? normalizeString(input.videoId)
    return {
      videoProvider: bunnyId ? 'bunny' : null,
      videoSourceId: bunnyId,
      videoUrl: bunnyId ? null : null,
      videoThumbnail: normalizeString(input.videoThumbnail),
      videoDuration: normalizeDuration(input.videoDuration),
      legacyVideoId: null,
    }
  }

  if (rawProvider === 'cloudflare' || fallbackCloudflareId) {
    return {
      videoProvider: fallbackCloudflareId ? 'cloudflare' : null,
      videoSourceId: fallbackCloudflareId,
      videoUrl: fallbackCloudflareId ? null : null,
      videoThumbnail: normalizeString(input.videoThumbnail),
      videoDuration: normalizeDuration(input.videoDuration),
      legacyVideoId: fallbackCloudflareId,
    }
  }

  return {
    videoProvider: null,
    videoSourceId: null,
    videoUrl: null,
    videoThumbnail: null,
    videoDuration: normalizeDuration(input.videoDuration),
    legacyVideoId: null,
  }
}

export function getEffectiveLessonVideo(input: LessonVideoInput): LessonVideoFields {
  return normalizeLessonVideoFields(input)
}

export interface MediaPickerCandidate {
  bunnyVideoId: string | null
  cfStreamId: string | null
}

export type MediaPickerSelectionResult =
  | { accepted: true; sourceId: string }
  | { accepted: false; error: string }

/**
 * 選片庫防禦層：判斷選到的媒體是否真的屬於目前選定的 provider。
 * 理論上伺服器端已依 provider 過濾清單，這裡是最後一道防線，
 * 避免選到不符的媒體時靜默切換課程影片來源。
 */
export function resolveMediaPickerSelection(
  media: MediaPickerCandidate,
  provider: 'cloudflare' | 'bunny'
): MediaPickerSelectionResult {
  if (provider === 'bunny') {
    return media.bunnyVideoId
      ? { accepted: true, sourceId: media.bunnyVideoId }
      : { accepted: false, error: '選取的影片不屬於目前的 Bunny 影片庫，請重新選擇' }
  }

  return media.cfStreamId
    ? { accepted: true, sourceId: media.cfStreamId }
    : { accepted: false, error: '選取的影片不屬於目前的 Cloudflare 影片庫，請重新選擇' }
}

/**
 * 統一 Bunny／Cloudflare 兩種 provider 的狀態呈現。
 * Bunny 的 "failed" 對應到既有的「錯誤」badge，不當作 "unknown" 顯示。
 */
export function normalizeVideoStatus(
  bunnyStatus: string | null | undefined,
  cfStatus: string | null | undefined
): 'ready' | 'processing' | 'error' | 'deleted' | 'unknown' {
  const status = bunnyStatus || cfStatus || 'unknown'
  if (status === 'failed') return 'error'
  if (status === 'ready' || status === 'error' || status === 'deleted') {
    return status
  }
  if (['pending', 'inprogress', 'queued', 'processing', 'downloading'].includes(status)) {
    return 'processing'
  }
  return 'unknown'
}

/**
 * 是否需要顯示「同步」按鈕：Bunny 影片以 bunnyStatus 判斷（ready/failed 為終態），
 * Cloudflare 影片維持原本以 cfStatus 判斷（ready/deleted 為終態）。
 */
export function needsVideoSync(video: {
  bunnyVideoId: string | null
  bunnyStatus: string | null
  cfStatus: string | null
}): boolean {
  const isBunnyVideo = Boolean(video.bunnyVideoId)
  return isBunnyVideo
    ? video.bunnyStatus !== 'ready' && video.bunnyStatus !== 'failed'
    : video.cfStatus !== 'ready' && video.cfStatus !== 'deleted'
}

function normalizeString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeDuration(value: number | null | undefined): number | null {
  return typeof value === 'number' && value > 0 ? Math.round(value) : null
}

function findVimeoIdInPath(parts: string[]): string | null {
  const ignoredPrefixes = new Set([
    'album',
    'channels',
    'groups',
    'manage',
    'ondemand',
    'showcase',
    'staffpicks',
    'videos',
  ])

  // showcase 網址同時含展示頁 ID 與影片 ID，影片 ID 會在較後面。
  for (let index = parts.length - 1; index >= 0; index--) {
    const part = parts[index]
    if (ignoredPrefixes.has(part)) continue
    if (/^\d{6,15}$/.test(part)) return part
  }

  return null
}

function getVimeoPathHash(parts: string[], videoId: string): string | null {
  const idIndex = parts.findIndex((part) => part === videoId)
  if (idIndex < 0) return null

  const nextPart = parts[idIndex + 1]
  return nextPart && !/^\d+$/.test(nextPart) ? nextPart : null
}

function normalizeVimeoHash(value: string | null | undefined): string | null {
  const hash = normalizeString(value)
  if (!hash || !/^[a-zA-Z0-9_-]+$/.test(hash)) return null
  return hash
}
