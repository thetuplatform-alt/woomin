// app/api/admin/media/upload-url/route.ts
// 取得 Cloudflare Stream 直接上傳 URL
// 用於 TUS 協議上傳影片

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getStreamUploadUrl } from '@/lib/cloudflare'

/**
 * POST /api/admin/media/upload-url
 * 取得 Cloudflare Stream Direct Creator Upload URL
 */
export async function POST() {
  try {
    // 驗證用戶權限
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授權存取' },
        { status: 401 }
      )
    }

    const userRole = session.user.role
    if (userRole !== 'ADMIN' && userRole !== 'INSTRUCTOR' && userRole !== 'EDITOR') {
      return NextResponse.json(
        { success: false, error: '權限不足' },
        { status: 403 }
      )
    }

    // 取得上傳 URL
    const result = await getStreamUploadUrl()

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      uploadURL: result.uploadURL,
      uid: result.uid,
    })
  } catch (error) {
    console.error('取得上傳 URL 失敗:', error)
    return NextResponse.json(
      { success: false, error: '取得上傳 URL 時發生錯誤' },
      { status: 500 }
    )
  }
}
