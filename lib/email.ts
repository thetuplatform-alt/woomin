// lib/email.ts
// Email 發送功能
// 透過 transport 抽象層支援 Resend SDK 和 Nodemailer SMTP

import {
  purchaseConfirmationTemplate,
  passwordResetTemplate,
  passwordSetupTemplate,
  guestActivationTemplate,
  accountInviteTemplate,
  testEmailTemplate,
  adminPurchaseNotificationTemplate,
  expirationReminderTemplate,
  expiredNoticeTemplate,
  accessExtendedTemplate,
  subscriptionStartedTemplate,
  subscriptionRenewalReceiptTemplate,
  subscriptionPaymentFailedTemplate,
  subscriptionCanceledTemplate,
  subscriptionCompletedTemplate,
  subscriptionUpcomingRenewalTemplate,
  subscriptionAccessEndingTemplate,
  subscriptionTerminatedTemplate,
  adminSubscriptionAlertTemplate,
  type PurchaseConfirmationData,
  type AdminPurchaseNotificationData,
  type AdminSubscriptionAlertReasonCode,
  type EmailBranding,
} from '@/lib/email-templates'
import { getDisplaySiteName } from '@/lib/site-brand'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { resolveAppUrl } from '@/lib/app-url'
import { getEmailTransport, isEmailServiceConfigured } from '@/lib/email-transport'
import { resolveAssetUrl } from '@/lib/asset-url'

/**
 * 取得發送者 Email（優先從資料庫讀取，fallback 到環境變數）
 */
async function getEmailFrom(): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.EMAIL_FROM },
    })
    return setting?.value || process.env.EMAIL_FROM || 'noreply@example.com'
  } catch {
    return process.env.EMAIL_FROM || 'noreply@example.com'
  }
}

/**
 * Email 發送結果
 */
interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * 取得發送者名稱（從資料庫讀取）
 */
async function getSenderName(): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.EMAIL_SENDER_NAME },
    })
    const siteName = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.SITE_NAME },
    })
    return getDisplaySiteName(setting?.value || siteName?.value)
  } catch (error) {
    console.error('取得發送者名稱失敗:', error)
    return 'WooMin'
  }
}

async function getEmailBranding(): Promise<EmailBranding> {
  try {
    const [siteName, siteLogo] = await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: SETTING_KEYS.SITE_NAME } }),
      prisma.siteSetting.findUnique({ where: { key: SETTING_KEYS.SITE_LOGO } }),
    ])

    const appUrl = await resolveAppUrl()

    return {
      siteName: getDisplaySiteName(siteName?.value),
      siteLogo: resolveAssetUrl(siteLogo?.value, appUrl) || `${appUrl}/icon.png`,
      appUrl,
    }
  } catch {
    const appUrl = await resolveAppUrl()
    return {
      siteName: 'WooMin',
      siteLogo: `${appUrl}/icon.png`,
      appUrl,
    }
  }
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * 統一發送 Email 的內部方法
 */
