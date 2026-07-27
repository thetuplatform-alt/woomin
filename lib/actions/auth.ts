// lib/actions/auth.ts
// 認證相關 Server Actions
// 處理登入、註冊等操作

'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { signIn } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuthError } from 'next-auth'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'
import { getPostHogClient, flushPostHogInBackground } from '@/lib/posthog-server'
import { redirect } from 'next/navigation'

// ==================== Schema 定義 ====================

/**
 * 登入表單驗證 Schema
 */
const loginSchema = z.object({
  email: z.string().email('請輸入有效的電子郵件'),
  password: z.string().min(1, '請輸入密碼'),
})

/**
 * 註冊表單驗證 Schema
 */
const registerSchema = z.object({
  name: z.string().min(1, '請輸入姓名').max(50, '姓名不能超過 50 個字元'),
  email: z.string().email('請輸入有效的電子郵件'),
  password: z
    .string()
    .min(8, '密碼至少需要 8 個字元'),
  confirmPassword: z.string(),
  generalEmailConsent: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: '兩次輸入的密碼不一致',
  path: ['confirmPassword'],
})

// ==================== Server Actions ====================

/**
 * 電子郵件密碼登入
 */
export async function loginWithCredentials(
  prevState: { error?: string; success?: boolean; redirectTo?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean; redirectTo?: string }> {
  // 驗證表單資料
  const validatedFields = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || '請填寫所有欄位',
    }
  }

  // M25：email 正規化（與 authorize / 註冊 / 重設流程一致）
  const email = validatedFields.data.email.trim().toLowerCase()
  const { password } = validatedFields.data

  // 讀取 callbackUrl（僅允許站內相對路徑）
  const rawCallbackUrl = formData.get('callbackUrl') as string | null
  const redirectTo = rawCallbackUrl?.startsWith('/') ? rawCallbackUrl : '/'

  // 註：速率限制 / 帳號鎖定 / 失敗計數已統一移至 lib/auth.ts 的 authorize()，
  // 確保所有進入點（含直連 callback 端點）都受到保護，這裡不再重複處理（避免雙重計數）。
  try {
    // 使用 redirect: false 讓 signIn 不自動重導向，
    // 而是讓 client-side 用 window.location.href 做硬導向，
    // 確保瀏覽器帶著新的 session cookie 發起請求
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    // 登入成功 - 查找用戶以記錄追蹤事件（成功登入的計數重置已在 authorize 處理）
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (user) {
      // PostHog: Track successful login on server side
      const posthog = await getPostHogClient()
      if (posthog) {
        posthog.capture({
          distinctId: user.id,
          event: 'user_logged_in',
          properties: {
            login_method: 'credentials',
            email: email,
            source: 'server',
          },
        })
        posthog.identify({
          distinctId: user.id,
          properties: {
            email: email,
          },
        })
        flushPostHogInBackground(posthog)
      }
    }

    // 返回成功狀態和重導向目標，由 client-side 處理導航
    return { success: true, redirectTo }
  } catch (error) {
    // 重新拋出 redirect 錯誤，讓 Next.js 正常處理重導向
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }

    // 失敗的登入計數 / 鎖定已於 authorize() 統一記錄，這裡僅做追蹤與錯誤訊息回傳

    // PostHog: Track failed login attempt
    const posthog = await getPostHogClient()
    const failureReason = error instanceof AuthError
      ? (error.type === 'CredentialsSignin' ? 'invalid_credentials' : 'auth_error')
      : 'unknown_error'
    if (posthog) {
      posthog.capture({
        distinctId: email, // Use email as distinct ID for anonymous tracking
        event: 'login_failed',
        properties: {
          login_method: 'credentials',
          failure_reason: failureReason,
          email: email,
        },
      })
      flushPostHogInBackground(posthog)
    }

    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: '電子郵件或密碼錯誤' }
        case 'CallbackRouteError': {
          // authorize 拋出的 Error 被 NextAuth 包裝在 cause.err 中
          const originalMessage = (error.cause as { err?: Error })?.err?.message
          if (originalMessage) {
            return { error: originalMessage }
          }
          return { error: '登入時發生錯誤，請稍後再試' }
        }
        default:
          return { error: '登入時發生錯誤，請稍後再試' }
      }
    }

    // 處理其他錯誤
    if (error instanceof Error) {
      return { error: error.message }
    }

    return { error: '登入時發生未知錯誤' }
  }
}

/**
 * 註冊新用戶
 */
