// lib/account-invite.ts
// 帳號邀請信高階 helper
// 依帳號狀態挑選正確的設定密碼流程，並以 30 天效期簽發 token：
// - 待啟用（guest）帳號 → guest activation 連結
// - 既有帳號 → password reset 連結
// 既有的 24h / 1h 預設效期不受影響（僅在邀請情境以參數指定 30 天）

import { prisma } from '@/lib/prisma'
import {
  issueGuestActivationToken,
  buildGuestActivationUrl,
} from '@/lib/guest-activation'
import {
  issuePasswordResetToken,
  buildPasswordResetUrl,
} from '@/lib/password-reset'
import { sendAccountInvite } from '@/lib/email'

/** 邀請連結效期：30 天 */
export const INVITE_EXPIRES_IN_DAYS = 30
const INVITE_TTL_HOURS = INVITE_EXPIRES_IN_DAYS * 24

/**
 * 寄送帳號邀請信（含 30 天設定初始密碼連結）
 *
 * @param userId 目標用戶 ID
 * @param opts.courseTitles 被加入的課程名稱（學員情境）
 * @param opts.roleLabel 被賦予的角色（講師 / 管理員情境）
 */
export async function sendAccountInviteEmail(
  userId: string,
  opts: { courseTitles?: string[]; roleLabel?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isGuest: true,
    },
  })

  if (!user?.email) {
    return { success: false, error: '找不到用戶或缺少 Email' }
  }

  let actionUrl: string
  if (user.isGuest) {
    const { token } = await issueGuestActivationToken(user.id, INVITE_TTL_HOURS)
    actionUrl = await buildGuestActivationUrl(token)
  } else {
    const { token } = await issuePasswordResetToken(user.id, INVITE_TTL_HOURS)
    actionUrl = await buildPasswordResetUrl(token)
  }

  const result = await sendAccountInvite(user.email, actionUrl, {
    userName: user.name || undefined,
    courseTitles: opts.courseTitles,
    roleLabel: opts.roleLabel,
    expiresInDays: INVITE_EXPIRES_IN_DAYS,
  })

  if (!result.success) {
    return { success: false, error: result.error || '寄送邀請信失敗' }
  }

  return { success: true }
}