async function sendEmail(params: {
  to: string[]
  subject: string
  html: string
  text?: string
  headers?: Record<string, string>
  replyTo?: string
}): Promise<SendEmailResult> {
  try {
    const transport = await getEmailTransport()
    if (!transport) {
      return {
        success: false,
        error: 'Email 服務未設定（請設定 Resend API Key 或 SMTP）',
      }
    }

    const [senderName, emailFrom] = await Promise.all([
      getSenderName(),
      getEmailFrom(),
    ])

    const result = await transport.send({
      from: `${senderName} <${emailFrom}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || htmlToPlainText(params.html),
      headers: params.headers,
      replyTo: params.replyTo,
    })

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    console.error('發送 Email 失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '發送失敗',
    }
  }
}

/**
 * 發送購課成功通知
 */
export async function sendPurchaseConfirmation(
  to: string,
  data: PurchaseConfirmationData
): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = purchaseConfirmationTemplate(data, branding)

  return sendEmail({
    to: [to],
    subject: `[${senderName}] 購課成功 - ${data.courseName}`,
    html,
  })
}

/**
 * 發送密碼重設郵件
 */
export async function sendPasswordReset(
  to: string,
  resetUrl: string,
  userName?: string
): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = passwordResetTemplate({
    userName: userName || '用戶',
    resetUrl,
  }, branding)

  return sendEmail({
    to: [to],
    subject: `[${senderName}] 密碼重設請求`,
    html,
  })
}

/**
 * 發送「設定登入密碼」信
 * 給所有尚未設定密碼的帳號使用：
 * - 純 OAuth 帳號（帶入 providerNames，說明可加開密碼登入）
 * - 訪客帳號 / 因忘記密碼而新建的帳號（providerNames 留空，首次設定密碼）
 * 取代過去對這些帳號「完全靜默不寄信」的行為
 */
export async function sendPasswordSetup(
  to: string,
  setupUrl: string,
  userName?: string,
  providerNames?: string
): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = passwordSetupTemplate({
    userName: userName || '用戶',
    setupUrl,
    providerNames,
  }, branding)

  return sendEmail({
    to: [to],
    subject: `[${senderName}] 設定你的登入密碼`,
    html,
  })
}

/**
 * 發送非會員帳號啟用信
 */
export async function sendGuestActivation(
  to: string,
  activationUrl: string,
  userName?: string
): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = guestActivationTemplate({
    userName: userName || '學員',
    activationUrl,
  }, branding)

  return sendEmail({
    to: [to],
    subject: `[${senderName}] 請完成帳號啟用`,
    html,
  })
}

/**
 * 發送帳號邀請信（被加入課程 / 被賦予講師或管理員身分）
 * 內含設定初始密碼連結，效期由呼叫端決定（預設 30 天）
 */
export async function sendAccountInvite(
  to: string,
  actionUrl: string,
  opts: {
    userName?: string
    courseTitles?: string[]
    roleLabel?: string
    expiresInDays?: number
  } = {}
): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = accountInviteTemplate(
    {
      userName: opts.userName || '您好',
      actionUrl,
      courseTitles: opts.courseTitles,
      roleLabel: opts.roleLabel,
      expiresInDays: opts.expiresInDays ?? 30,
    },
    branding
  )

  const subject = opts.roleLabel
    ? `[${senderName}] 您已被設為${opts.roleLabel}，請設定密碼`
    : `[${senderName}] 您已被加入課程，請設定密碼`

  return sendEmail({
    to: [to],
    subject,
    html,
  })
}

/**
 * 發送測試 Email
 */
export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = testEmailTemplate(branding)

  return sendEmail({
    to: [to],
    subject: `[${senderName}] Email 設定測試`,
    html,
  })
}

/**
 * 發送自訂 HTML Email
 */
export async function sendCustomHtmlEmail(params: {
  to: string
  subject: string
  html: string
  text?: string
  headers?: Record<string, string>
  replyTo?: string
}): Promise<SendEmailResult> {
  return sendEmail({
    to: [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
    headers: params.headers,
    replyTo: params.replyTo,
  })
}

/**
 * 發送管理員購買通知 Email
 * 寄送給所有 ADMIN 角色的用戶
 */
export async function sendAdminPurchaseNotification(
  data: AdminPurchaseNotificationData
): Promise<SendEmailResult> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  })

  const adminEmails = admins
    .map((a) => a.email)
    .filter((email): email is string => !!email)

  if (adminEmails.length === 0) {
    return { success: false, error: '找不到任何管理員 Email' }
  }

  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = adminPurchaseNotificationTemplate(data, branding)

  return sendEmail({
    to: adminEmails,
    subject: `[${senderName}] 新購買通知 - ${data.courseName}`,
    html,
  })
}

/**
 * 發送課程到期提醒（到期前 N 天）
 */
export async function sendCourseExpirationReminder(params: {
  toEmail: string
  userName: string | null
  courseName: string
  courseSlug: string
  firstLessonId?: string | null
  daysRemaining: number
  expiresAt: Date
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const courseUrl = params.firstLessonId
    ? `${branding.appUrl}/courses/${params.courseSlug}/lessons/${params.firstLessonId}`
    : `${branding.appUrl}/courses/${params.courseSlug}`
  const html = expirationReminderTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      courseUrl,
      daysRemaining: params.daysRemaining,
      expiresAt: params.expiresAt,
      renewUrl: `${branding.appUrl}/courses/${params.courseSlug}`,
    },
    branding
  )
  const subject =
    params.daysRemaining <= 3
      ? `[${senderName}] 倒數 ${params.daysRemaining} 天！《${params.courseName}》即將到期`
      : `[${senderName}] 您的《${params.courseName}》還有 ${params.daysRemaining} 天到期`
  return sendEmail({ to: [params.toEmail], subject, html })
}

/**
 * 發送課程已過期通知
 */
export async function sendCourseExpiredNotice(params: {
  toEmail: string
  userName: string | null
  courseName: string
  courseSlug: string
  expiredAt: Date
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = expiredNoticeTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      renewUrl: `${branding.appUrl}/courses/${params.courseSlug}`,
      expiredAt: params.expiredAt,
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 您的《${params.courseName}》觀看權限已到期`,
    html,
  })
}

/**
 * 發送授權延長/授予通知
 */
export async function sendCourseAccessExtendedEmail(params: {
  toEmail: string
  userName: string | null
  courseTitle: string
  courseSlug: string
  previousExpiresAt: Date | null
  newExpiresAt: Date | null
  reason: 'granted' | 'extended'
  note?: string | null
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = accessExtendedTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseTitle,
      courseUrl: `${branding.appUrl}/courses/${params.courseSlug}`,
      previousExpiresAt: params.previousExpiresAt,
      newExpiresAt: params.newExpiresAt,
      reason: params.reason,
      note: params.note,
    },
    branding
  )
  const subject =
    params.reason === 'granted'
      ? `[${senderName}] 《${params.courseTitle}》已為您開通`
      : `[${senderName}] 《${params.courseTitle}》有效期已更新`
  return sendEmail({ to: [params.toEmail], subject, html })
}

