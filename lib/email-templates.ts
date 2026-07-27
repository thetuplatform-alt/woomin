// lib/email-templates.ts
// Email 模板
// 提供各種通知信件的 HTML 模板

/**
 * HTML escape — 防止用戶輸入的內容在 Email 中造成 HTML injection
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface EmailBranding {
  siteName: string
  siteLogo: string
  appUrl?: string
}

const DEFAULT_EMAIL_APP_URL = process.env.NODE_ENV === 'production'
  ? 'https://example.com'
  : 'http://localhost:3000'
const INTERNAL_EMAIL_HOSTS = new Set(['0.0.0.0', '::', '[::]', 'localhost', '127.0.0.1', '::1', '[::1]'])

function normalizeEmailAppUrl(value?: string): string {
  if (!value) return DEFAULT_EMAIL_APP_URL
  try {
    const url = new URL(value)
    if (process.env.NODE_ENV === 'production' && INTERNAL_EMAIL_HOSTS.has(url.hostname.toLowerCase())) {
      return DEFAULT_EMAIL_APP_URL
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_EMAIL_APP_URL
  }
}

function normalizeEmailAssetUrl(value: string | undefined, appUrl: string): string {
  if (!value) return `${appUrl}/icon.png`
  try {
    const url = new URL(value)
    if (INTERNAL_EMAIL_HOSTS.has(url.hostname.toLowerCase())) {
      return new URL(`${url.pathname}${url.search}${url.hash}`, appUrl).toString()
    }
    return value
  } catch {
    return value.startsWith('/') ? new URL(value, appUrl).toString() : value
  }
}

function getEmailBranding(branding?: Partial<EmailBranding>): EmailBranding {
  const appUrl = normalizeEmailAppUrl(branding?.appUrl)
  return {
    siteName: branding?.siteName || 'WooMin',
    siteLogo: normalizeEmailAssetUrl(branding?.siteLogo, appUrl),
    appUrl,
  }
}

/**
 * 共用 Email 樣式
 */
const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
`

const containerStyles = `
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
  background-color: #ffffff;
`

const headerStyles = `
  text-align: center;
  padding-bottom: 30px;
  border-bottom: 1px solid #eee;
  margin-bottom: 30px;
`

function getLogoHtml(branding?: Partial<EmailBranding>): string {
  const resolved = getEmailBranding(branding)
  return `<img src="${resolved.siteLogo}" alt="${resolved.siteName}" width="50" height="50" style="border-radius: 12px; margin-bottom: 10px; display: inline-block;" />`
}

const buttonStyles = `
  display: inline-block;
  padding: 14px 28px;
  background-color: #6366F1;
  color: #ffffff;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  margin: 20px 0;
`

const footerStyles = `
  text-align: center;
  padding-top: 30px;
  border-top: 1px solid #eee;
  margin-top: 30px;
  color: #666;
  font-size: 14px;
`

const infoBoxStyles = `
  background-color: #f8fafc;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
