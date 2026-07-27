import { randomBytes, createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendPasswordReset, sendPasswordSetup } from '@/lib/email'
import { resolveAppUrl } from '@/lib/app-url'

const RESET_TOKEN_HOURS = 1

const OAUTH_PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
}

function formatOAuthProviderNames(providers: string[]): string {
  const names = providers.map((p) => OAUTH_PROVIDER_DISPLAY_NAMES[p] || p)
  return Array.from(new Set(names)).join('、') || '社群帳號'
}

/** 因忘記密碼而新建的訪客帳號來源標記 */
const RESET_GUEST_SOURCE = 'password_reset'

type ResetTarget = {
  id: string
  email: string
  name: string | null
  password: string | null
  isGuest: boolean
  accounts: { provider: string }[]
}

const RESET_TARGET_SELECT = {
  id: true,
  email: true,
  name: true,
  password: true,
  isGuest: true,
  accounts: { select: { provider: true } },
} as const

/**
 * 找出忘記密碼的目標帳號；若該 email 尚無帳號，依產品決策建立一個訪客空殼帳號，
 * 確保「不論任何情況都能寄出信、都能設定密碼登入」。
 * 併發下若同一 email 同時被建立，捕捉唯一鍵衝突後重查。
 */
async function findOrCreateResetTarget(rawEmail: string): Promise<ResetTarget> {
  const email = rawEmail.trim().toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { email },
    select: RESET_TARGET_SELECT,
  })
  if (existing) return existing

  try {
    return await prisma.user.create({
      data: { email, isGuest: true, guestSource: RESET_GUEST_SOURCE },
      select: RESET_TARGET_SELECT,
    })
  } catch (error) {
    // 併發建立：同一 email 已被另一請求搶先建立，重查後回傳既有帳號
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const raced = await prisma.user.findUnique({
        where: { email },
        select: RESET_TARGET_SELECT,
      })
      if (raced) return raced
    }
    throw error
  }
}

/**
 * 記錄一次密碼相關信件的寄送嘗試（PENDING），供後續依 EmailDeliveryLog 查詢實際失敗率。
 * 寫入失敗不應中斷實際寄信流程，僅記錄錯誤。
 */
async function logEmailDeliveryAttempt(params: {
  type: 'PASSWORD_RESET' | 'PASSWORD_SETUP'
  userId: string
  toEmail: string
  subject: string
}): Promise<string | null> {
  try {
    const log = await prisma.emailDeliveryLog.create({
      data: {
        type: params.type,
        status: 'PENDING',
        userId: params.userId,
        toEmail: params.toEmail,
        subject: params.subject,
      },
      select: { id: true },
    })
    return log.id
  } catch (error) {
    console.error('[Password Reset] 建立 EmailDeliveryLog 失敗:', error)
    return null
  }
}

async function markEmailDeliveryResult(
  logId: string | null,
  result: { success: boolean; messageId?: string; error?: string }
): Promise<void> {
  if (!logId) return
  try {
    await prisma.emailDeliveryLog.update({
      where: { id: logId },
      data: result.success
        ? { status: 'SENT', providerMessageId: result.messageId || null, sentAt: new Date() }
        : { status: 'FAILED', errorMessage: result.error || '發送失敗' },
    })
  } catch (error) {
    console.error('[Password Reset] 更新 EmailDeliveryLog 失敗:', error)
  }
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function buildPasswordResetUrl(token: string): Promise<string> {
  const baseUrl = await resolveAppUrl()
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`
}

export async function issuePasswordResetToken(
  userId: string,
  ttlHours: number = RESET_TOKEN_HOURS
): Promise<{
  token: string
  expiresAt: Date
}> {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashPasswordResetToken(token)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)

  await prisma.$transaction(async (tx) => {
    // 發送新重設信前，先讓同使用者既有未使用 token 失效
    await tx.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    })

    await tx.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    })
  })

  return { token, expiresAt }
}

/**
 * 忘記密碼 / 設定密碼的統一入口。
 *
 * 設計原則（依業主決策）：不論帳號狀態如何，都會走完整流程並寄出一封信，
 * 讓使用者一定能拿回 / 設定登入密碼：
 * - email 不存在        → 建立訪客空殼帳號，寄「設定登入密碼」信
 * - 訪客帳號（未啟用）  → 寄「設定登入密碼」信（設定後自動轉為正式會員）
 * - 純 OAuth 帳號       → 寄「設定登入密碼」信（加開密碼登入，原社群登入不受影響）
 * - 一般有密碼帳號      → 寄「密碼重設」信
 *
 * 舊密碼在此階段一律不動；只有在使用者點連結、於 /api/auth/reset-password
 * 設定新密碼的當下才會被覆蓋（避免任何人僅憑 email 就能癱瘓他人登入）。
 *
 * 回傳值誠實反映寄信結果：基礎設施寄送失敗（Email 服務未設定 / Resend / SMTP 出錯）
 * 會回傳 success:false 讓上層告知使用者，而非假裝成功。此處不再有「帳號不存在就
 * 靜默成功」的分支——因為一律建帳號且一律寄信，行為完全一致，本身即可防止帳號枚舉。
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  const user = await findOrCreateResetTarget(email)

  const { token } = await issuePasswordResetToken(user.id)
  const resetUrl = await buildPasswordResetUrl(token)

  const hasPassword = !!user.password
  const isOAuthOnly = !hasPassword && !user.isGuest && user.accounts.length > 0

  const logId = await logEmailDeliveryAttempt({
    type: hasPassword ? 'PASSWORD_RESET' : 'PASSWORD_SETUP',
    userId: user.id,
    toEmail: user.email,
    subject: hasPassword ? '密碼重設請求' : '設定你的登入密碼',
  })

  const result = hasPassword
    ? await sendPasswordReset(user.email, resetUrl, user.name || undefined)
    : await sendPasswordSetup(
        user.email,
        resetUrl,
        user.name || undefined,
        isOAuthOnly ? formatOAuthProviderNames(user.accounts.map((a) => a.provider)) : undefined
      )

  await markEmailDeliveryResult(logId, result)

  if (!result.success) {
    return { success: false, error: result.error || '寄送重設信失敗' }
  }

  return { success: true }
}
