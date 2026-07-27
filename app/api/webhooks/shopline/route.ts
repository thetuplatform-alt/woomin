// app/api/webhooks/shopline/route.ts
// SHOPLINE Payments Webhook 處理
//
// 驗簽方式：HMAC-SHA256
//   - payload  = `${timestamp}.${rawBody}`
//   - expected = hmacSha256(payload, signKey)
//   - headers: `timestamp`, `sign`, `apiVersion`
//
// 事件類型（擷取 payment 類）：
//   - payment.succeeded / trade.succeeded
//   - payment.failed    / trade.failed

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { ShoplineGateway } from '@/lib/payment/shopline-gateway'
import {
  executePostPaymentActions,
  grantPaidOrderAccess,
} from '@/lib/payment/post-payment-actions'
import { extractShoplineAtmInstructions } from '@/lib/payment/payment-instructions'
import { recordCouponRedemption } from '@/lib/payment/coupon-redemption'
import {
  getCourseInviteOrderMetadata,
  withCourseInviteOrderMetadata,
} from '@/lib/payment/course-invite-order-metadata'
import type { PaymentMethod, Prisma } from '@prisma/client'
import {
  enqueueOrderInvoiceOutbox,
  processOrderInvoiceOutbox,
} from '@/lib/subscription/outbox'

interface ShoplineWebhookPayload {
  id?: string
  type?: string
  created?: string | number
  data?: {
    // 官方欄位：頂層的商戶訂單編號
    referenceOrderId?: string
    // 舊欄位保留兼容（Session 類事件可能使用）
    referenceId?: string
    tradeOrderId?: string
    sessionId?: string
    // 官方欄位：交易金額（頂層沒有，在 order / payment 內）
    amount?: { value?: number; currency?: string }
    status?: string
    // 官方欄位：付款方式在 payment.paymentMethod
    paymentMethod?: string
    payment?: {
      paymentMethod?: string
      paidAmount?: { value?: number; currency?: string }
      [key: string]: unknown
    }
    // 官方欄位：order 內含 referenceOrderId 與 amount
    order?: {
      referenceOrderId?: string
      amount?: { value?: number; currency?: string }
      [key: string]: unknown
    }
    metadata?: Record<string, unknown>
    [key: string]: unknown
  }
}

function preserveCourseInviteMetadata(
  currentInstructions: Prisma.JsonValue | null,
  nextInstructions: Prisma.InputJsonObject
) {
  const metadata = getCourseInviteOrderMetadata(currentInstructions)
  return metadata
    ? withCourseInviteOrderMetadata(nextInstructions, metadata)
    : nextInstructions
}

/**
 * 判斷 Shopline 事件是否為「付款成功」事件
 *
 * Shopline 官方事件分類包含 session / payment / trade 三類相關命名，
 * 官方尚未公開完整事件 type 列表，此處用 pattern matching 容錯：
 * - payment.succeeded / payment.success
 * - trade.succeeded   / trade.success
 * - session.success   / session.succeeded / session.paid
 */
function classifyEvent(type: string): 'success' | 'failed' | 'pending' | 'other' {
  const t = type.toLowerCase()

  // 排除 refund / dispute / customer / paymentInstrument 等事件
  if (
    t.startsWith('refund.') ||
    t.startsWith('dispute.') ||
    t.startsWith('customer.') ||
    t.startsWith('paymentinstrument.') ||
    t.startsWith('settlement.') ||
    t.startsWith('kyc.')
  ) {
    return 'other'
  }

  // 只處理 session / payment / trade 類且帶「成功」語意
  const isTxnEvent =
    t.startsWith('session.') || t.startsWith('payment.') || t.startsWith('trade.')
  if (!isTxnEvent) return 'other'

  if (
    t.endsWith('.succeeded') ||
    t.endsWith('.success') ||
    t.endsWith('.paid') ||
    t.endsWith('.completed')
  ) {
    return 'success'
  }

  if (
    t.endsWith('.failed') ||
    t.endsWith('.fail') ||
    t.endsWith('.expired') ||
    t.endsWith('.cancelled') ||
    t.endsWith('.canceled')
  ) {
    return 'failed'
  }

  if (
    t.endsWith('.pending') ||
    t.endsWith('.processing') ||
    t.endsWith('.created') ||
    t.endsWith('.awaiting_payment') ||
    t.endsWith('.awaitingpayment')
  ) {
    return 'pending'
  }

  return 'other'
}