/**
 * 發送作業批改完成通知
 */
export async function sendAssignmentReviewedEmail(params: {
  toEmail: string
  userName: string
  courseName: string
  lessonTitle: string
  result: string
  feedback?: string
  score?: number
  letterGrade?: string
  courseSlug: string
  lessonId: string
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const { assignmentReviewedTemplate } = await import('@/lib/email-templates')
  const html = assignmentReviewedTemplate(
    {
      userName: params.userName,
      courseName: params.courseName,
      lessonTitle: params.lessonTitle,
      result: params.result,
      feedback: params.feedback,
      score: params.score,
      letterGrade: params.letterGrade,
      lessonUrl: `${branding.appUrl}/courses/${params.courseSlug}/lessons/${params.lessonId}`,
    },
    branding
  )
  const subject = `[${senderName}] 作業批改結果：${params.lessonTitle}`
  return sendEmail({ to: [params.toEmail], subject, html })
}

/**
 * 發送作業退回修改通知
 */
export async function sendAssignmentRevisionEmail(params: {
  toEmail: string
  userName: string
  courseName: string
  lessonTitle: string
  feedback?: string
  courseSlug: string
  lessonId: string
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const { assignmentRevisionTemplate } = await import('@/lib/email-templates')
  const html = assignmentRevisionTemplate(
    {
      userName: params.userName,
      courseName: params.courseName,
      lessonTitle: params.lessonTitle,
      feedback: params.feedback,
      lessonUrl: `${branding.appUrl}/courses/${params.courseSlug}/lessons/${params.lessonId}`,
    },
    branding
  )
  const subject = `[${senderName}] 作業需要修改：${params.lessonTitle}`
  return sendEmail({ to: [params.toEmail], subject, html })
}

/**
 * 發送老師私訊回覆通知
 */
export async function sendPrivateMessageReplyEmail(params: {
  toEmail: string
  userName: string
  courseName: string
  lessonTitle: string
  replyContent: string
  courseSlug: string
  lessonId: string
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const { privateMessageReplyTemplate } = await import('@/lib/email-templates')
  const html = privateMessageReplyTemplate(
    {
      userName: params.userName,
      courseName: params.courseName,
      lessonTitle: params.lessonTitle,
      replyContent: params.replyContent,
      lessonUrl: `${branding.appUrl}/courses/${params.courseSlug}/lessons/${params.lessonId}`,
    },
    branding
  )
  const subject = `[${senderName}] 老師回覆了你的私訊：${params.lessonTitle}`
  return sendEmail({ to: [params.toEmail], subject, html })
}

// ==================== 訂閱制通知（PRD §7：8 用戶 + 1 管理員告警） ====================

/**
 * 取得站台聯絡信箱（PAYUNi 自救指引 / 訂閱終止恢復指引用；未設定回 null）
 */
async function getContactEmail(): Promise<string | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.CONTACT_EMAIL },
    })
    return setting?.value || null
  } catch {
    return null
  }
}

