// lib/utils/video-uploader.ts
// 共用的影片上傳工具
// 支援 Direct Creator Upload (小檔案) 和 TUS 協議 (大檔案)

import * as tus from 'tus-js-client'
import type { AppVideoProvider } from '@/lib/video-source'

// 檔案大小閾值：超過 200MB 使用 TUS 協議
const TUS_THRESHOLD_BYTES = 200 * 1024 * 1024 // 200MB

/**
 * 上傳結果
 */
export interface VideoUploadResult {
  uid: string
  duration: number | null
  mediaId?: string
}

/**
 * 上傳進度回調
 */
export type UploadProgressCallback = (progress: number) => void

async function uploadBunnyVideo(
  file: File,
  onProgress: UploadProgressCallback
): Promise<VideoUploadResult> {
  const authResponse = await fetch('/api/admin/media/bunny-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name }),
  })
  const authData = await authResponse.json()
  if (!authData.success) throw new Error(authData.error || '無法取得 Bunny 上傳授權')

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: 'https://video.bunnycdn.com/tusupload',
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        AuthorizationSignature: authData.authorizationSignature,
        AuthorizationExpire: String(authData.authorizationExpire),
        LibraryId: String(authData.libraryId),
        VideoId: authData.videoId,
      },
      metadata: { filetype: file.type || 'video/mp4', title: file.name },
      onError: (error) => reject(new Error(error.message || 'Bunny 上傳失敗')),
      onProgress: (uploaded, total) => onProgress(Math.round((uploaded / total) * 100)),
      onSuccess: async () => {
        try {
          const completeResponse = await fetch('/api/admin/media/upload-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'bunny',
              videoId: authData.videoId,
              originalName: file.name,
              size: file.size,
            }),
          })
          const completeData = await completeResponse.json()
          if (!completeData.success) throw new Error(completeData.error || '建立 Bunny 媒體記錄失敗')
          resolve({ uid: authData.videoId, duration: completeData.media?.duration || null, mediaId: completeData.media?.id })
        } catch (error) {
          reject(error)
        }
      },
    })
    upload.start()
  })
}

/**
 * 解析 Cloudflare API 錯誤，提供友善的中文訊息
 */
export function parseCloudflareError(errorMessage: string): string {
  // 配額超過錯誤
  if (
    errorMessage.includes('Storage capacity exceeded') ||
    errorMessage.includes('10011')
  ) {
    return 'Cloudflare Stream 儲存空間已滿，請先刪除不需要的影片或升級方案'
  }
  // 速率限制
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return '請求過於頻繁，請稍後再試'
  }
  // 檔案大小超過限制
  if (
    errorMessage.includes('File size too large') ||
    errorMessage.includes('413')
  ) {
    return '檔案大小超過限制，正在嘗試使用 TUS 協議上傳...'
  }
  return errorMessage
}

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 使用 TUS 協議上傳大檔案到 Cloudflare Stream
 * TUS 支援斷點續傳，適合大檔案上傳
 */
async function uploadVideoWithTus(
  file: File,
  onProgress: UploadProgressCallback
): Promise<VideoUploadResult> {
  // 使用 TUS 協議上傳，endpoint 指向我們的代理 API
  // 代理 API 會轉發請求到 Cloudflare，並回傳帶有 Location header 的 response
  // tus-js-client 會自動讀取 Location header 取得 Cloudflare 的一次性上傳 URL
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: '/api/admin/media/tus-upload-url',
      chunkSize: 50 * 1024 * 1024, // 50MiB 分塊（Cloudflare Stream TUS 要求 256KiB 倍數，50MiB 是官方建議大小）
      retryDelays: [0, 1000, 3000, 5000, 10000],
      metadata: {
        name: file.name,
        maxDurationSeconds: '3600',
      },
      onError: (error) => {
        const response = (error as { originalResponse?: { getBody?: () => string; getStatus?: () => number } })?.originalResponse
        const status = response?.getStatus?.()
        const body = response?.getBody?.()
        console.error('[TUS] 上傳失敗:', {
          message: error.message,
          status,
          body,
          file: { name: file.name, size: file.size, type: file.type },
        })
        const detail = body || error.message || '上傳失敗'
        reject(new Error(parseCloudflareError(detail)))
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
        onProgress(percentage)
      },
      onSuccess: async () => {
        try {
          // 從 upload URL 提取 video UID
          const uploadUrl = upload.url
          if (!uploadUrl) {
            throw new Error('無法取得上傳結果 URL')
          }

          // 從 URL 提取 UID（最後一段路徑，可能帶有 query string）
          const urlPath = new URL(uploadUrl).pathname
          const uid = urlPath.split('/').pop()

          if (!uid) {
            throw new Error('無法解析影片 UID')
          }

          // 建立 Media 記錄
          const completeResponse = await fetch(
            '/api/admin/media/upload-complete',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid,
                originalName: file.name,
                size: file.size,
              }),
            }
          )

          const completeData = await completeResponse.json()
          if (!completeData.success) {
            throw new Error(completeData.error || '建立媒體記錄失敗')
          }

          resolve({
            uid,
            duration: completeData.media?.duration || null,
            mediaId: completeData.media?.id,
          })
        } catch (error) {
          reject(error)
        }
      },
    })

    // 開始上傳
    upload.start()
  })
}

