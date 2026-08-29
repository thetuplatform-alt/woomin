import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareStreamConfigStatus } from '@/lib/cloudflare-stream-config'
import { syncCloudflareStreamLibrary } from '@/lib/cloudflare-stream-sync'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET is not configured' },
      { status: 503 }
    )
  }

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const configStatus = await getCloudflareStreamConfigStatus()
    if (!configStatus.hasUploadConfig) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'cloudflare_stream_not_configured',
      })
    }

    const result = await syncCloudflareStreamLibrary()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Cron Cloudflare Sync] 同步失敗:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '同步時發生錯誤',
      },
      { status: 500 }
    )
  }
}
