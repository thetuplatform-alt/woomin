import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashGuestActivationToken, sendGuestActivationEmail } from '@/lib/guest-activation'
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'

const activateGuestSchema = z.object({
  token: z.string().min(1, '啟用 token 為必填'),
  password: z
    .string()
    .min(8, '密碼至少需要 8 個字元'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting：防止暴力破解 token
    const identifier = getIdentifier(request)
    const rateLimitResult = checkRateLimit(`guest-activate:${identifier}`, RATE_LIMIT_CONFIGS.auth)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: '請求過於頻繁，請稍後再試' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }
    const body = await request.json()
    const parsed = activateGuestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || '請求資料格式錯誤',
        },
        { status: 400 }
      )
    }

    const { token, password } = parsed.data
    const tokenHash = hashGuestActivationToken(token)

    const activationToken = await prisma.guestActivationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
      },
    })

    if (!activationToken) {
      return NextResponse.json(
        { error: '啟用連結無效，請改用「忘記密碼」重新設定密碼' },
        { status: 400 }
      )
    }

    if (activationToken.usedAt) {
      return NextResponse.json(
        { error: '此帳號已完成啟用，請直接登入；若忘記密碼請使用「忘記密碼」重新設定' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: activationToken.userId },
      select: {
        id: true,
        isGuest: true,
      },
    })

    // 帳號已不是待啟用狀態（例如已透過「忘記密碼」自行完成啟用），
    // 這條舊的啟用連結沒有意義，引導去登入 / 忘記密碼即可
    if (!user || !user.isGuest) {
      return NextResponse.json(
        { error: '此帳號已完成啟用，請直接登入；若忘記密碼請使用「忘記密碼」重新設定' },
        { status: 400 }
      )
    }

    if (activationToken.expiresAt < new Date()) {
      // 過期不應該是死路：帳號確認仍待啟用時，主動補寄一封新的啟用信，
      // 不需要使用者自己想辦法「重新申請」
      const resendResult = await sendGuestActivationEmail(user.id)
      if (resendResult.success) {
        return NextResponse.json(
          { error: '此啟用連結已過期，我們已寄送一封新的啟用信到您的信箱，請查收' },
          { status: 400 }
        )
      }
      console.error('[Guest Activate] 過期後補寄啟用信失敗:', resendResult.error)
      return NextResponse.json(
        { error: '此啟用連結已過期，請使用「忘記密碼」重新設定密碼' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction(async (tx) => {
      // 使用條件式 update 防止並發請求同時消耗同一 token（TOCTOU 防護）
      const tokenUpdate = await tx.guestActivationToken.updateMany({
        where: {
          id: activationToken.id,
          usedAt: null, // 確保 token 尚未被使用
        },
        data: { usedAt: new Date() },
      })

      if (tokenUpdate.count === 0) {
        throw new Error('TOKEN_ALREADY_USED')
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          isGuest: false,
          guestActivatedAt: new Date(),
          // L59：啟用為帳號復原流程，一併清除可能殘留的失敗計數與鎖定
          failedLoginCount: 0,
          lockedUntil: null,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: '帳號已啟用，請使用 Email 與新密碼登入',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_ALREADY_USED') {
      return NextResponse.json({ error: '此啟用連結已使用' }, { status: 400 })
    }
    console.error('[Guest Activate] 錯誤:', error)
    return NextResponse.json({ error: '啟用失敗，請稍後再試' }, { status: 500 })
  }
}
