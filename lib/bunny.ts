interface BunnyApiResult {
  success: boolean
  status: number
  error?: string
}

export interface BunnyVideoPlayData {
  status?: number
  length?: number
  encodeProgress?: number
  thumbnailUrl?: string
}

// Bunny API 沒有明確的逾時慣例，這裡統一給 15 秒，避免請求卡死拖垮呼叫端。
const BUNNY_API_TIMEOUT_MS = 15000

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(BUNNY_API_TIMEOUT_MS)
}

export async function testLibraryConnection(
  libraryId: string,
  apiKey: string
): Promise<BunnyApiResult> {
  try {
    const response = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}`, {
      headers: { AccessKey: apiKey },
      signal: timeoutSignal(),
    })
    return {
      success: response.ok,
      status: response.status,
      ...(response.ok ? {} : { error: `Bunny API 回應 ${response.status}` }),
    }
  } catch {
    return { success: false, status: 0, error: 'Bunny API 請求逾時或網路錯誤' }
  }
}

export async function createVideo(
  libraryId: string,
  apiKey: string,
  title: string
): Promise<{ success: boolean; videoId?: string; status?: number; error?: string }> {
  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos`,
      {
        method: 'POST',
        headers: {
          AccessKey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
        signal: timeoutSignal(),
      }
    )
    if (!response.ok) {
      return { success: false, status: response.status, error: `Bunny API 回應 ${response.status}` }
    }

    const data = (await response.json()) as { guid?: string }
    return data.guid
      ? { success: true, videoId: data.guid }
      : { success: false, status: response.status, error: 'Bunny 未回傳影片 ID' }
  } catch {
    return { success: false, status: 0, error: 'Bunny API 請求逾時或網路錯誤' }
  }
}

export async function deleteVideo(
  libraryId: string,
  apiKey: string,
  videoId: string
): Promise<BunnyApiResult> {
  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoId)}`,
      { method: 'DELETE', headers: { AccessKey: apiKey }, signal: timeoutSignal() }
    )
    return {
      success: response.ok,
      status: response.status,
      ...(response.ok ? {} : { error: `Bunny API 回應 ${response.status}` }),
    }
  } catch {
    return { success: false, status: 0, error: 'Bunny API 請求逾時或網路錯誤' }
  }
}

export async function getVideoPlayData(
  libraryId: string,
  apiKey: string,
  videoId: string
): Promise<{ success: boolean; status: number; video?: BunnyVideoPlayData; error?: string }> {
  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoId)}/play`,
      { headers: { AccessKey: apiKey }, signal: timeoutSignal() }
    )
    if (!response.ok) {
      return { success: false, status: response.status, error: `Bunny API 回應 ${response.status}` }
    }
    const data = (await response.json()) as { video?: BunnyVideoPlayData }
    return { success: true, status: response.status, video: data.video }
  } catch {
    return { success: false, status: 0, error: 'Bunny API 請求逾時或網路錯誤' }
  }
}
