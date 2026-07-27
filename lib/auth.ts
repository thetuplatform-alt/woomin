import NextAuth from 'next-auth'
import type { Adapter } from 'next-auth/adapters'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authConfig } from '@/lib/auth.config'
import { getAppleClientSecret } from '@/lib/apple-auth'
import { getPostHogClient, flushPostHogInBackground } from '@/lib/posthog-server'
import { getAppleCredentials, getGoogleCredentials } from '@/lib/auth-credentials'
import { getAuthSecret } from '@/lib/auth-secret'
import {
  checkLoginSecurity,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '@/lib/auth-security'

/** 從 NextAuth authorize 收到的 Request 取出來源 IP（盡力而為） */
function ipFromRequest(request: Request | undefined): string {
  const h = request?.headers
  if (!h) return 'unknown'
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'unknown'
  )
}

const [googleCreds, appleCreds] = await Promise.all([
  getGoogleCredentials(),
  getAppleCredentials(),
])

const providers = [
  ...(googleCreds.isConfigured
    ? [
        Google({
          clientId: googleCreds.clientId,
          clientSecret: googleCreds.clientSecret,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
  ...(appleCreds.isConfigured
    ? [
        Apple({
          clientId: appleCreds.appleId,
          clientSecret: getAppleClientSecret({
            appleId: appleCreds.appleId,
            teamId: appleCreds.teamId,
            keyId: appleCreds.keyId,
            privateKey: appleCreds.privateKey,
          }),
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
  Credentials({
    name: 'credentials',
    credentials: {
      email: { label: '電子郵件', type: 'email' },
      password: { label: '密碼', type: 'password' },
    },
    async authorize(credentials, request) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('請輸入電子郵件和密碼')
      }

      // M25：email 正規化（與註冊 / 後台 / 重設流程一致，避免大小寫造成的帳號分裂）
      const email = (credentials.email as string).trim().toLowerCase()
      const password = credentials.password as string
      const ipAddress = ipFromRequest(request as Request | undefined)
      const userAgent = (request as Request | undefined)?.headers?.get('user-agent') || undefined

      // H5：暴力破解防護寫在 authorize 內，確保所有進入點（含直連
      // POST /api/auth/callback/credentials）都會經過 IP / Email 速率限制與帳號鎖定。
      const security = await checkLoginSecurity(email, ipAddress)
      if (!security.allowed) {
        throw new Error(security.reason || '登入嘗試過於頻繁，請稍後再試')
      }

      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user) {
        // 失敗計數 / 鎖定也適用於不存在的 email（避免以此區分帳號是否存在）
        await recordFailedLogin(email, ipAddress, userAgent)
        throw new Error('電子郵件或密碼錯誤')
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new Error('帳號已暫時鎖定，請稍後再試')
      }

      if (!user.password) {
        throw new Error('此帳號尚未設定密碼，請使用 Google / Apple 登入，或透過「忘記密碼」設定登入密碼')
      }

      const isPasswordValid = await bcrypt.compare(password, user.password)

      if (!isPasswordValid) {
        await recordFailedLogin(email, ipAddress, userAgent)
        throw new Error('電子郵件或密碼錯誤')
      }

      // 登入成功：重置失敗計數 / 鎖定，記錄成功登入
      await recordSuccessfulLogin(user.id, ipAddress, userAgent)

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      }
    },
  }),
]

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: getAuthSecret(),
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true

      const email = user.email
      if (!email) return true

      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          isGuest: true,
          accounts: { select: { provider: true } },
        },
      })

      if (!existingUser) return true
      if (existingUser.isGuest) return true

      const hasThisProvider = existingUser.accounts.some(
        (item) => item.provider === account?.provider
      )
      if (hasThisProvider) return true

      return false
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        token.roleRefreshedAt = Date.now()
      }

      if (trigger === 'update') {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          })
          if (dbUser) {
            token.role = dbUser.role
          }
          token.roleRefreshedAt = Date.now()
        } catch {
          // ignore db refresh failures
        }
      }

      const roleRefreshInterval = 5 * 60 * 1000
      const lastRefreshed = (token.roleRefreshedAt as number) || 0
      if (token.id && Date.now() - lastRefreshed > roleRefreshInterval) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          })
          if (dbUser) {
            token.role = dbUser.role
          }
          token.roleRefreshedAt = Date.now()
        } catch {
          // ignore db refresh failures
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }

      return session
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        const posthog = await getPostHogClient()
        if (posthog) {
          posthog.capture({
            distinctId: user.id,
            event: 'user_registered',
            properties: {
              registration_method: 'oauth',
              email: user.email,
              name: user.name,
            },
          })
          posthog.identify({
            distinctId: user.id,
            properties: {
              email: user.email,
              name: user.name,
              created_at: new Date().toISOString(),
            },
          })
          flushPostHogInBackground(posthog)
        }
      }
    },

    async signIn({ user, account }) {
      if (account?.provider && account.provider !== 'credentials' && user.id) {
        const posthog = await getPostHogClient()
        if (posthog) {
          posthog.capture({
            distinctId: user.id,
            event: 'user_logged_in',
            properties: {
              login_method: account.provider,
              email: user.email,
            },
          })
          posthog.identify({
            distinctId: user.id,
            properties: {
              email: user.email,
            },
          })
          flushPostHogInBackground(posthog)
        }

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isGuest: true },
        })
        if (dbUser?.isGuest) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isGuest: false, guestActivatedAt: new Date() },
          })
        }
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
})
