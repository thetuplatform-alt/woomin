// app/api/payment/notify/route.ts
// PAYUNi 背景通知 API
// 接收 PAYUNi 付款完成後的背景通知，更新訂單狀態

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { PayUniGateway } from '@/lib/payment/payuni-gateway'
import {
  executePostPaymentActions,
  grantPaidOrderAccess,
} from '@/lib/payment/post-payment-actions'
import { recordCouponRedemption } from '@/lib/payment/coupon-redemption'
import { extractPayUniPaymentInstructions } from '@/lib/payment/payment-instructions'
import type { PaymentMethod, Prisma } from '@prisma/client'
import {
  enqueueOrderInvoiceOutbox,
  processOrderInvoiceOutbox,
} from '@/lib/subscription/outbox'

// 背景通知時間戳容忍窗（毫秒）：超過此區間的通知視為重放並拒絕（L22）
const NOTIFY_TIMESTAMP_TOLERANCE_MS = 15 * 60 * 1000

/**
 * PAYUNi 背景通知
 * POST /api/payment/notify
 *
 * 安全機制：
 * 1. Hash 驗證 - 確保資料來自 PAYUNi
 * 2. 金額驗證 - 確保付款金額與訂單一致
 * 3. 冪等性處理 - 使用樂觀鎖防止重複處理
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const encryptInfo = formData.get('EncryptInfo') as string | null
    const hashInfo = formData.get('HashInfo') as string | null

    if (!encryptInfo || !hashInfo) {
      console.error('[PAYUNi Notify] 缺少 EncryptInfo 或 HashInfo')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
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
      console.error('[PAYUNi Notify] 無法取得 PAYUNi 設定')
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      )
    }

    // 驗證並解密
    const service = gateway.getService()
    let decryptedData
    try {
      decryptedData = service.verifyAndDecrypt(encryptInfo, hashInfo)
    } catch (error) {
      console.error('[PAYUNi Notify] 解密驗證失敗:', error)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // L22：重放防護 — 若通知帶有 Timestamp（PAYUNi 以秒為單位），拒絕超出容忍窗的舊通知。
    // 註：訂單狀態的單次轉移（PENDING→PAID/FAILED）已是主要冪等保護，此為額外防線。
    const notifyTimestamp = Number(decryptedData.Timestamp || 0)
    if (notifyTimestamp > 0) {
      const ageMs = Math.abs(Date.now() - notifyTimestamp * 1000)
      if (ageMs > NOTIFY_TIMESTAMP_TOLERANCE_MS) {
        console.error('[PAYUNi Notify] 通知時間戳超出容忍窗，疑似重放:', { notifyTimestamp, ageMs })
        return NextResponse.json({ error: 'Stale notification' }, { status: 400 })
      }
    }

    const merTradeNo = decryptedData.MerTradeNo as string
    const status = decryptedData.Status as string
    const tradeAmt = Number(decryptedData.TradeAmt || 0)
    const tradeNo = (decryptedData.TradeNo as string) || null
    const paymentType = (decryptedData.PaymentType as string) || null

    console.log('[PAYUNi Notify] 收到通知:', {
      merTradeNo,
      status,
      tradeAmt,
      tradeNo,
      paymentType,
    })

    // 查詢訂單
    const order = await prisma.order.findUnique({
      where: { orderNo: merTradeNo },
      select: {
        id: true,
        orderNo: true,
        userId: true,
        courseId: true,
        bundleId: true,
        amount: true,
        status: true,
        clientIpAddress: true,
        clientUserAgent: true,
        couponId: true,
        couponDiscount: true,
        newsletterCampaignId: true,
        subscriptionId: true,
      },
    })

    if (!order) {
      console.error('[PAYUNi Notify] 訂單不存在:', merTradeNo)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // 金額驗證
    const expectedAmount = Math.round(order.amount)
    if (tradeAmt !== expectedAmount) {
      console.error('[PAYUNi Notify] 金額不符:', {
        merTradeNo,
        expected: expectedAmount,
        received: tradeAmt,
      })
      return NextResponse.json(
        { error: 'Amount mismatch' },
        { status: 400 }
      )
    }

    // 冪等性：已處理的訂單直接返回
    if (order.status !== 'PENDING') {
      console.log('[PAYUNi Notify] 訂單已處理過:', merTradeNo, order.status)
      return NextResponse.json({ message: 'OK' })
    }

    // 判斷付款方式
    const paymentMethod = mapPayUniPaymentMethod(paymentType)

    // 更新訂單狀態（使用樂觀鎖 + 事務）
    const isSuccess = service.isTradeSuccess(status)

    // M24：ATM / CVS 取號通知（尚未付款）— 不可標記為 FAILED，應保留 PENDING 並寫入待付款資訊。
    if (!isSuccess) {
      const { instructions, expiresAt } = extractPayUniPaymentInstructions(
        decryptedData as Record<string, unknown>
      )
      if (instructions) {
        await prisma.order.updateMany({
          where: { id: order.id, status: 'PENDING' },
          data: {
            paymentMethod,
            stripeResponse: decryptedData as object,
            gatewayPaymentInstructions: instructions as unknown as Prisma.InputJsonObject,
            gatewayPaymentExpiresAt: expiresAt,
          },
        })
        console.log('[PAYUNi Notify] ATM/CVS 取號完成，保留待付款狀態:', merTradeNo)
        return NextResponse.json({ message: 'OK' })
      }

      // docs/audits/payment-invoice-audit-2026-06-22.md #3：ATM/CVS 取號欄位命名
      // 未經官方文件逐一驗證，解析失敗不代表付款真的失敗。保守保留 PENDING，
      // 避免把尚在等待中的合法付款誤標 FAILED —— 否則之後真正的成功通知送達時，
      // 上方的冪等防線（order.status !== 'PENDING'）會把它當「已處理過」直接吞掉，
      // 造成收到錢但訂單永久卡死、不開課也不開發票。
      console.error(
        '[PAYUNi Notify] 狀態非 SUCCESS 且無法解析出取號資訊，保留 PENDING 待人工確認:',
        { merTradeNo, status }
      )
      return NextResponse.json({ message: 'OK' })
    }

    const newStatus = isSuccess ? 'PAID' : 'FAILED'

    try {
      await prisma.$transaction(async (tx) => {
        const updateResult = await tx.order.updateMany({
          where: {
            id: order.id,
            status: 'PENDING',
          },
          data: {
            status: newStatus,
            paymentMethod,
            stripePaymentIntentId: tradeNo,
            stripeResponse: decryptedData as object,
            paidAt: isSuccess ? new Date() : null,
          },
        })

        if (updateResult.count === 0) {
          console.log('[PAYUNi Notify] 訂單已被其他請求處理:', order.orderNo)
          throw new Error('ORDER_ALREADY_PROCESSED')
        }

        // 付款成功：建立 Purchase 記錄
        if (isSuccess) {
          await grantPaidOrderAccess({
            tx,
            order: {
              id: order.id,
              userId: order.userId,
              courseId: order.courseId,
              bundleId: order.bundleId,
            },
            paidAt: new Date(),
          })

          // 建立優惠券兌換記錄（冪等 + 上限原子化）
          if (order.couponId && order.couponDiscount) {
            await recordCouponRedemption(tx, {
              couponId: order.couponId,
              userId: order.userId,
              orderId: order.id,
              amount: order.couponDiscount,
              campaignId: order.newsletterCampaignId,
            })
          }

          await enqueueOrderInvoiceOutbox(tx, {
            orderId: order.id,
            subscriptionId: order.subscriptionId,
            eventType: 'ISSUE_INVOICE',
          })
        }
      })

      // 付款成功：執行 post-payment actions（非阻塞）
      if (isSuccess) {
        console.log('[PAYUNi Notify] 訂單處理完成:', merTradeNo)
        const invoiceResult = await processOrderInvoiceOutbox(order.id, 'ISSUE_INVOICE')
        if (!invoiceResult.success) {
          console.error('[PAYUNi Notify] 發票已排入重試:', invoiceResult.error)
        }
        executePostPaymentActions({
          id: order.id,
          orderNo: order.orderNo,
          userId: order.userId,
          courseId: order.courseId,
          bundleId: order.bundleId,
          amount: order.amount,
          clientIpAddress: order.clientIpAddress,
          clientUserAgent: order.clientUserAgent,
        }).catch((err) =>
          console.error('[PAYUNi Notify] Post-payment actions 失敗:', err)
        )
      }

      return NextResponse.json({ message: 'OK' })
    } catch (txError) {
      if (
        txError instanceof Error &&
        txError.message === 'ORDER_ALREADY_PROCESSED'
      ) {
        return NextResponse.json({ message: 'OK' })
      }
      throw txError
    }
  } catch (error) {
    console.error('[PAYUNi Notify] 處理錯誤:', error)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}

function mapPayUniPaymentMethod(type: string | null): PaymentMethod {
  if (!type) return 'CREDIT_CARD'
  const t = type.toUpperCase()
  if (t.includes('ATM')) return 'ATM'
  if (t.includes('CVS')) return 'CVS'
  return 'CREDIT_CARD'
}
