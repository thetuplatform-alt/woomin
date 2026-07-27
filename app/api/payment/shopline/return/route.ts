// app/api/payment/shopline/return/route.ts
// SHOPLINE Payments 付款完成後的導回頁
// Shopline 會帶著 orderNo 把用戶導回此 endpoint
// 這裡僅做狀態判斷與導頁，實際付款結果以 webhook 為準

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { resolveAppUrl } from '@/lib/app-url'

async function handle(request: NextRequest) {
  const baseUrl = await resolveAppUrl({ request })
  const { searchParams } = new URL(request.url)
  const orderNo = searchParams.get('orderNo')

  if (!orderNo) {
    return NextResponse.redirect(new URL('/checkout/failed', baseUrl), 303)
  }

  const order = await prisma.order.findUnique({
    where: { orderNo },
    select: { status: true, userId: true },
  })

  // 訂單不存在：視為失敗
  if (!order) {
    return NextResponse.redirect(
      new URL(`/checkout/failed?orderNo=${encodeURIComponent(orderNo)}`, baseUrl),
      303
    )
  }

  // 擁有者驗證：
  // - 已登入會員必須是 order.userId 本人
  // - Guest 訂單（未登入）則允許任何人看結果頁（因為 guest checkout 本來就沒 session）
  //   但不洩漏訂單細節 — /checkout/success 頁面本身會再做 email/session 檢查
  const session = await auth()
  const currentUserId = session?.user?.id

  if (currentUserId && currentUserId !== order.userId) {
    // 登入用戶嘗試查看別人訂單 → 視為失敗
    return NextResponse.redirect(new URL('/checkout/failed', baseUrl), 303)
  }

  // 付款結果以 webhook 為準：
  // - PAID: 成功頁
  // - FAILED: 失敗頁
  // - PENDING: 仍引導到成功頁，讓用戶看到「處理中」提示，避免重複付款
  if (order.status === 'FAILED') {
    return NextResponse.redirect(
      new URL(`/checkout/failed?orderNo=${encodeURIComponent(orderNo)}`, baseUrl),
      303
    )
  }

  return NextResponse.redirect(
    new URL(`/checkout/success?orderNo=${encodeURIComponent(orderNo)}`, baseUrl),
    303
  )
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