`

/**
 * 購課成功通知模板
 */
export interface PurchaseConfirmationData {
  userName: string
  courseName: string
  orderNo: string
  amount: number
}

export function purchaseConfirmationTemplate(
  data: PurchaseConfirmationData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>購課成功</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <!-- Header -->
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <!-- Content -->
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="party">&#x1F389;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 28px;">購課成功！</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            親愛的 ${escapeHtml(data.userName)}，感謝您的購買！
          </p>
        </div>

        <!-- Order Info -->
        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">課程名稱</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${escapeHtml(data.courseName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">訂單編號</td>
              <td style="padding: 8px 0; color: #333; text-align: right; font-family: monospace;">${escapeHtml(data.orderNo)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">付款金額</td>
              <td style="padding: 8px 0; color: #3b82f6; font-weight: 600; text-align: right;">NT$ ${data.amount.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center;">
          <p style="color: #666; font-size: 16px; margin: 0 0 10px 0;">
            現在就開始學習吧！
          </p>
          <a href="${resolved.appUrl}/courses" style="${buttonStyles}">
            前往課程
          </a>
        </div>

        <!-- Footer -->
        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            如有任何問題，請隨時聯繫我們。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * 密碼重設模板
 */
export interface PasswordResetData {
  userName: string
  resetUrl: string
}

export function passwordResetTemplate(
  data: PasswordResetData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>密碼重設</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <!-- Header -->
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <!-- Content -->
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="key">&#x1F511;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 28px;">密碼重設請求</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            親愛的 ${escapeHtml(data.userName)}，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            我們收到了您的密碼重設請求。<br>
            請點擊下方按鈕來重設您的密碼。
          </p>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center;">
          <a href="${data.resetUrl}" style="${buttonStyles}">
            重設密碼
          </a>
        </div>

        <!-- Warning -->
        <div style="${infoBoxStyles} background-color: #fff7ed; border-left: 4px solid #f97316;">
          <p style="color: #9a3412; font-size: 14px; margin: 0;">
            <strong>注意：</strong>此連結將在 1 小時後失效。<br>
            如果您沒有發起此請求，請忽略這封信件。
          </p>
        </div>

        <!-- Alternative Link -->
        <div style="margin-top: 20px;">
          <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
            如果按鈕無法點擊，請複製以下連結到瀏覽器：
          </p>
          <p style="color: #3b82f6; font-size: 12px; word-break: break-all; margin: 0;">
            ${data.resetUrl}
          </p>
        </div>

        <!-- Footer -->
        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            如有任何問題，請隨時聯繫我們。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export interface PasswordSetupData {
  userName: string
  setupUrl: string
  // 若帳號原本綁定社群登入（Google / Apple），帶入其名稱以顯示對應說明；
  // 訪客 / 純新建帳號則留空
  providerNames?: string
}

/**
 * 「設定登入密碼」信：涵蓋所有「尚未設定密碼」的情境
 * - 純 OAuth 帳號（僅用 Google / Apple 登入）：加開一組密碼登入，原社群登入不受影響
 * - 訪客帳號 / 因忘記密碼而新建的帳號：首次設定登入密碼
 */
export function passwordSetupTemplate(
  data: PasswordSetupData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const bodyCopy = data.providerNames
    ? `您的帳號目前是使用 <strong>${escapeHtml(data.providerNames)}</strong> 登入，尚未設定密碼。<br>
       點擊下方按鈕即可額外設定一組登入密碼；設定後，原本的社群帳號登入方式仍可繼續使用。`
    : `點擊下方按鈕即可設定您的登入密碼，設定完成後即可使用 Email 加密碼登入。`
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>設定登入密碼</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <!-- Header -->
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <!-- Content -->
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="key">&#x1F511;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 28px;">為帳號設定登入密碼</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            ${bodyCopy}
          </p>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center;">
          <a href="${data.setupUrl}" style="${buttonStyles}">
            設定密碼
          </a>
        </div>

        <!-- Warning -->
        <div style="${infoBoxStyles} background-color: #fff7ed; border-left: 4px solid #f97316;">
          <p style="color: #9a3412; font-size: 14px; margin: 0;">
            <strong>注意：</strong>此連結將在 1 小時後失效。<br>
            如果您沒有發起此請求，請忽略這封信件，您的帳號不會有任何變動。
          </p>
        </div>

        <!-- Alternative Link -->
        <div style="margin-top: 20px;">
          <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
            如果按鈕無法點擊，請複製以下連結到瀏覽器：
          </p>
          <p style="color: #3b82f6; font-size: 12px; word-break: break-all; margin: 0;">
            ${data.setupUrl}
          </p>
        </div>

        <!-- Footer -->
        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            如有任何問題，請隨時聯繫我們。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * 帳號邀請信模板（被管理員加入課程 / 被賦予講師或管理員身分時寄出）
 * 同時涵蓋兩種情境：
 * - courseTitles：被加入的課程清單
 * - roleLabel：被賦予的角色（講師 / 管理員）
 * 內含「設定初始密碼」CTA，並明示連結有效天數（預設 30 天）
 */
export interface AccountInviteData {
  userName: string
  actionUrl: string
  courseTitles?: string[]
  roleLabel?: string
  expiresInDays?: number
}

export function accountInviteTemplate(
  data: AccountInviteData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const expiresInDays = data.expiresInDays ?? 30
  const hasCourses = !!data.courseTitles && data.courseTitles.length > 0
  const hasRole = !!data.roleLabel

  // 主標題與說明依情境切換
  const heading = hasRole
    ? `您已被設為${escapeHtml(data.roleLabel as string)}`
    : '您已被加入課程'

  const introLines: string[] = []
  if (hasRole) {
    introLines.push(
      `您已被指派為 ${escapeHtml(resolved.siteName)} 的<strong>${escapeHtml(
        data.roleLabel as string
      )}</strong>。`
    )
  } else {
    introLines.push(`您已被加入 ${escapeHtml(resolved.siteName)} 線上課程平台。`)
  }
  introLines.push('請點擊下方按鈕設定您的初始密碼，即可登入並開始使用。')

  const coursesHtml = hasCourses
    ? `
        <div style="${infoBoxStyles}">
          <p style="color: #333; font-size: 14px; margin: 0 0 8px 0;"><strong>已為您開通以下課程：</strong></p>
          <ul style="color: #555; font-size: 14px; margin: 0; padding-left: 20px;">
            ${(data.courseTitles as string[])
              .map((title) => `<li style="margin: 4px 0;">${escapeHtml(title)}</li>`)
              .join('')}
          </ul>
        </div>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${heading}</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 28px;">${heading}</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 12px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            ${introLines.join('<br/>')}
          </p>
        </div>

        ${coursesHtml}

        <div style="text-align: center;">
          <a href="${data.actionUrl}" style="${buttonStyles}">
            設定初始密碼
          </a>
        </div>

        <div style="${infoBoxStyles} background-color: #fff7ed; border-left: 4px solid #f97316;">
          <p style="color: #9a3412; font-size: 14px; margin: 0;">
            <strong>注意：</strong>此連結將在 ${expiresInDays} 天後失效，屆時需要重新申請。
          </p>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            如果您並未預期收到此邀請，可以直接忽略本信件。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export interface GuestActivationData {
  userName: string
  activationUrl: string
}

export function guestActivationTemplate(
  data: GuestActivationData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>請完成帳號啟用</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 28px;">只差一步，完成帳號啟用</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            ${escapeHtml(data.userName)} 您好，感謝您的購買！
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            請點擊下方按鈕設定密碼並啟用帳號，即可開始學習課程。
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.activationUrl}" style="${buttonStyles}">
            啟用帳號
          </a>
        </div>

        <div style="${infoBoxStyles} background-color: #fff7ed; border-left: 4px solid #f97316;">
          <p style="color: #9a3412; font-size: 14px; margin: 0;">
            <strong>注意：</strong>此連結將在 24 小時後失效，届時需要重新申請。
          </p>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            如有任何問題，歡迎隨時聯繫我們。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * 測試 Email 模板
 */
