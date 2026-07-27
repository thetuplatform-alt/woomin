// app/api/admin/media/tus-upload-url/route.ts
// TUS 代理端點：轉發前端的 TUS 建立請求到 Cloudflare Stream
// 前端 tus-js-client 的 endpoint 直接指向這個 route
// 此 route 負責加上 Authorization header 並轉發 Cloudflare 回傳的 Location header

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveAppUrl } from '@/lib/app-url'
import { getCloudflareStreamConfig } from '@/lib/cloudflare-stream-config'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

/**
 * POST /api/admin/media/tus-upload-url
 * 作為 TUS 代理：接收前端 tus-js-client 的建立請求，
 * 轉發到 Cloudflare Stream API，並回傳帶有 Location header 的 response。
 * tus-js-client 會自動讀取 Location header 來進行後續上傳。
 */
export async function POST(request: Request) {
  try {
    // 驗證用戶權限
    const session = await auth()

    if (!session?.user) {
      return new Response(null, { status: 401 })
    }

    const userRole = session.user.role
    if (userRole !== 'ADMIN' && userRole !== 'INSTRUCTOR' && userRole !== 'EDITOR') {
      return new Response(null, { status: 403 })
    }

    // Rate limit：避免反覆建立上傳耗用站台 Cloudflare 配額
    const rl = checkRateLimit(`tus-upload:${session.user.id}`, {
      windowMs: 60 * 1000,
      maxRequests: 30,
    })
    if (!rl.success) {
      return new Response('操作太頻繁，請稍後再試', {
        status: 429,
        headers: getRateLimitHeaders(rl),
      })
    }

    const { accountId, apiToken } = await getCloudflareStreamConfig()

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { success: false, error: '缺少 Cloudflare 設定' },
        { status: 500 }
      )
    }

    // 轉發前端 tus-js-client 的 headers 到 Cloudflare
    const uploadLength = request.headers.get('Upload-Length')
    const uploadMetadata = request.headers.get('Upload-Metadata')

    const cfHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiToken}`,
      'Tus-Resumable': '1.0.0',
    }

    if (uploadLength) {
      cfHeaders['Upload-Length'] = uploadLength
    }
    if (uploadMetadata) {
      cfHeaders['Upload-Metadata'] = uploadMetadata
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`

    const cfResponse = await fetch(endpoint, {
      method: 'POST',
      headers: cfHeaders,
    })

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text()
      console.error('[Cloudflare TUS] 建立失敗:', {
        status: cfResponse.status,
        statusText: cfResponse.statusText,
        body: errorText,
        uploadLength,
        uploadMetadata,
      })
      return new Response(errorText, { status: cfResponse.status })
    }

    // Cloudflare 回傳 201 Created，Location header 包含一次性上傳 URL
    const location = cfResponse.headers.get('Location')

    if (!location) {
      return new Response('未收到 Cloudflare 上傳 URL', { status: 502 })
    }

    // 回傳帶有 Location header 和 CORS headers 的 response
    // tus-js-client 會自動讀取 Location header
    const allowedOrigin = await resolveAppUrl({ request })

    return new Response(null, {
      status: 201,
      headers: {
        Location: location,
        'Tus-Resumable': '1.0.0',
        'Access-Control-Expose-Headers':
          'Location, Tus-Resumable, Upload-Offset',
        'Access-Control-Allow-Headers':
          'Content-Type, Upload-Length, Upload-Metadata, Tus-Resumable, Upload-Offset',
        'Access-Control-Allow-Origin': allowedOrigin,
      },
    })
  } catch (error) {
    console.error('TUS 代理端點失敗:', error)
    return new Response('取得上傳端點時發生錯誤', { status: 500 })
  }
}

/**
 * OPTIONS /api/admin/media/tus-upload-url
 * 處理 CORS preflight 請求
 */
export async function OPTIONS(request: Request) {
  const allowedOrigin = await resolveAppUrl({ request })

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Upload-Length, Upload-Metadata, Tus-Resumable, Upload-Offset',
      'Access-Control-Expose-Headers':
        'Location, Tus-Resumable, Upload-Offset',
      'Access-Control-Max-Age': '86400',
    },
  })
}
