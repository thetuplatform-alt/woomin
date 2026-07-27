import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/require-admin'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'
import { createVideo } from '@/lib/bunny'
import { createBunnyTusSignature } from '@/lib/bunny-upload'

const AUTHORIZATION_TTL_SECONDS = 24 * 60 * 60

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth()
    const body = (await request.json().catch(() => ({}))) as { fileName?: string }
    const config = await getBunnyStreamConfig()
    if (!config.libraryId || !config.apiKey) {
      return NextResponse.json({ success: false, error: 'Bunny Stream 尚未設定' }, { status: 500 })
    }

    const created = await createVideo(config.libraryId, config.apiKey, body.fileName?.trim() || 'Untitled video')
    if (!created.success || !created.videoId) {
      return NextResponse.json({ success: false, error: created.error || '建立 Bunny 影片失敗' }, { status: 500 })
    }

    const authorizationExpire = Math.floor(Date.now() / 1000) + AUTHORIZATION_TTL_SECONDS
    return NextResponse.json({
      success: true,
      videoId: created.videoId,
      libraryId: config.libraryId,
      authorizationSignature: createBunnyTusSignature(config.libraryId, config.apiKey, authorizationExpire, created.videoId),
      authorizationExpire,
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '取得 Bunny 上傳授權失敗' }, { status: 500 })
  }
}
