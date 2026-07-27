import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPasswordResetToken, sendPasswordResetEmail } from '@/lib/password-reset'
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'

const resetPasswordSchema = z.object({
  token: z.string().min(1, '重設 token 為必填'),
  password: z.string().min(8, '密碼至少需要 8 個字元'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting：防止暴力破解 token
    const identifier = getIdentifier(request)
    const rateLimitResult = checkRateLimit(`reset-password:${identifier}`, RATE_LIMIT_CONFIGS.auth)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: '請求過於頻繁，請稍後再試' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }
    const body = await request.json()
    const parsed = resetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '請求資料格式錯誤' },
        { status: 400 }
      )
    }

    const { token, password } = parsed.data
    const tokenHash = hashPasswordResetToken(token)

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
      },
    })

    if (!resetToken) {
      return NextResponse.json({ error: '重設連結無效，請重新申請「忘記密碼」' }, { status: 400 })
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: '此重設連結已使用，如仍無法登入請重新申請「忘記密碼」' },
        { status: 400 }
      )
    }

    if (resetToken.expiresAt <= new Date()) {
      // 過期不應該是死路：直接補寄一封新的重設信，不需要使用者自己回去
      // 忘記密碼頁面重新輸入 email —— 這裡已經透過 token 知道是哪個帳號了
      const linkedUser = await prisma.user.findUnique({
        where: { id: resetToken.userId },
        select: { email: true },
      })

      if (linkedUser?.email) {
        const resendResult = await sendPasswordResetEmail(linkedUser.email)
        if (resendResult.success) {
          return NextResponse.json(
            { error: '此重設連結已過期，我們已寄送一封新的重設信到您的信箱，請查收' },
            { status: 400 }
          )
        }
        console.error('[Reset Password] 過期後補寄重設信失敗:', resendResult.error)
      }

      return NextResponse.json({ error: '重設連結已過期，請重新申請「忘記密碼」' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction(async (tx) => {
      const now = new Date()

      // 先以條件更新消耗 token，避免併發請求重複使用同一 token
      const consumeResult = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      })

      if (consumeResult.count === 0) {
        throw new Error('RESET_TOKEN_ALREADY_USED_OR_EXPIRED')
      }

      // 更新密碼，若為 guest 帳號同時升級
      const user = await tx.user.findUnique({
        where: { id: resetToken.userId },
        select: { isGuest: true },
      })

      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
          // L59：重設密碼為帳號復原流程，成功後清除失敗計數與鎖定，避免重設後仍被鎖在門外
          failedLoginCount: 0,
          lockedUntil: null,
          ...(user?.isGuest
            ? { isGuest: false, guestActivatedAt: now }
            : {}),
        },
      })

      // 同步失效同使用者其他尚未使用 token，避免舊信連結再次重設
      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: { usedAt: now },
      })
    })

    return NextResponse.json({
      success: true,
      // 中性措辭：同時涵蓋「重設既有密碼」與「首次設定密碼」（guest 帳號啟用 / OAuth 帳號加開密碼）
      message: '密碼已設定完成，請使用新密碼登入',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'RESET_TOKEN_ALREADY_USED_OR_EXPIRED') {
      return NextResponse.json({ error: '此重設連結已失效，請重新申請' }, { status: 400 })
    }
    console.error('[Reset Password] 錯誤:', error)
    return NextResponse.json({ error: '重設失敗，請稍後再試' }, { status: 500 })
  }
}
