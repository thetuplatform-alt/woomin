// app/api/payment/period-notify/route.ts
// PAYUNi 續期收款每期通知 API（訂閱專用，不混用一次性 /api/payment/notify）。
//
// PAYUNi 於每期授權後以 POST 打到本路由，回報該期扣款結果。
// 安全機制：Hash 驗簽 + 解密；provider retry 可能晚於數小時，因此不以短時間窗
// 拒絕合法重送，改用簽章 payload fingerprint inbox + PeriodOrderNo 雙層冪等。
//
// 處理分派（呼叫 lib/subscription/renewal.ts 共用引擎，不自行操作資料庫狀態機）：
//   成功期款 → processSubscriptionPeriodPaid
//     - outcome=anomalous（訂閱處於終態）→ processAnomalousPeriodPayment（AC-46；PAYUNi 標記人工退款）
//     - 最後排程期但未繳滿（AC-45）→ 標記 attentionReason=TERM_ENDED_UNDERPAID + 管理員告警
//   失敗期款 → processSubscriptionPeriodFailed（轉 PAST_DUE，去重寄信 + 管理員告警）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { PayUniGateway } from '@/lib/payment/payuni-gateway'
import {
  processSubscriptionPeriodPaid,
  processSubscriptionPeriodFailed,
  processAnomalousPeriodPayment,
} from '@/lib/subscription/renewal'
import { sendAdminSubscriptionAlert } from '@/lib/subscription/notifications'
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  fingerprintPayUniPeriodEvent,
} from '@/lib/payment/webhook-events'
import {
  addBillingInterval,
  parseTaiwanBillingDate,
} from '@/lib/subscription/calendar'
import type { Prisma } from '@prisma/client'

/**
 * 由 PeriodOrderNo（如 SUB20260710abcd_3）反推 gatewayTradeNo（去掉尾碼 _期數）。
 * gatewayTradeNo 本身格式為 SUB+YYYYMMDD+12hex（不含底線），故取最後一個 '_' 之前的部分。
 */
function deriveGatewayTradeNo(periodOrderNo: string): string {
  const idx = periodOrderNo.lastIndexOf('_')
  return idx > 0 ? periodOrderNo.slice(0, idx) : periodOrderNo
}

function parseAuthDay(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
  return match
    ? parseTaiwanBillingDate(`${match[1]}-${match[2]}-${match[3]}`)
    : null
}

