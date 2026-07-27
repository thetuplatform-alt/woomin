// lib/subscription/payuni-period.ts
// PAYUNi 續期收款狀態異動實作（mdfStatus：終止 / 重扣）。
//
// 加解密複用 lib/payment/payuni-crypto.ts；端點：/api/period/mdfStatus。
// gateway 實例經 getGatewayByType('payuni') 取得（DB 優先、env fallback 設定），
// 由 PayUniGateway.requestPeriodMdfStatus 帶正確 sandbox / 正式網域送出並解密回應。

import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { PayUniGateway } from '@/lib/payment/payuni-gateway'

/** 取得 PayUniGateway 實例（供 mdfStatus 呼叫） */
async function getPayUniGateway(): Promise<PayUniGateway> {
  const gw = await getGatewayByType('payuni')
  if (!(gw instanceof PayUniGateway)) {
    throw new Error('Gateway type mismatch: expected PayUniGateway')
  }
  return gw
}

/**
 * 終止整筆續期收款訂單（mdfStatus ReviseTradeStatus=end；不可逆）。
 * 供取消、退款後取消共用。
 *
 * 註：FIXED_TERM 由 PeriodTimes=N 自然停止，一般不需呼叫；UNLIMITED 取消時必呼叫。
 */
export async function endPayuniPeriod(params: {
  /** PAYUNi PeriodTradeNo（存於 CourseSubscription.gatewaySubscriptionId） */
  periodTradeNo: string
}): Promise<{ success: boolean; error?: string }> {
  const { periodTradeNo } = params

  try {
    const gateway = await getPayUniGateway()
    const res = await gateway.requestPeriodMdfStatus({
      PeriodTradeNo: periodTradeNo,
      ReviseTradeStatus: 'end',
    })

    if (res.Status === 'SUCCESS' || res.Status === 'PMDF02013') {
      return { success: true }
    }
    return {
      success: false,
      error: res.Message || `PAYUNi 終止失敗（Status=${res.Status}）`,
    }
  } catch (error) {
    console.error('[PAYUNi Period] mdfStatus end 失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PAYUNi 終止請求失敗',
    }
  }
}

/**
 * 對失敗期重新授權補扣（mdfStatus ReviseTradeStatus=reauth，帶 PeriodOrderNo 期數）。
 * 供後台 PAST_DUE「重新扣款」動作、未繳滿救援共用。
 *
 * 補扣結果不在此同步回傳的授權明細裡處理入帳——PAYUNi 會另以續期 Notify
 * 打到 /api/payment/period-notify（PeriodOrderNo 冪等），成功期即走正常入帳路徑。
 */
export async function reauthPayuniPeriod(params: {
  periodTradeNo: string
  /** 要重新授權的整數期別（PAYUNi mdfStatus 例：第 6 期傳 6） */
  periodNumber: number
}): Promise<{ success: boolean; error?: string }> {
  const { periodTradeNo, periodNumber } = params

  if (!Number.isInteger(periodNumber) || periodNumber < 1 || periodNumber > 900) {
    return { success: false, error: 'PAYUNi 重新扣款期別格式錯誤' }
  }

  try {
    const gateway = await getPayUniGateway()
    const res = await gateway.requestPeriodMdfStatus({
      PeriodTradeNo: periodTradeNo,
      ReviseTradeStatus: 'reauth',
      PeriodOrderNo: periodNumber,
    })

    if (res.Status === 'SUCCESS') {
      return { success: true }
    }
    return {
      success: false,
      error: res.Message || `PAYUNi 重新扣款失敗（Status=${res.Status}）`,
    }
  } catch (error) {
    console.error('[PAYUNi Period] mdfStatus reauth 失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PAYUNi 重新扣款請求失敗',
    }
  }
}
