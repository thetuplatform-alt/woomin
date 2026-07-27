// components/providers/session-provider.tsx
// NextAuth SessionProvider 包裝元件
// 提供 client-side session 狀態給子元件使用

'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

interface SessionProviderProps {
  children: React.ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