export async function POST(request: NextRequest) {
  let claimedEventId: string | null = null
  try {
    const formData = await request.formData()
    const encryptInfo = formData.get('EncryptInfo') as string | null
    const hashInfo = formData.get('HashInfo') as string | null

    if (!encryptInfo || !hashInfo) {
      console.error('[PAYUNi Period Notify] 缺少 EncryptInfo 或 HashInfo')
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
      console.error('[PAYUNi Period Notify] 無法取得 PAYUNi 設定')
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      )
    }

    // 驗簽 + 解密
    const service = gateway.getService()
    let decrypted
    try {
      decrypted = service.verifyAndDecrypt(encryptInfo, hashInfo)
    } catch (error) {
      console.error('[PAYUNi Period Notify] 解密驗證失敗:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const status = (decrypted.Status as string) || ''
    const merchantId = (decrypted.MerchantId as string) || ''
    const merTradeNo = (decrypted.MerTradeNo as string) || ''
    const periodTradeNo = (decrypted.PeriodTradeNo as string) || ''
    const periodOrderNo = (decrypted.PeriodOrderNo as string) || ''
    const gatewayPaymentId = (decrypted.TradeNo as string) || ''
    const authAmt = Number(decrypted.AuthAmt || 0)
    const totalTimes = Number(decrypted.TotalTimes || 0)
    const thisPeriod = Number(decrypted.ThisPeriod || 0)
    const nextAuthDate = ((decrypted.NextAuthDate as string) || '').trim()
    const authDay = ((decrypted.AuthDay as string) || '').trim()

    console.log('[PAYUNi Period Notify] 收到通知:', {
      status,
      periodTradeNo,
      periodOrderNo,
      authAmt,
      totalTimes,
      thisPeriod,
      nextAuthDate,
    })

    if (
      !periodOrderNo ||
      !merTradeNo ||
      !merchantId ||
      merchantId !== gateway.getMerchantId()
    ) {
      console.error('[PAYUNi Period Notify] 缺少 PeriodOrderNo')
      return NextResponse.json({ error: 'Invalid merchant/order identity' }, { status: 400 })
    }

    const suffix = /_(\d+)$/.exec(periodOrderNo)
    const suffixPeriod = suffix ? Number(suffix[1]) : 0
    const gatewayTradeNo = deriveGatewayTradeNo(periodOrderNo)
    if (
      gatewayTradeNo !== merTradeNo ||
      !Number.isInteger(thisPeriod) ||
      thisPeriod < 1 ||
      thisPeriod > 900 ||
      suffixPeriod !== thisPeriod ||
      !Number.isInteger(totalTimes) ||
      totalTimes < 1 ||
      totalTimes > 900
    ) {
      return NextResponse.json({ error: 'Invalid period identity' }, { status: 400 })
    }

    const isSuccess = service.isTradeSuccess(status)
    if (
      isSuccess &&
      (!Number.isInteger(authAmt) || authAmt < 2 || authAmt > 199_999)
    ) {
      return NextResponse.json({ error: 'Invalid authorized amount' }, { status: 400 })
    }

    const eventId = fingerprintPayUniPeriodEvent(decrypted)
    const claim = await claimWebhookEvent({
      gateway: 'payuni',
      eventId,
      eventType: `period.${isSuccess ? 'paid' : 'failed'}`,
      payload: decrypted as unknown as Prisma.InputJsonValue,
    })
    if (claim === 'DUPLICATE') {
      return NextResponse.json({ message: 'OK' })
    }
    if (claim === 'IN_PROGRESS') {
      // 不提前確認尚未完成的事件，讓 PAYUNi 重送；原 worker 若崩潰，五分鐘 lease
      // 到期後即可由重送事件重新 claim，避免通知永久遺失。
      return NextResponse.json(
        { error: 'Event is still processing' },
        { status: 503, headers: { 'Retry-After': '30' } }
      )
    }
    claimedEventId = eventId

    // 以 gatewayTradeNo（PeriodOrderNo 去尾碼）反查訂閱
    const subscription = await prisma.courseSubscription.findUnique({
      where: { gatewayTradeNo },
      select: {
        id: true,
        interval: true,
        gatewaySubscriptionId: true,
        gateway: true,
        courseId: true,
        userId: true,
        planType: true,
        totalPeriods: true,
        gatewayEnvironment: true,
        course: { select: { title: true } },
        user: { select: { email: true } },
      },
    })

    if (!subscription) {
      console.error('[PAYUNi Period Notify] 找不到對應訂閱:', gatewayTradeNo)
      return NextResponse.json({ error: 'Subscription not found' }, { status: 400 })
    }
    if (
      subscription.gateway !== 'payuni' ||
      (subscription.gatewayEnvironment &&
        subscription.gatewayEnvironment !==
          (gateway.isTestMode()
            ? 'payuni:sandbox'
            : 'payuni:production')) ||
      !periodTradeNo ||
      (subscription.gatewaySubscriptionId &&
        periodTradeNo &&
        subscription.gatewaySubscriptionId !== periodTradeNo)
    ) {
      throw new Error('PAYUNi PeriodTradeNo 與本地訂閱綁定不符')
    }
    const expectedTotalTimes =
      subscription.planType === 'FIXED_TERM' && subscription.totalPeriods != null
        ? subscription.totalPeriods
        : 900
    if (totalTimes !== expectedTotalTimes) {
      throw new Error(
        `PAYUNi PeriodTimes 與訂閱快照不符（expected=${expectedTotalTimes}, received=${totalTimes}）`
      )
    }

    // 首期（尾碼 _1）：首次 Notify 帶 PeriodTradeNo → 回寫 gatewaySubscriptionId
    const isFirstPeriod = periodOrderNo.endsWith('_1')
    if (
      periodTradeNo &&
      !subscription.gatewaySubscriptionId
    ) {
      // 條件式寫入：僅在尚未記錄時補上（成功路徑 renewal 亦會寫，此處確保失敗首期也記得）
      await prisma.courseSubscription.updateMany({
        where: { id: subscription.id, gatewaySubscriptionId: null },
        data: { gatewaySubscriptionId: periodTradeNo },
      })
    }

    const gatewayMeta = decrypted as unknown as Prisma.InputJsonValue
    const isLastScheduledPeriod = totalTimes > 0 && thisPeriod >= totalTimes

    if (!isSuccess) {
      // 失敗 attempt 也必須落地，才能精確 reauth 並防成功後晚到失敗通知回退狀態。
      await processSubscriptionPeriodFailed({
        subscriptionId: subscription.id,
        gatewayPeriodKey: periodOrderNo,
        periodNumber: thisPeriod,
        actualAmount: authAmt > 0 ? authAmt : null,
        isFirstPeriod,
        isFinalScheduledPeriod: isLastScheduledPeriod,
        gatewayPaymentId: gatewayPaymentId || null,
        gatewayMeta,
      })
      await completeWebhookEvent('payuni', eventId)
      return NextResponse.json({ message: 'OK' })
    }

    // ---- 成功期款 ----
    // 本期期末：優先用 NextAuthDate（下次授權日 = 本期末）；缺省（最後一期）則依週期推算
    const parsedNextDate = nextAuthDate
      ? parseTaiwanBillingDate(nextAuthDate)
      : null
    const authorizedAt = parseAuthDay(authDay)
    const periodEndAt =
      parsedNextDate ??
      (authorizedAt
        ? addBillingInterval(authorizedAt, subscription.interval)
        : null)
    if (!periodEndAt || Number.isNaN(periodEndAt.getTime())) {
      throw new Error('PAYUNi 通知缺少有效的 NextAuthDate/AuthDay')
    }

    const paidResult = await processSubscriptionPeriodPaid({
      subscriptionId: subscription.id,
      gatewayPeriodKey: periodOrderNo, // 冪等鍵
      periodNumber: thisPeriod > 0 ? thisPeriod : null,
      actualAmount: authAmt,
      periodEndAt,
      gatewaySubscriptionId: periodTradeNo || null,
      gatewayPaymentId: gatewayPaymentId || null,
      gatewayMeta,
      isFirstPeriod,
    })

    // 終態後的晚到扣款（含 CANCELED 收到 Notify = mdfStatus end 未生效，AC-46）
    if (paidResult.outcome === 'anomalous') {
      await processAnomalousPeriodPayment({
        subscriptionId: subscription.id,
        gatewayPeriodKey: periodOrderNo,
        actualAmount: authAmt,
        gatewayMeta,
      })
      await completeWebhookEvent('payuni', eventId)
      return NextResponse.json({ message: 'OK' })
    }

    // ---- 未繳滿即走到最後排程期的防呆（AC-45）----
    // PAYUNi 判定「最後排程期」：NextAuthDate 為空，或 ThisPeriod == TotalTimes。
    // 若此時訂閱仍未 COMPLETED（renewal 依 paidPeriods<totalPeriods 未轉 COMPLETED）
    // → 標記 attentionReason=TERM_ENDED_UNDERPAID + 管理員告警（reauth 補扣後 count 語意天然更正）。
    if (paidResult.outcome === 'processed') {
      if (isLastScheduledPeriod && subscription.planType === 'FIXED_TERM') {
        const current = await prisma.courseSubscription.findUnique({
          where: { id: subscription.id },
          select: { status: true, paidPeriods: true, totalPeriods: true },
        })
        const underpaid =
          current != null &&
          current.status !== 'COMPLETED' &&
          current.totalPeriods != null &&
          current.paidPeriods < current.totalPeriods

        if (underpaid) {
          await prisma.courseSubscription.update({
            where: { id: subscription.id },
            data: { attentionReason: 'TERM_ENDED_UNDERPAID' },
          })
          sendAdminSubscriptionAlert({
            reason: 'TERM_ENDED_UNDERPAID',
            subscriptionId: subscription.id,
            courseTitle: subscription.course.title,
            userEmail: subscription.user.email,
            detail: `已終止但未繳滿（${current!.paidPeriods}/${current!.totalPeriods}）`,
          }).catch(() => {})
        }
      }
    }

    await completeWebhookEvent('payuni', eventId)
    return NextResponse.json({ message: 'OK' })
  } catch (error) {
    console.error('[PAYUNi Period Notify] 處理錯誤:', error)
    if (claimedEventId) {
      await failWebhookEvent('payuni', claimedEventId, error).catch(() => {})
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
