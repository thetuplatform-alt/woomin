// lib/subscription/notifications.ts
// 訂閱制通知（Email + 管理員告警）契約層。
//
// 8 個用戶模板 + 1 個管理員告警模板（PRD §7）。此檔定義所有寄信函式簽名，
// 讓 renewal.ts / service.ts / cron / webhook 得以引用並編譯；實際模板與寄送
// 在 lib/email.ts / lib/email-templates.ts（走 EmailBranding + escapeHtml）。
// 此層負責把訂閱語意轉成寄信參數，並保證 fire-and-forget 容錯——寄信失敗
// 絕不阻斷金流（AC-68）。簽名不得變更（地基契約）。

import {
  sendSubscriptionStartedEmail,
  sendSubscriptionRenewalReceiptEmail,
  sendSubscriptionPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionCompletedEmail,
  sendSubscriptionUpcomingRenewalEmail,
  sendSubscriptionAccessEndingEmail,
  sendSubscriptionTerminatedEmail,
  sendAdminSubscriptionAlertEmail,
} from '@/lib/email'

/** 訂閱通知共用的最小識別資料 */
export interface SubscriptionNotifyContext {
  subscriptionId: string
  toEmail: string | null
  userName?: string | null
  courseTitle: string
  /** 站台可觀看 / 管理訂閱的基底 URL（組連結用；缺省由實作端讀設定） */
  baseUrl?: string
}

/**
 * fire-and-forget 容錯包裝：吞掉所有例外並記錄 warning，
 * 確保任何寄信路徑都不會 reject 而阻斷上游金流流程（AC-68）。
 */
async function safeSend(fn: string, ctx: { subscriptionId?: string }, task: () => Promise<unknown>): Promise<void> {
  try {
    await task()
  } catch (error) {
    console.error(
      `[subscription] email 發送失敗: ${fn}`,
      ctx.subscriptionId ? `sub=${ctx.subscriptionId}` : '',
      error
    )
  }
}

/** #1 訂閱成功（方案、每期金額、下次扣款日、如何取消） */
export async function sendSubscriptionStarted(
  ctx: SubscriptionNotifyContext & {
    planLabel: string
    pricePerPeriod: number
    nextBillingAt: Date | null
  }
): Promise<void> {
  if (!ctx.toEmail) return
  const toEmail = ctx.toEmail
  await safeSend('sendSubscriptionStarted', ctx, () =>
    sendSubscriptionStartedEmail({
      toEmail,
      userName: ctx.userName ?? null,
      courseName: ctx.courseTitle,
      planLabel: ctx.planLabel,
      pricePerPeriod: ctx.pricePerPeriod,
      nextBillingAt: ctx.nextBillingAt,
    })
  )
}

/** #2 第 N 期扣款成功收據（含「管理訂閱／取消訂閱」連結——卡組織要求） */
export async function sendSubscriptionRenewalReceipt(
  ctx: SubscriptionNotifyContext & {
    periodNumber: number
    amount: number
    nextBillingAt: Date | null
    orderNo: string
  }
): Promise<void> {
  if (!ctx.toEmail) return
  const toEmail = ctx.toEmail
  await safeSend('sendSubscriptionRenewalReceipt', ctx, () =>
    sendSubscriptionRenewalReceiptEmail({
      toEmail,
      userName: ctx.userName ?? null,
      courseName: ctx.courseTitle,
      periodNumber: ctx.periodNumber,
      amount: ctx.amount,
      orderNo: ctx.orderNo,
      nextBillingAt: ctx.nextBillingAt,
    })
  )
}

/** #3 扣款失敗（Stripe 附 hosted invoice 補繳連結；PAYUNi 附自救指引） */
export async function sendSubscriptionPaymentFailed(
  ctx: SubscriptionNotifyContext & {
    gateway: string
    /** Stripe：hosted_invoice_url 補繳連結 */
    hostedInvoiceUrl?: string | null
    /** 斷權日（含寬限） */
    accessEndsAt: Date | null
  }
): Promise<void> {
  if (!ctx.toEmail) return
  const toEmail = ctx.toEmail
  await safeSend('sendSubscriptionPaymentFailed', ctx, () =>
    sendSubscriptionPaymentFailedEmail({
      toEmail,
      userName: ctx.userName ?? null,
      courseName: ctx.courseTitle,
      gateway: ctx.gateway,
      hostedInvoiceUrl: ctx.hostedInvoiceUrl,
      accessEndsAt: ctx.accessEndsAt,
    })
  )
}

