// app/api/admin/email/test/route.ts
// 測試 Email 發送 API
// 僅限管理員使用

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sendTestEmail } from '@/lib/email'
import { testEmailSchema } from '@/lib/validations/settings'

export async function POST(request: Request) {
  try {
    // 驗證權限
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '未授權存取' },
        { status: 401 }
      )
    }

    // 解析請求
    const body = await request.json()
    const validated = testEmailSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: '請輸入有效的 Email 地址' },
        { status: 400 }
      )
    }

    // 發送測試郵件
    const result = await sendTestEmail(validated.data.email)

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error || '發送失敗' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('測試 Email 發送失敗:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