export async function POST(request: NextRequest) {
  try {
    let gateway: ShoplineGateway
    try {
      const gw = await getGatewayByType('shopline')
      if (!(gw instanceof ShoplineGateway)) {
        throw new Error('Gateway type mismatch')
      }
      gateway = gw
    } catch {
      console.error('[Shopline Webhook] 無法取得 Shopline 設定')
      return NextResponse.json(
        { success: false, message: 'Shopline not configured' },
        { status: 500 }
      )
    }

    const rawBody = await request.text()
    const timestamp = request.headers.get('timestamp') || ''
    const signature = request.headers.get('sign') || ''

    if (!timestamp || !signature) {
      console.error('[Shopline Webhook] 缺少 timestamp 或 sign header')
      return NextResponse.json(
        { success: false, message: '缺少簽章' },
        { status: 400 }
      )
    }

    const valid = gateway.verifyWebhookSignature({
      timestamp,
      signature,
      rawBody,
    })

    if (!valid) {
      console.error('[Shopline Webhook] 簽章驗證失敗')
      return NextResponse.json(
        { success: false, message: '簽章驗證失敗' },
        { status: 400 }
      )
    }

    let payload: ShoplineWebhookPayload
    try {
      payload = JSON.parse(rawBody) as ShoplineWebhookPayload
    } catch {
      return NextResponse.json(
        { success: false, message: '無效的 JSON' },
        { status: 400 }
      )
    }

    const eventType = payload.type || ''
    const eventClass = classifyEvent(eventType)
    console.log('[Shopline Webhook] 收到事件:', eventType, '分類:', eventClass, 'id:', payload.id)

    const isSuccess = eventClass === 'success'
    const isFailed = eventClass === 'failed'
    const isPending = eventClass === 'pending'

    // 只處理交易相關事件，其他（如 refund / dispute）先略過
    if (!isSuccess && !isFailed && !isPending) {
      return NextResponse.json({ success: true, message: '已忽略未處理事件' })
    }

    const data = payload.data || {}
    // 官方 payload 訂單編號欄位（依序 fallback）：
    // 1. data.referenceOrderId（trade / payment 類）
    // 2. data.order.referenceOrderId（官方 trade.succeeded 範例）
    // 3. data.referenceId（舊命名兼容）
    // 4. data.metadata.orderNo（自訂 metadata 兜底）
    const orderNo =
      (data.referenceOrderId as string | undefined) ||
      (data.order?.referenceOrderId as string | undefined) ||
      (data.referenceId as string | undefined) ||
      ((data.metadata as Record<string, unknown> | undefined)?.orderNo as string | undefined) ||
      ''
    const tradeOrderId = (data.tradeOrderId as string) || (data.sessionId as string) || null

    if (!orderNo) {
      console.error('[Shopline Webhook] payload 缺少 referenceOrderId / orderNo', {
        type: eventType,
        dataKeys: Object.keys(data),
      })
      return NextResponse.json(
        { success: false, message: '缺少訂單編號' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { orderNo },
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
        gatewayPaymentInstructions: true,
        gatewayPaymentExpiresAt: true,
      },
    })

    if (!order) {
      console.error('[Shopline Webhook] 訂單不存在:', orderNo)
      return NextResponse.json(
        { success: false, message: '訂單不存在' },
        { status: 404 }
      )
    }

    // 金額驗證（Shopline 使用 × 100 表示金額）
    // 官方 payload 金額依序 fallback：
    // 1. data.order.amount.value（trade.succeeded 範例）
    // 2. data.payment.paidAmount.value
    // 3. data.amount.value（舊命名兼容）
    const receivedAmount =
      data.order?.amount?.value ??
      data.payment?.paidAmount?.value ??
      data.amount?.value
    if (isSuccess) {
      if (receivedAmount != null) {
        const expected = Math.round(order.amount * 100)
        if (receivedAmount !== expected) {
          console.error('[Shopline Webhook] 金額不符:', {
            orderNo,
            expected,
            received: receivedAmount,
          })
          return NextResponse.json(
            { success: false, message: '金額不符' },
            { status: 400 }
          )
        }
      } else {
        // L23：payload 缺少金額欄位時無法比對。簽章已通過（payload 來源可信），
        // 為避免阻擋已付款客戶仍放行，但不再「靜默跳過」——記錄明顯告警供人工稽核。
        console.warn(
          '[Shopline Webhook] 成功事件缺少金額欄位，無法比對金額（簽章已驗證，仍放行）:',
          { orderNo, expected: Math.round(order.amount * 100), dataKeys: Object.keys(data) }
        )
      }
    }

    // 冪等性：已處理的訂單直接返回
    if (order.status !== 'PENDING') {
      console.log('[Shopline Webhook] 訂單已處理過:', orderNo, order.status)
      return NextResponse.json({ success: true, message: '訂單已處理' })
    }

    const rawPaymentMethod =
      (data.payment?.paymentMethod as string | undefined) ||
      (data.paymentMethod as string | undefined)
    const paymentMethod = mapShoplinePaymentMethod(rawPaymentMethod)
    const { instructions, expiresAt } = extractShoplineAtmInstructions(payload)

    if (isPending) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentMethod,
          stripeSessionId: tradeOrderId ?? undefined,
          stripePaymentIntentId: tradeOrderId ?? undefined,
          stripeResponse: payload as object,
          ...(instructions
            ? {
                gatewayPaymentInstructions:
                  preserveCourseInviteMetadata(
                    order.gatewayPaymentInstructions,
                    instructions as unknown as Prisma.InputJsonObject
                  ),
                gatewayPaymentExpiresAt: expiresAt,
              }
            : {}),
        },
      })

      return NextResponse.json({ success: true, message: '待付款資訊已更新' })
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
            stripeSessionId: tradeOrderId ?? undefined,
            stripePaymentIntentId: tradeOrderId ?? undefined,
            stripeResponse: payload as object,
            ...(instructions
              ? {
                  gatewayPaymentInstructions:
                    preserveCourseInviteMetadata(
                      order.gatewayPaymentInstructions,
                      instructions as unknown as Prisma.InputJsonObject
                    ),
                  gatewayPaymentExpiresAt: expiresAt,
                }
              : {}),
            paidAt: isSuccess ? new Date() : null,
          },
        })

        if (updateResult.count === 0) {
          throw new Error('ORDER_ALREADY_PROCESSED')
        }

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
            eventType: 'ISSUE_INVOICE',
          })
        }
      })

      if (isSuccess) {
        console.log('[Shopline Webhook] 訂單處理完成:', orderNo)
        const invoiceResult = await processOrderInvoiceOutbox(order.id, 'ISSUE_INVOICE')
        if (!invoiceResult.success) {
          console.error('[Shopline Webhook] 發票已排入重試:', invoiceResult.error)
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
          console.error('[Shopline Webhook] Post-payment actions 失敗:', err)
        )
      }

      return NextResponse.json({ success: true, message: '處理完成' })
    } catch (txError) {
      if (
        txError instanceof Error &&
        txError.message === 'ORDER_ALREADY_PROCESSED'
      ) {
        return NextResponse.json({ success: true, message: '訂單已被處理' })
      }
      throw txError
    }
  } catch (error) {
    console.error('[Shopline Webhook] 處理錯誤:', error)
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

function mapShoplinePaymentMethod(raw: string | undefined): PaymentMethod {
  if (!raw) return 'CREDIT_CARD'
  const s = raw.toLowerCase()
  // Shopline 官方方式名：CreditCard / ApplePay / LinePay / JKOPay / VirtualAccount / ChaileaseBNPL
  // 目前 PaymentMethod enum 尚未擴充 LINE_PAY / JKO_PAY，LinePay / JKOPay 先歸類為信用卡以免寫入失敗
  if (s.includes('apple')) return 'APPLE_PAY'
  if (s.includes('google')) return 'GOOGLE_PAY'
  if (s.includes('virtualaccount') || s.includes('atm')) return 'ATM'
  if (s.includes('cvs')) return 'CVS'
  return 'CREDIT_CARD'
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Shopline Webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  })
}