/** #4 取消確認（實際存取截止日、恢復管道） */
export async function sendSubscriptionCanceled(
  ctx: SubscriptionNotifyContext & {
    /** 實際存取截止日（= expiresAt 含寬限） */
    accessEndsAt: Date | null
    /** 是否為期限訂閱（信中須明示分期不轉永久） */
    isFixedTerm: boolean
  }
): Promise<void> {
  if (!ctx.toEmail) return
  const toEmail = ctx.toEmail
  await safeSend('sendSubscriptionCanceled', ctx, () =>
    sendSubscriptionCanceledEmail({
      toEmail,
      userName: ctx.userName ?? null,
      courseName: ctx.courseTitle,
      accessEndsAt: ctx.accessEndsAt,
      isFixedTerm: ctx.isFixedTerm,
    })
  )
}

/** #5 分期繳清轉永久（恭喜信） */
export async function sendSubscriptionCompleted(
  ctx: SubscriptionNotifyContext & {
    totalPeriods: number
  }
): Promise<void> {
  if (!ctx.toEmail) return
  const toEmail = ctx.toEmail
  await safeSend('sendSubscriptionCompleted', ctx, () =>
    sendSubscriptionCompletedEmail({
      toEmail,
      userName: ctx.userName ?? null,
      courseName: ctx.courseTitle,
      totalPeriods: ctx.totalPeriods,
    })
  )
}

/** #6 即將扣款提醒（依 renewalReminderDays；YEAR 強制 ≥7 天） */
export async function sendSubscriptionUpcomingRenewal(
  ctx: SubscriptionNotifyContext & {
    nextBillingAt: Date
    amount: number
    periodNumber: number
  }
): Promise<void> {
  if (!ctx.toEmail) return
  const toEmail = ctx.toEmail
  await safeSend('sendSubscriptionUpcomingRenewal', ctx, () =>
    sendSubscriptionUpcomingRenewalEmail({
      toEmail,
      userName: ctx.userName ?? null,
      courseName: ctx.courseTitle,
      nextBillingAt: ctx.nextBillingAt,
      amount: ctx.amount,
      periodNumber: ctx.periodNumber,
    })
  )
}

/** #7 存取即將結束（END_ACCESS 期滿與 CANCELED 的期末前 7 天） */
export async function sendSubscriptionAccessEnding(
  ctx: SubscriptionNotifyContext & {
    accessEndsAt: Date
  }
): Promise<void> {
  if (!ctx.toEmail) return
  const toEmail = ctx.toEmail
  await safeSend('sendSubscriptionAccessEnding', ctx, () =>
    sendSubscriptionAccessEndingEmail({
      toEmail,
      userName: ctx.userName ?? null,
      courseName: ctx.courseTitle,
      accessEndsAt: ctx.accessEndsAt,
    })
  )
}

/** #8 訂閱已終止（gateway 非自願終止，含恢復指引） */
export async function sendSubscriptionTerminated(
  ctx: SubscriptionNotifyContext & {
    accessEndsAt: Date | null
  }
): Promise<void> {
  if (!ctx.toEmail) return
  const toEmail = ctx.toEmail
  await safeSend('sendSubscriptionTerminated', ctx, () =>
    sendSubscriptionTerminatedEmail({
      toEmail,
      userName: ctx.userName ?? null,
      courseName: ctx.courseTitle,
      accessEndsAt: ctx.accessEndsAt,
    })
  )
}

/** 管理員告警可能的原因 */
export type AdminSubscriptionAlertReason =
  | 'PAST_DUE'
  | 'GATEWAY_TERMINATED'
  | 'ANOMALOUS_PERIOD_PAYMENT'
  | 'TERM_ENDED_UNDERPAID'
  | 'WEBHOOK_STALE'
  | 'CANCEL_RETRY_EXHAUSTED'

/** #9 管理員訂閱告警（參數化單模板；寄給所有 ADMIN） */
export async function sendAdminSubscriptionAlert(params: {
  reason: AdminSubscriptionAlertReason
  subscriptionId: string
  courseTitle: string
  userEmail?: string | null
  /** 附加說明（如「已終止但未繳滿 11/12」「晚到扣款已自動退款」） */
  detail?: string
}): Promise<void> {
  await safeSend('sendAdminSubscriptionAlert', params, () =>
    sendAdminSubscriptionAlertEmail({
      reason: params.reason,
      subscriptionId: params.subscriptionId,
      courseName: params.courseTitle,
      userEmail: params.userEmail,
      detail: params.detail,
    })
  )
}