/**
 * 使用 Direct Creator Upload 上傳小檔案
 */
async function uploadVideoWithDirectUpload(
  file: File,
  onProgress: UploadProgressCallback
): Promise<VideoUploadResult> {
  // 1. 取得上傳 URL
  const urlResponse = await fetch('/api/admin/media/upload-url', {
    method: 'POST',
  })

  const urlData = await urlResponse.json()
  if (!urlData.success) {
    const errorMsg = urlData.error || '無法取得上傳 URL'
    throw new Error(parseCloudflareError(errorMsg))
  }

  const { uploadURL, uid } = urlData

  // 2. 使用 XMLHttpRequest 上傳 (支援進度追蹤)
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          // 上傳完成，建立 Media 記錄
          const completeResponse = await fetch(
            '/api/admin/media/upload-complete',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid,
                originalName: file.name,
                size: file.size,
              }),
            }
          )

          const completeData = await completeResponse.json()
          if (!completeData.success) {
            throw new Error(completeData.error || '建立媒體記錄失敗')
          }

          resolve({
            uid,
            duration: completeData.media?.duration || null,
            mediaId: completeData.media?.id,
          })
        } catch (error) {
          reject(error)
        }
      } else {
        // 檢查是否為檔案過大錯誤
        const responseText = xhr.responseText || ''
        if (xhr.status === 413 || responseText.includes('File size too large')) {
          reject(new Error('FILE_TOO_LARGE'))
        } else {
          reject(new Error(`上傳失敗: ${xhr.status} ${responseText}`))
        }
      }
    })

    xhr.addEventListener('error', () => reject(new Error('網路錯誤')))
    xhr.addEventListener('abort', () => reject(new Error('上傳已取消')))

    xhr.open('POST', uploadURL)
    xhr.send(formData)
  })
}

/**
 * 上傳影片到 Cloudflare Stream
 * 自動根據檔案大小選擇上傳方式：
 * - 小於 200MB：使用 Direct Creator Upload
 * - 大於 200MB：使用 TUS 協議
 *
 * @param file 要上傳的影片檔案
 * @param onProgress 進度回調函式 (0-100)
 * @returns 上傳結果，包含 uid、duration 和 mediaId
 */
export async function uploadVideo(
  file: File,
  onProgress: UploadProgressCallback,
  provider: AppVideoProvider = 'cloudflare'
): Promise<VideoUploadResult> {
  console.log(`開始上傳影片: ${file.name} (${formatFileSize(file.size)})`)

  if (provider === 'bunny') return uploadBunnyVideo(file, onProgress)

  // 根據檔案大小選擇上傳方式
  if (file.size > TUS_THRESHOLD_BYTES) {
    console.log(
      `檔案大小 ${formatFileSize(file.size)} 超過 200MB，使用 TUS 協議上傳`
    )
    return uploadVideoWithTus(file, onProgress)
  }

  // 嘗試使用 Direct Upload，如果失敗且是檔案過大錯誤，則改用 TUS
  try {
    return await uploadVideoWithDirectUpload(file, onProgress)
  } catch (error) {
    if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
      console.log('Direct Upload 失敗（檔案過大），改用 TUS 協議上傳')
      onProgress(0) // 重設進度
      return uploadVideoWithTus(file, onProgress)
    }
    throw error
  }
}