export async function registerUser(
  prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  // 驗證表單資料
  const validatedFields = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    generalEmailConsent: formData.get('generalEmailConsent') === 'on',
    marketingConsent: formData.get('marketingConsent') === 'on',
  })

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || '請填寫所有欄位',
    }
  }

  const { name, password, generalEmailConsent, marketingConsent } = validatedFields.data
  // M25：email 一律正規化為小寫，避免大小寫不同造成重複帳號
  const email = validatedFields.data.email.trim().toLowerCase()

  try {
    // 檢查電子郵件是否已註冊
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return { error: '此電子郵件已被註冊' }
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 12)

    const headersList = await headers()
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      'unknown'

    // 建立新用戶與同意稽核
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        generalEmailConsent,
        generalEmailConsentAt: generalEmailConsent ? new Date() : null,
        marketingConsent,
        marketingConsentAt: marketingConsent ? new Date() : null,
        marketingConsentSource: marketingConsent ? 'register' : null,
        marketingConsentIp: ipAddress,
        emailConsentLogs: {
          create: [
            {
              email,
              consentType: 'GENERAL',
              action: generalEmailConsent ? 'GRANTED' : 'REVOKED',
              source: 'register',
              ip: ipAddress,
            },
            {
              email,
              consentType: 'MARKETING',
              action: marketingConsent ? 'GRANTED' : 'REVOKED',
              source: 'register',
              ip: ipAddress,
            },
          ],
        },
      },
    })

    // PostHog: Track successful registration
    const posthog = await getPostHogClient()
    if (posthog) {
      posthog.capture({
        distinctId: newUser.id,
        event: 'user_registered',
        properties: {
          registration_method: 'credentials',
          email: email,
          name: name,
        },
      })
      posthog.identify({
        distinctId: newUser.id,
        properties: {
          email: email,
          name: name,
          created_at: new Date().toISOString(),
        },
      })
      flushPostHogInBackground(posthog)
    }

    return { success: true }
  } catch (error) {
    console.error('註冊錯誤:', error)
    return { error: '註冊時發生錯誤，請稍後再試' }
  }
}

/**
 * Google OAuth 登入
 */
export async function loginWithGoogle(formData: FormData) {
  const rawCallbackUrl = formData.get('callbackUrl') as string | null
  const redirectTo = rawCallbackUrl?.startsWith('/') ? rawCallbackUrl : '/'
  await signIn('google', { redirectTo }, { prompt: 'select_account' })
}

/**
 * Apple OAuth 登入
 */
export async function loginWithApple(formData: FormData) {
  const rawCallbackUrl = formData.get('callbackUrl') as string | null
  const redirectTo = rawCallbackUrl?.startsWith('/') ? rawCallbackUrl : '/'
  await signIn('apple', { redirectTo })
}

/**
 * 請求密碼重設 / 設定密碼（忘記密碼入口）
 *
 * 一律交由 sendPasswordResetEmail 處理：不存在的 email 會自動建立訪客帳號，
 * 任何帳號狀態都會寄出一封可設定密碼的信。行為統一，本身即可防止帳號枚舉。
 * 僅在寄信基礎設施真的失敗時回傳錯誤，讓使用者知道信沒送出（不再一律假成功）。
 */
export async function requestPasswordReset(
  prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!email || !z.string().email().safeParse(email).success) {
    return { error: '請輸入有效的電子郵件' }
  }

  try {
    const headersList = await headers()
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      'unknown'

    const ipRateLimit = checkRateLimit(`password-reset:ip:${ipAddress}`, RATE_LIMIT_CONFIGS.auth)
    const emailRateLimit = checkRateLimit(`password-reset:email:${email}`, RATE_LIMIT_CONFIGS.auth)

    if (!ipRateLimit.success || !emailRateLimit.success) {
      return { error: '操作過於頻繁，請稍後再試' }
    }

    const { sendPasswordResetEmail } = await import('@/lib/password-reset')
    const result = await sendPasswordResetEmail(email)

    if (!result.success) {
      // 寄信基礎設施失敗（Email 服務未設定 / Resend / SMTP 出錯）——誠實告知，不再假成功。
      // 此錯誤與「帳號是否存在」無關，因此不會洩漏帳號枚舉資訊。
      console.error('[Password Reset] 發送失敗:', result.error)
      return { error: '目前無法寄送郵件，請稍後再試；若持續發生請聯繫客服' }
    }

    return { success: true }
  } catch (error) {
    console.error('[Password Reset] 錯誤:', error)
    return { error: '目前無法處理您的請求，請稍後再試' }
  }
}