/**
 * 依課程 slug 組課程頁 URL；無 slug 時退回「我的課程」頁
 */
function buildCourseUrl(appUrl: string, courseSlug?: string | null): string {
  return courseSlug
    ? `${appUrl}/courses/${courseSlug}`
    : `${appUrl}/my-courses`
}

/**
 * #1 發送訂閱成功通知（首期成功時寄；不重複寄標準購買確認信）
 */
export async function sendSubscriptionStartedEmail(params: {
  toEmail: string
  userName: string | null
  courseName: string
  planLabel: string
  pricePerPeriod: number
  nextBillingAt: Date | null
  /** 扣款週期（用於顯示「每月／每年」）；未提供時以中性「每期」呈現 */
  interval?: 'MONTH' | 'YEAR' | null
  /** 是否為期限（分期）訂閱 */
  isFixedTerm?: boolean
  /** 期限訂閱總期數 */
  totalPeriods?: number | null
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const intervalLabel =
    params.interval === 'YEAR' ? '每年' : params.interval === 'MONTH' ? '每月' : '每期'
  const html = subscriptionStartedTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      planLabel: params.planLabel,
      pricePerPeriod: params.pricePerPeriod,
      intervalLabel,
      nextBillingAt: params.nextBillingAt,
      isFixedTerm: params.isFixedTerm ?? false,
      totalPeriods: params.totalPeriods,
      manageUrl: `${branding.appUrl}/my-subscriptions`,
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 訂閱成功 - ${params.courseName}`,
    html,
  })
}

/**
 * #2 發送第 N 期扣款成功收據（含管理訂閱／取消訂閱連結）
 */
export async function sendSubscriptionRenewalReceiptEmail(params: {
  toEmail: string
  userName: string | null
  courseName: string
  periodNumber: number
  amount: number
  orderNo: string
  nextBillingAt: Date | null
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = subscriptionRenewalReceiptTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      periodNumber: params.periodNumber,
      amount: params.amount,
      orderNo: params.orderNo,
      nextBillingAt: params.nextBillingAt,
      manageUrl: `${branding.appUrl}/my-subscriptions`,
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 訂閱扣款收據（第 ${params.periodNumber} 期） - ${params.courseName}`,
    html,
  })
}

/**
 * #3 發送訂閱扣款失敗通知（Stripe 附補繳連結、PAYUNi 附自救指引）
 */
export async function sendSubscriptionPaymentFailedEmail(params: {
  toEmail: string
  userName: string | null
  courseName: string
  gateway: string
  hostedInvoiceUrl?: string | null
  accessEndsAt: Date | null
}): Promise<SendEmailResult> {
  const [senderName, branding, contactEmail] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
    getContactEmail(),
  ])
  const html = subscriptionPaymentFailedTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      gateway: params.gateway,
      hostedInvoiceUrl: params.hostedInvoiceUrl,
      accessEndsAt: params.accessEndsAt,
      manageUrl: `${branding.appUrl}/my-subscriptions`,
      contactEmail,
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 訂閱扣款失敗，請儘快處理 - ${params.courseName}`,
    html,
  })
}

/**
 * #4 發送訂閱取消確認（實際存取截止日、恢復管道）
 */
export async function sendSubscriptionCanceledEmail(params: {
  toEmail: string
  userName: string | null
  courseName: string
  courseSlug?: string | null
  accessEndsAt: Date | null
  isFixedTerm: boolean
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = subscriptionCanceledTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      accessEndsAt: params.accessEndsAt,
      isFixedTerm: params.isFixedTerm,
      courseUrl: buildCourseUrl(branding.appUrl!, params.courseSlug),
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 訂閱已取消 - ${params.courseName}`,
    html,
  })
}