export function testEmailTemplate(branding?: Partial<EmailBranding>): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const timestamp = new Date().toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email 測試</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <!-- Header -->
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <!-- Content -->
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="check">&#x2705;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 28px;">Email 設定測試成功！</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            恭喜，您的 Email 設定已正確運作。
          </p>
        </div>

        <!-- Info -->
        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">發送時間</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Email 服務</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">已連線</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">狀態</td>
              <td style="padding: 8px 0; color: #22c55e; font-weight: 600; text-align: right;">正常運作</td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            此為系統自動發送的測試信件。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * 管理員購買通知 Email 資料
 */
export interface AdminPurchaseNotificationData {
  studentName: string
  studentEmail: string
  courseName: string
  orderNo: string
  amount: number
  paidAt: Date
}

export function adminPurchaseNotificationTemplate(
  data: AdminPurchaseNotificationData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const paidAtStr = data.paidAt.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>新購買通知</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <!-- Header -->
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <!-- Content -->
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="money">&#x1F4B0;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 28px;">新購買通知</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            有學員完成了課程購買！
          </p>
        </div>

        <!-- Order Info -->
        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">學員名稱</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${escapeHtml(data.studentName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">學員 Email</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">${escapeHtml(data.studentEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">購買課程</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${escapeHtml(data.courseName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">訂單編號</td>
              <td style="padding: 8px 0; color: #333; text-align: right; font-family: monospace;">${escapeHtml(data.orderNo)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">付款金額</td>
              <td style="padding: 8px 0; color: #3b82f6; font-weight: 600; text-align: right;">NT$ ${data.amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">付款時間</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">${paidAtStr}</td>
            </tr>
          </table>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center;">
          <a href="${resolved.appUrl}/admin/orders" style="${buttonStyles}">
            查看訂單管理
          </a>
        </div>

        <!-- Footer -->
        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            此為系統自動發送的管理員通知信件
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * 到期提醒（到期前 N 天）
 */
export interface ExpirationReminderData {
  userName: string
  courseName: string
  courseUrl: string
  daysRemaining: number
  expiresAt: Date
  renewUrl?: string
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function expirationReminderTemplate(
  data: ExpirationReminderData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const urgent = data.daysRemaining <= 3
  const subjectLine = urgent
    ? `倒數 ${data.daysRemaining} 天！即將失去《${data.courseName}》觀看權限`
    : `您的《${data.courseName}》還有 ${data.daysRemaining} 天到期`
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(subjectLine)}</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="alarm">${urgent ? '&#x23F0;' : '&#x1F4C6;'}</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">
            ${urgent ? '課程即將到期提醒' : '課程到期提醒'}
          </h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 12px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            您在 ${resolved.siteName} 購買的《${escapeHtml(data.courseName)}》
            <br />
            將於 <strong style="color: ${urgent ? '#dc2626' : '#d97706'};">${formatDate(data.expiresAt)}</strong> 到期，
            <br />
            還剩 <strong style="color: ${urgent ? '#dc2626' : '#d97706'};">${data.daysRemaining}</strong> 天可以觀看。
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <p style="color: #555; font-size: 14px; margin: 0;">
            建議您在到期前完成未看完的單元；若需要延長觀看期限，可透過下方連結重新購買。
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.courseUrl}" style="${buttonStyles}">前往觀看課程</a>
          ${
            data.renewUrl
              ? `<br /><a href="${data.renewUrl}" style="color:#3b82f6; font-size:14px; text-decoration:underline;">延長觀看期限</a>`
              : ''
          }
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * 已過期通知
 */
export interface ExpiredNoticeData {
  userName: string
  courseName: string
  renewUrl: string
  expiredAt: Date
}

export function expiredNoticeTemplate(
  data: ExpiredNoticeData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>課程已到期</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">課程觀看權限已到期</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            您購買的《${escapeHtml(data.courseName)}》已於 <strong>${formatDate(data.expiredAt)}</strong> 到期，
            <br />
            目前暫時無法觀看課程內容。若您想繼續學習，可透過下方連結重新購買。
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.renewUrl}" style="${buttonStyles}">重新購買課程</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * 授權延長/授予通知
 */
export interface AccessExtendedData {
  userName: string
  courseName: string
  courseUrl: string
  previousExpiresAt: Date | null
  newExpiresAt: Date | null
  reason: 'granted' | 'extended'
  note?: string | null
}

export function accessExtendedTemplate(
  data: AccessExtendedData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const title =
    data.reason === 'granted' ? '課程已為您開通' : '課程有效期已更新'
  const newText = data.newExpiresAt
    ? formatDate(data.newExpiresAt)
    : '永久有效'
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">${title}</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 16px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            您的《${escapeHtml(data.courseName)}》
            ${
              data.reason === 'granted'
                ? '已為您開通觀看權限。'
                : '觀看期限已更新。'
            }
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">新的到期時間</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${newText}</td>
            </tr>
            ${
              data.previousExpiresAt
                ? `<tr>
              <td style="padding: 8px 0; color: #666;">原本到期時間</td>
              <td style="padding: 8px 0; color: #999; text-align: right;">${formatDate(data.previousExpiresAt)}</td>
            </tr>`
                : ''
            }
            ${
              data.note
                ? `<tr>
              <td style="padding: 8px 0; color: #666;">備註</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">${escapeHtml(data.note)}</td>
            </tr>`
                : ''
            }
          </table>
        </div>

        <div style="text-align: center;">
          <a href="${data.courseUrl}" style="${buttonStyles}">前往觀看課程</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// ==================== 作業通知模板 ====================

export interface AssignmentReviewedData {
  userName: string
  courseName: string
  lessonTitle: string
  result: string // '通過' | '未通過'
  feedback?: string
  score?: number
  letterGrade?: string
  lessonUrl: string
}

export function assignmentReviewedTemplate(
  data: AssignmentReviewedData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const resultColor = data.result === '通過' ? '#22c55e' : '#ef4444'

  const scoreHtml = data.score !== undefined
    ? `<tr><td style="padding: 8px 0; color: #666;">分數</td><td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${data.score} 分</td></tr>`
    : ''

  const gradeHtml = data.letterGrade
    ? `<tr><td style="padding: 8px 0; color: #666;">等第</td><td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${escapeHtml(data.letterGrade)}</td></tr>`
    : ''

  const feedbackHtml = data.feedback
    ? `<div style="margin: 20px 0; padding: 16px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">老師評語</p>
        <p style="margin: 0; color: #333;">${escapeHtml(data.feedback)}</p>
      </div>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; ${baseStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${getLogoHtml(branding)}
          <h2 style="margin: 10px 0 0; color: #333; font-size: 20px;">作業批改結果</h2>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 10px; color: #333;">
            ${escapeHtml(data.userName)} 你好，
          </p>
          <p style="margin: 0; color: #333;">
            你在「${escapeHtml(data.courseName)}」課程中「${escapeHtml(data.lessonTitle)}」單元的作業已批改完成。
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">批改結果</td>
              <td style="padding: 8px 0; font-weight: 600; text-align: right; color: ${resultColor};">${escapeHtml(data.result)}</td>
            </tr>
            ${scoreHtml}
            ${gradeHtml}
          </table>
        </div>

        ${feedbackHtml}

        <div style="text-align: center;">
          <a href="${data.lessonUrl}" style="${buttonStyles}">查看批改結果</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export interface AssignmentRevisionData {
  userName: string
  courseName: string
  lessonTitle: string
  feedback?: string
  lessonUrl: string
}

export function assignmentRevisionTemplate(
  data: AssignmentRevisionData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)

  const feedbackHtml = data.feedback
    ? `<div style="margin: 20px 0; padding: 16px; background-color: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">修改建議</p>
        <p style="margin: 0; color: #333;">${escapeHtml(data.feedback)}</p>
      </div>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; ${baseStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${getLogoHtml(branding)}
          <h2 style="margin: 10px 0 0; color: #333; font-size: 20px;">作業需要修改</h2>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 10px; color: #333;">
            ${escapeHtml(data.userName)} 你好，
          </p>
          <p style="margin: 0; color: #333;">
            你在「${escapeHtml(data.courseName)}」課程中「${escapeHtml(data.lessonTitle)}」單元的作業已被退回，請依照老師的建議修改後重新提交。
          </p>
        </div>

        ${feedbackHtml}

        <div style="text-align: center;">
          <a href="${data.lessonUrl}" style="${buttonStyles}">前往修改作業</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export interface PrivateMessageReplyData {
  userName: string
  courseName: string
  lessonTitle: string
  replyContent: string
  lessonUrl: string
}

export function privateMessageReplyTemplate(
  data: PrivateMessageReplyData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const replyHtml = escapeHtml(data.replyContent).replace(/\n/g, '<br />')

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; ${baseStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${getLogoHtml(branding)}
          <h2 style="margin: 10px 0 0; color: #333; font-size: 20px;">老師回覆了你的私訊</h2>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 10px; color: #333;">
            ${escapeHtml(data.userName)} 你好，
          </p>
          <p style="margin: 0; color: #333;">
            老師已回覆你在「${escapeHtml(data.courseName)}」課程中「${escapeHtml(data.lessonTitle)}」單元的私訊。
          </p>
        </div>

        <div style="margin: 20px 0; padding: 16px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">老師回覆</p>
          <p style="margin: 0; color: #333;">${replyHtml}</p>
        </div>

        <div style="text-align: center;">
          <a href="${data.lessonUrl}" style="${buttonStyles}">查看私訊</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// ==================== 訂閱制通知模板（PRD §7：8 用戶 + 1 管理員告警） ====================

/**
 * 格式化「下次扣款日 / 存取截止日」等日期，null 時回傳指定 fallback 文字
 */
function formatDateOrFallback(d: Date | null, fallback: string): string {
  return d ? formatDate(d) : fallback
}

/**
 * #1 訂閱成功通知（方案、每期金額、下次扣款日、如何取消）
 */
export interface SubscriptionStartedData {
  userName: string
  courseName: string
  planLabel: string
  pricePerPeriod: number
  intervalLabel: string // '每月' | '每年'
  nextBillingAt: Date | null
  isFixedTerm: boolean
  totalPeriods?: number | null
  manageUrl: string
}

export function subscriptionStartedTemplate(
  data: SubscriptionStartedData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const termRowHtml = data.isFixedTerm && data.totalPeriods
    ? `<tr>
              <td style="padding: 8px 0; color: #666;">方案期數</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">共 ${data.totalPeriods} 期（繳滿後轉永久擁有）</td>
            </tr>`
    : ''
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>訂閱成功</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="party">&#x1F389;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 28px;">訂閱成功！</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            親愛的 ${escapeHtml(data.userName)}，感謝您訂閱《${escapeHtml(data.courseName)}》！
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">訂閱方案</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${escapeHtml(data.planLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">每期金額</td>
              <td style="padding: 8px 0; color: #3b82f6; font-weight: 600; text-align: right;">NT$ ${data.pricePerPeriod.toLocaleString()} / ${escapeHtml(data.intervalLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">下次扣款日</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">${formatDateOrFallback(data.nextBillingAt, '—')}</td>
            </tr>
            ${termRowHtml}
          </table>
        </div>

        <div style="text-align: center;">
          <p style="color: #666; font-size: 16px; margin: 0 0 10px 0;">
            現在就開始學習吧！
          </p>
          <a href="${data.manageUrl}" style="${buttonStyles}">
            前往我的訂閱
          </a>
        </div>

        <div style="${infoBoxStyles} background-color: #f8fafc; margin-top: 24px;">
          <p style="color: #555; font-size: 14px; margin: 0;">
            <strong>如何取消？</strong>您可以隨時在「我的訂閱」中取消此訂閱。取消後將停止未來扣款，並可繼續觀看至目前已付期間結束。
          </p>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            如有任何問題，請隨時聯繫我們。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * #2 第 N 期扣款成功收據（含「管理訂閱／取消訂閱」連結——卡組織要求）
 */
export interface SubscriptionRenewalReceiptData {
  userName: string
  courseName: string
  periodNumber: number
  amount: number
  orderNo: string
  nextBillingAt: Date | null
  manageUrl: string
}

export function subscriptionRenewalReceiptTemplate(
  data: SubscriptionRenewalReceiptData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>訂閱扣款成功收據</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="receipt">&#x1F9FE;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">第 ${data.periodNumber} 期扣款成功</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
            ${escapeHtml(data.userName)} 您好，本期《${escapeHtml(data.courseName)}》訂閱費用已完成扣款。
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">課程名稱</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${escapeHtml(data.courseName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">扣款期別</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">第 ${data.periodNumber} 期</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">本期金額</td>
              <td style="padding: 8px 0; color: #3b82f6; font-weight: 600; text-align: right;">NT$ ${data.amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">訂單編號</td>
              <td style="padding: 8px 0; color: #333; text-align: right; font-family: monospace;">${escapeHtml(data.orderNo)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">下次扣款日</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">${formatDateOrFallback(data.nextBillingAt, '—')}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center;">
          <a href="${data.manageUrl}" style="${buttonStyles}">
            管理訂閱 / 取消訂閱
          </a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            如需查看發票或取消訂閱，請前往「我的訂閱」。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * #3 扣款失敗（Stripe 附 hosted invoice 補繳連結；PAYUNi 附自救指引）
 */
export interface SubscriptionPaymentFailedData {
  userName: string
  courseName: string
  gateway: string // 'stripe' | 'payuni'
  hostedInvoiceUrl?: string | null
  accessEndsAt: Date | null
  manageUrl: string
  contactEmail?: string | null
}

export function subscriptionPaymentFailedTemplate(
  data: SubscriptionPaymentFailedData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const isStripe = data.gateway === 'stripe'

  // Stripe：補繳連結；PAYUNi：自救指引（無法自動重試，需自行處理）
  const actionHtml = isStripe && data.hostedInvoiceUrl
    ? `<div style="text-align: center;">
          <a href="${data.hostedInvoiceUrl}" style="${buttonStyles}">
            前往補繳
          </a>
        </div>`
    : `<div style="${infoBoxStyles} background-color: #fff7ed; border-left: 4px solid #f97316;">
          <p style="color: #9a3412; font-size: 14px; margin: 0 0 8px 0;"><strong>如何恢復訂閱？</strong></p>
          <ol style="color: #9a3412; font-size: 14px; margin: 0; padding-left: 20px;">
            <li style="margin: 4px 0;">請先確認您的信用卡尚未過期、且額度足夠。</li>
            <li style="margin: 4px 0;">若卡片已更換，請至「我的訂閱」<strong>取消目前訂閱並重新訂閱</strong>，以綁定新卡片。</li>
            <li style="margin: 4px 0;">${data.contactEmail ? `如需協助，請聯繫客服：${escapeHtml(data.contactEmail)}` : '如需協助，請聯繫我們的客服。'}</li>
          </ol>
        </div>`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>訂閱扣款失敗</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="warning">&#x26A0;&#xFE0F;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">訂閱扣款失敗</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            我們在為您的《${escapeHtml(data.courseName)}》訂閱扣款時遇到問題。
          </p>
        </div>

        <div style="${infoBoxStyles} background-color: #fef2f2; border-left: 4px solid #dc2626;">
          <p style="color: #991b1b; font-size: 14px; margin: 0;">
            ${data.accessEndsAt
              ? `您目前仍可觀看至 <strong>${formatDate(data.accessEndsAt)}</strong>；若在此之前補繳成功，訂閱將自動恢復、觀看權限不中斷。`
              : '請儘快完成補繳；補繳成功後訂閱將自動恢復。'}
          </p>
        </div>

        ${actionHtml}

        <div style="text-align: center; margin-top: 12px;">
          <a href="${data.manageUrl}" style="color:#3b82f6; font-size:14px; text-decoration:underline;">前往我的訂閱</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * #4 取消確認（實際存取截止日、恢復管道）
 */
export interface SubscriptionCanceledData {
  userName: string
  courseName: string
  accessEndsAt: Date | null
  isFixedTerm: boolean
  courseUrl: string
}

export function subscriptionCanceledTemplate(
  data: SubscriptionCanceledData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>訂閱已取消</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">訂閱已取消</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            您的《${escapeHtml(data.courseName)}》訂閱已成功取消，未來將不再扣款。
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <p style="color: #555; font-size: 14px; margin: 0 0 8px 0;">
            ${data.accessEndsAt
              ? `您仍可觀看至 <strong style="color:#333;">${formatDate(data.accessEndsAt)}</strong>，屆時觀看權限將自動結束。`
              : '您的觀看權限將於本期結束後自動結束。'}
          </p>
          ${data.isFixedTerm
            ? `<p style="color: #9a3412; font-size: 14px; margin: 8px 0 0 0;">
                 提醒：此為期限（分期）訂閱，<strong>中途取消不會轉為永久擁有</strong>，且已繳期款不予退還。
               </p>`
            : ''}
        </div>

        <div style="${infoBoxStyles} background-color: #f8fafc;">
          <p style="color: #555; font-size: 14px; margin: 0;">
            <strong>想再回來嗎？</strong>觀看權限結束後，您隨時可以重新訂閱或購買本課程。
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.courseUrl}" style="${buttonStyles}">重新訂閱課程</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * #5 分期繳清轉永久（恭喜信）
 */
export interface SubscriptionCompletedData {
  userName: string
  courseName: string
  totalPeriods: number
  courseUrl: string
}

export function subscriptionCompletedTemplate(
  data: SubscriptionCompletedData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>分期繳清，永久擁有！</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="celebration">&#x1F38A;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">恭喜！您已永久擁有本課程</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            您已完成《${escapeHtml(data.courseName)}》全部 ${data.totalPeriods} 期的分期繳款，
            <br />
            本課程現已<strong>永久開通</strong>，未來將不再扣款，您可以隨時無限次觀看。
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.courseUrl}" style="${buttonStyles}">前往觀看課程</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            感謝您一路以來的支持！
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * #6 即將扣款提醒（依 renewalReminderDays；YEAR 強制 ≥7 天）
 */
export interface SubscriptionUpcomingRenewalData {
  userName: string
  courseName: string
  nextBillingAt: Date
  amount: number
  periodNumber: number
  manageUrl: string
}

export function subscriptionUpcomingRenewalTemplate(
  data: SubscriptionUpcomingRenewalData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>即將自動扣款提醒</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="calendar">&#x1F4C6;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">即將自動扣款提醒</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            ${escapeHtml(data.userName)} 您好，您的《${escapeHtml(data.courseName)}》訂閱即將進行下一期扣款。
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">扣款日期</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${formatDate(data.nextBillingAt)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">扣款期別</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">第 ${data.periodNumber} 期</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">扣款金額</td>
              <td style="padding: 8px 0; color: #3b82f6; font-weight: 600; text-align: right;">NT$ ${data.amount.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="${infoBoxStyles} background-color: #f8fafc;">
          <p style="color: #555; font-size: 14px; margin: 0;">
            若您不希望繼續訂閱，可在扣款日前至「我的訂閱」取消，取消後將不再扣款。
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.manageUrl}" style="${buttonStyles}">管理我的訂閱</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * #7 存取即將結束（END_ACCESS 期滿與 CANCELED 的期末前 7 天）
 */
export interface SubscriptionAccessEndingData {
  userName: string
  courseName: string
  accessEndsAt: Date
  courseUrl: string
}

export function subscriptionAccessEndingTemplate(
  data: SubscriptionAccessEndingData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>觀看權限即將結束</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="hourglass">&#x23F3;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">觀看權限即將結束</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            ${escapeHtml(data.userName)} 您好，您的《${escapeHtml(data.courseName)}》
            <br />
            觀看權限將於 <strong style="color:#d97706;">${formatDate(data.accessEndsAt)}</strong> 結束。
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <p style="color: #555; font-size: 14px; margin: 0;">
            建議您把握時間完成未看完的單元。若日後想繼續學習，可隨時重新訂閱或購買本課程。
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.courseUrl}" style="${buttonStyles}">前往觀看課程</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * #8 訂閱已終止（gateway 非自願終止，含恢復指引）
 */
export interface SubscriptionTerminatedData {
  userName: string
  courseName: string
  accessEndsAt: Date | null
  courseUrl: string
  contactEmail?: string | null
}

export function subscriptionTerminatedTemplate(
  data: SubscriptionTerminatedData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>訂閱已終止</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="warning">&#x26A0;&#xFE0F;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">訂閱已終止</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 20px 0;">
            ${escapeHtml(data.userName)} 您好，
          </p>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            由於扣款多次失敗，您的《${escapeHtml(data.courseName)}》訂閱已自動終止。
          </p>
        </div>

        <div style="${infoBoxStyles}">
          <p style="color: #555; font-size: 14px; margin: 0;">
            ${data.accessEndsAt
              ? `您仍可觀看至 <strong style="color:#333;">${formatDate(data.accessEndsAt)}</strong>，屆時觀看權限將結束。`
              : '您的觀看權限將於已付期間結束後自動結束。'}
          </p>
        </div>

        <div style="${infoBoxStyles} background-color: #fff7ed; border-left: 4px solid #f97316;">
          <p style="color: #9a3412; font-size: 14px; margin: 0;">
            <strong>想恢復訂閱？</strong>您可以重新訂閱本課程；${data.contactEmail ? `若有分期未繳滿等特殊情況需要協助，請聯繫客服：${escapeHtml(data.contactEmail)}` : '若有分期未繳滿等特殊情況需要協助，請聯繫我們的客服。'}
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.courseUrl}" style="${buttonStyles}">重新訂閱課程</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * #9 管理員訂閱告警（reason 參數化單模板；寄給所有 ADMIN）
 */
export type AdminSubscriptionAlertReasonCode =
  | 'PAST_DUE'
  | 'GATEWAY_TERMINATED'
  | 'ANOMALOUS_PERIOD_PAYMENT'
  | 'TERM_ENDED_UNDERPAID'
  | 'WEBHOOK_STALE'
  | 'CANCEL_RETRY_EXHAUSTED'

export interface AdminSubscriptionAlertData {
  reason: AdminSubscriptionAlertReasonCode
  subscriptionId: string
  courseName: string
  userEmail?: string | null
  detail?: string | null
  adminUrl: string
}

const ADMIN_ALERT_REASON_LABELS: Record<AdminSubscriptionAlertReasonCode, string> = {
  PAST_DUE: '訂閱扣款失敗（PAST_DUE）',
  GATEWAY_TERMINATED: '訂閱遭金流非自願終止',
  ANOMALOUS_PERIOD_PAYMENT: '異常期款（終態後仍收到扣款）',
  TERM_ENDED_UNDERPAID: '期限訂閱已終止但未繳滿',
  WEBHOOK_STALE: 'Webhook 疑似失聯（久未收到續扣通知）',
  CANCEL_RETRY_EXHAUSTED: '金流取消重試已用盡',
}

const ADMIN_ALERT_REASON_HINTS: Record<AdminSubscriptionAlertReasonCode, string> = {
  PAST_DUE: '該訂閱已進入待補繳狀態，寬限期內權限仍有效；請留意是否需要主動聯繫學員或協助補繳。',
  GATEWAY_TERMINATED: '金流已終止此訂閱；若學員仍願意繼續，請依客服 SOP 協助恢復。',
  ANOMALOUS_PERIOD_PAYMENT: '此期扣款發生在訂閱終態之後，系統未展期。請至訂單退款頁處理，系統會依金流狀態自動退款或轉人工流程。',
  TERM_ENDED_UNDERPAID: '此期限訂閱已終止但尚未繳滿期數，未轉為永久。可依「差一期死局」救援 SOP 補扣或手動處理。',
  WEBHOOK_STALE: '存在 ACTIVE 訂閱但超過一個週期未收到續扣通知，請至金流後台確認 Webhook 事件設定是否完整。',
  CANCEL_RETRY_EXHAUSTED: '系統多次嘗試向金流取消訂閱皆失敗，請至金流後台手動確認並取消，以免持續扣款。',
}

export function adminSubscriptionAlertTemplate(
  data: AdminSubscriptionAlertData,
  branding?: Partial<EmailBranding>
): string {
  const resolved = getEmailBranding(branding)
  const logoHtml = getLogoHtml(branding)
  const reasonLabel = ADMIN_ALERT_REASON_LABELS[data.reason] ?? data.reason
  const reasonHint = ADMIN_ALERT_REASON_HINTS[data.reason] ?? ''
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>訂閱告警</title>
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          ${logoHtml}
          <h1 style="color: #333; margin: 10px 0 0 0; font-size: 24px;">${resolved.siteName}</h1>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">
            <span role="img" aria-label="siren">&#x1F6A8;</span>
          </div>
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 26px;">訂閱告警</h2>
          <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">
            系統偵測到一筆訂閱需要管理員關注。
          </p>
        </div>

        <div style="${infoBoxStyles} background-color: #fef2f2; border-left: 4px solid #dc2626;">
          <p style="color: #991b1b; font-size: 15px; margin: 0; font-weight: 600;">${escapeHtml(reasonLabel)}</p>
          ${reasonHint ? `<p style="color: #7f1d1d; font-size: 13px; margin: 8px 0 0 0;">${escapeHtml(reasonHint)}</p>` : ''}
        </div>

        <div style="${infoBoxStyles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">課程名稱</td>
              <td style="padding: 8px 0; color: #333; font-weight: 600; text-align: right;">${escapeHtml(data.courseName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">訂閱 ID</td>
              <td style="padding: 8px 0; color: #333; text-align: right; font-family: monospace;">${escapeHtml(data.subscriptionId)}</td>
            </tr>
            ${data.userEmail
              ? `<tr>
              <td style="padding: 8px 0; color: #666;">學員 Email</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">${escapeHtml(data.userEmail)}</td>
            </tr>`
              : ''}
            ${data.detail
              ? `<tr>
              <td style="padding: 8px 0; color: #666;">補充說明</td>
              <td style="padding: 8px 0; color: #333; text-align: right;">${escapeHtml(data.detail)}</td>
            </tr>`
              : ''}
          </table>
        </div>

        <div style="text-align: center;">
          <a href="${data.adminUrl}" style="${buttonStyles}">前往訂閱管理</a>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0 0 10px 0;">
            此為系統自動發送的管理員告警信件。
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${resolved.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export const emailTemplateDescriptions = {
  purchase: {
    name: '購課成功通知',
    description: '當學員完成課程購買後自動發送的確認信件',
    variables: ['userName', 'courseName', 'orderNo', 'amount'],
  },
  passwordReset: {
    name: '密碼重設',
    description: '當學員申請密碼重設時發送的信件',
    variables: ['userName', 'resetUrl'],
  },
  guestActivation: {
    name: '帳號啟用',
    description: '非會員購買課程後，啟用帳號設定密碼的信件',
    variables: ['userName', 'activationUrl'],
  },
  test: {
    name: '測試信件',
    description: '用於測試 Email 服務是否正常運作',
    variables: [],
  },
  expirationReminder: {
    name: '課程即將到期提醒',
    description: '課程到期前 N 天自動發送（於管理後台課程定價頁設定）',
    variables: ['userName', 'courseName', 'daysRemaining', 'expiresAt', 'courseUrl'],
  },
  expiredNotice: {
    name: '課程已過期通知',
    description: '課程觀看權限過期後自動發送',
    variables: ['userName', 'courseName', 'expiredAt', 'renewUrl'],
  },
  accessExtended: {
    name: '授權更新通知',
    description: '管理員手動授予或延長學員有效期時發送',
    variables: ['userName', 'courseName', 'newExpiresAt', 'previousExpiresAt', 'note'],
  },
  assignmentReviewed: {
    name: '作業批改完成通知',
    description: '老師批改完作業後自動發送給學員',
    variables: ['userName', 'courseName', 'lessonTitle', 'result', 'feedback', 'lessonUrl'],
  },
  assignmentRevision: {
    name: '作業退回修改通知',
    description: '老師退回作業要求學員修改時發送',
    variables: ['userName', 'courseName', 'lessonTitle', 'feedback', 'lessonUrl'],
  },
  privateMessageReply: {
    name: '私訊回覆通知',
    description: '老師回覆學員私訊後自動發送給學員',
    variables: ['userName', 'courseName', 'lessonTitle', 'replyContent', 'lessonUrl'],
  },
  subscriptionStarted: {
    name: '訂閱成功通知',
    description: '學員首期訂閱扣款成功後發送（含方案、每期金額、下次扣款日、如何取消）',
    variables: ['userName', 'courseName', 'planLabel', 'pricePerPeriod', 'nextBillingAt', 'manageUrl'],
  },
  subscriptionRenewalReceipt: {
    name: '訂閱扣款收據',
    description: '第 N 期訂閱扣款成功後發送的收據（含管理訂閱／取消訂閱連結）',
    variables: ['userName', 'courseName', 'periodNumber', 'amount', 'orderNo', 'nextBillingAt', 'manageUrl'],
  },
  subscriptionPaymentFailed: {
    name: '訂閱扣款失敗',
    description: '訂閱扣款失敗、狀態首次轉為待補繳時發送（Stripe 附補繳連結、PAYUNi 附自救指引）',
    variables: ['userName', 'courseName', 'gateway', 'hostedInvoiceUrl', 'accessEndsAt', 'manageUrl'],
  },
  subscriptionCanceled: {
    name: '訂閱取消確認',
    description: '學員或管理員取消訂閱後發送（含實際存取截止日、分期不轉永久提醒、恢復管道）',
    variables: ['userName', 'courseName', 'accessEndsAt', 'isFixedTerm', 'courseUrl'],
  },
  subscriptionCompleted: {
    name: '分期繳清轉永久',
    description: '期限（分期）訂閱繳滿全部期數、轉為永久擁有後發送的恭喜信',
    variables: ['userName', 'courseName', 'totalPeriods', 'courseUrl'],
  },
  subscriptionUpcomingRenewal: {
    name: '即將扣款提醒',
    description: '下一期訂閱扣款前，依方案設定的提醒天數自動發送',
    variables: ['userName', 'courseName', 'nextBillingAt', 'amount', 'periodNumber', 'manageUrl'],
  },
  subscriptionAccessEnding: {
    name: '存取即將結束',
    description: '期滿結束存取或已取消訂閱，於觀看權限結束前 7 天發送',
    variables: ['userName', 'courseName', 'accessEndsAt', 'courseUrl'],
  },
  subscriptionTerminated: {
    name: '訂閱已終止',
    description: '訂閱因扣款多次失敗遭金流非自願終止時發送（含恢復指引）',
    variables: ['userName', 'courseName', 'accessEndsAt', 'courseUrl'],
  },
  adminSubscriptionAlert: {
    name: '管理員訂閱告警',
    description: '訂閱異常時（待補繳、遭終止、異常期款、未繳滿終止、Webhook 失聯等）發送給所有管理員',
    variables: ['reason', 'subscriptionId', 'courseName', 'userEmail', 'detail', 'adminUrl'],
  },
}
