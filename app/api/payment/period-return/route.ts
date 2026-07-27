// app/api/payment/period-return/route.ts
// PAYUNi 續期收款前台跳轉 API（訂閱專用，不混用一次性 /api/payment/return）。
//
// PAYUNi 續期收款支付頁完成後以 POST 導回本路由。解密後以 gatewayTradeNo（MerTradeNo）
// 反查訂閱，再以首期 Order.orderNo 導向成功頁（沿用既有輪詢機制）；失敗導向失敗頁。
// 本路由不改任何訂單 / 訂閱狀態（權威狀態由 period-notify 決定），純導航。

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { PayUniGateway } from '@/lib/payment/payuni-gateway'
import { resolveAppUrl } from '@/lib/app-url'

export async function POST(request: NextRequest) {
  const baseUrl = await resolveAppUrl({ request })

  try {
    const formData = await request.formData()
    const encryptInfo = formData.get('EncryptInfo')?.toString()
    const hashInfo = formData.get('HashInfo')?.toString()

    if (!encryptInfo || !hashInfo) {
      return NextResponse.redirect(new URL('/checkout/failed', baseUrl), 303)
    }

    // 取得 PAYUNi gateway 實例
    let gateway: PayUniGateway
    try {
      const gw = await getGatewayByType('payuni')
      if (!(gw instanceof PayUniGateway)) {
        throw new Error('Gateway type mismatch')
      }
      gateway = gw
    } catch {
      return NextResponse.redirect(new URL('/checkout/failed', baseUrl), 303)
    }

    const service = gateway.getService()
    const decrypted = service.verifyAndDecrypt(encryptInfo, hashInfo)

    // 續期收款回傳的 MerTradeNo = 我方 gatewayTradeNo
    const gatewayTradeNo = decrypted.MerTradeNo as string | undefined
    const status = decrypted.Status as string | undefined
    const periodTradeNo = decrypted.PeriodTradeNo as string | undefined
    const merchantId =
      (decrypted.MerchantId as string | undefined) ??
      (decrypted.MerID as string | undefined)

    if (!gatewayTradeNo || merchantId !== gateway.getMerchantId()) {
      throw new Error('Missing or invalid PAYUNi merchant/order identity')
    }

    // 以 gatewayTradeNo 反查訂閱，取首期 Order.orderNo 導向成功頁輪詢
    const subscription = await prisma.courseSubscription.findUnique({
      where: { gatewayTradeNo },
      select: {
        id: true,
        gateway: true,
        gatewayEnvironment: true,
        orders: {
          where: { periodNumber: 1 },
          select: { orderNo: true },
          take: 1,
        },
      },
    })

    const firstOrderNo = subscription?.orders[0]?.orderNo
    if (
      !subscription ||
      subscription.gateway !== 'payuni' ||
      (subscription.gatewayEnvironment &&
        subscription.gatewayEnvironment !==
          (gateway.isTestMode()
            ? 'payuni:sandbox'
            : 'payuni:production'))
    ) {
      throw new Error('PAYUNi subscription identity mismatch')
    }

    // Return 不是入帳權威，但成功回傳可安全補存 PeriodTradeNo，避免 Notify 暫時遺失時
    // maintenance 無法終止外部續期單。條件式綁定禁止覆寫既有 provider identity。
    if (status === 'SUCCESS' && !periodTradeNo) {
      throw new Error('PAYUNi success response missing PeriodTradeNo')
    }
    if (status === 'SUCCESS' && periodTradeNo) {
      const bound = await prisma.courseSubscription.updateMany({
        where: {
          id: subscription.id,
          OR: [
            { gatewaySubscriptionId: null },
            { gatewaySubscriptionId: periodTradeNo },
          ],
        },
        data: { gatewaySubscriptionId: periodTradeNo },
      })
      if (bound.count !== 1) {
        throw new Error('PAYUNi PeriodTradeNo 與既有訂閱綁定不符')
      }
    }

    if (status === 'SUCCESS' && firstOrderNo) {
      return NextResponse.redirect(
        new URL(`/checkout/success?orderNo=${firstOrderNo}`, baseUrl),
        303
      )
    }

    // 失敗或查無訂單：導向失敗頁（帶 orderNo 供頁面顯示）
    const failedUrl = firstOrderNo
      ? `/checkout/failed?orderNo=${firstOrderNo}`
      : '/checkout/failed'
    return NextResponse.redirect(new URL(failedUrl, baseUrl), 303)
  } catch (error) {
    console.error('[PAYUNi Period Return] 處理錯誤:', error)
    return NextResponse.redirect(new URL('/checkout/failed', baseUrl), 303)
  }
}