/**
 * #5 發送分期繳清轉永久恭喜信
 */
export async function sendSubscriptionCompletedEmail(params: {
  toEmail: string
  userName: string | null
  courseName: string
  courseSlug?: string | null
  totalPeriods: number
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = subscriptionCompletedTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      totalPeriods: params.totalPeriods,
      courseUrl: buildCourseUrl(branding.appUrl!, params.courseSlug),
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 恭喜！您已永久擁有《${params.courseName}》`,
    html,
  })
}

/**
 * #6 發送即將扣款提醒（依 renewalReminderDays）
 */
export async function sendSubscriptionUpcomingRenewalEmail(params: {
  toEmail: string
  userName: string | null
  courseName: string
  nextBillingAt: Date
  amount: number
  periodNumber: number
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = subscriptionUpcomingRenewalTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      nextBillingAt: params.nextBillingAt,
      amount: params.amount,
      periodNumber: params.periodNumber,
      manageUrl: `${branding.appUrl}/my-subscriptions`,
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 即將自動扣款提醒 - ${params.courseName}`,
    html,
  })
}

/**
 * #7 發送存取即將結束通知（END_ACCESS 期滿與 CANCELED 期末前 7 天）
 */
export async function sendSubscriptionAccessEndingEmail(params: {
  toEmail: string
  userName: string | null
  courseName: string
  courseSlug?: string | null
  accessEndsAt: Date
}): Promise<SendEmailResult> {
  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = subscriptionAccessEndingTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      accessEndsAt: params.accessEndsAt,
      courseUrl: buildCourseUrl(branding.appUrl!, params.courseSlug),
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 觀看權限即將結束 - ${params.courseName}`,
    html,
  })
}

/**
 * #8 發送訂閱已終止通知（gateway 非自願終止，含恢復指引）
 */
export async function sendSubscriptionTerminatedEmail(params: {
  toEmail: string
  userName: string | null
  courseName: string
  courseSlug?: string | null
  accessEndsAt: Date | null
}): Promise<SendEmailResult> {
  const [senderName, branding, contactEmail] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
    getContactEmail(),
  ])
  const html = subscriptionTerminatedTemplate(
    {
      userName: params.userName ?? '學員',
      courseName: params.courseName,
      accessEndsAt: params.accessEndsAt,
      courseUrl: buildCourseUrl(branding.appUrl!, params.courseSlug),
      contactEmail,
    },
    branding
  )
  return sendEmail({
    to: [params.toEmail],
    subject: `[${senderName}] 訂閱已終止 - ${params.courseName}`,
    html,
  })
}

/**
 * #9 發送管理員訂閱告警（reason 參數化；寄給所有 ADMIN）
 */
export async function sendAdminSubscriptionAlertEmail(params: {
  reason: AdminSubscriptionAlertReasonCode
  subscriptionId: string
  courseName: string
  userEmail?: string | null
  detail?: string | null
}): Promise<SendEmailResult> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  })

  const adminEmails = admins
    .map((a) => a.email)
    .filter((email): email is string => !!email)

  if (adminEmails.length === 0) {
    return { success: false, error: '找不到任何管理員 Email' }
  }

  const [senderName, branding] = await Promise.all([
    getSenderName(),
    getEmailBranding(),
  ])
  const html = adminSubscriptionAlertTemplate(
    {
      reason: params.reason,
      subscriptionId: params.subscriptionId,
      courseName: params.courseName,
      userEmail: params.userEmail,
      detail: params.detail,
      adminUrl: `${branding.appUrl}/admin/subscriptions`,
    },
    branding
  )
  return sendEmail({
    to: adminEmails,
    subject: `[${senderName}] 訂閱告警 - ${params.courseName}`,
    html,
  })
}

/**
 * 檢查 Email 服務是否已設定
 */
export async function isEmailConfigured(): Promise<boolean> {
  return isEmailServiceConfigured()
}
