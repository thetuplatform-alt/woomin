// app/(setup)/layout.tsx
// Setup route group layout
// 提供 SessionProvider 讓 setup-client 可以使用 useSession

import { SessionProvider } from '@/components/providers/session-provider'

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SessionProvider>{children}</SessionProvider>
}
