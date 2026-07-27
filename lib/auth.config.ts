import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getAuthSecret } from '@/lib/auth-secret'
import { shouldTrustAuthHost } from '@/lib/auth-host'

export const authConfig: NextAuthConfig = {
  secret: getAuthSecret(),
  trustHost: shouldTrustAuthHost(),
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: '電子郵件', type: 'email' },
        password: { label: '密碼', type: 'password' },
      },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnAdmin = nextUrl.pathname.startsWith('/admin')

      if (nextUrl.pathname === '/admin/setup') {
        return isLoggedIn
      }

      if (isOnAdmin) {
        if (!isLoggedIn) {
          return false
        }

        // Middleware runs on the JWT snapshot. Let admin server routes verify
        // the current DB role so role changes take effect immediately.
        return true
      }

      return true
    },
  },
}
