import { NextResponse } from 'next/server'
import { getPublicSiteSettings } from '@/lib/site-settings-public'

export async function GET() {
  try {
    const settings = await getPublicSiteSettings()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('[public/site-settings] 讀取失敗:', error)
    return NextResponse.json(
      { success: false, error: '讀取設定失敗' },
      { status: 500 }
    )
  }
}
