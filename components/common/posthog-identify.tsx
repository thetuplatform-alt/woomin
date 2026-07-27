// components/common/posthog-identify.tsx
// Client-side PostHog identify
// 當用戶登入後，將 PostHog 匿名 ID 關聯到資料庫的 userId
// 確保 client-side 和 server-side 事件可以在漏斗中正確串接

'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import posthog from 'posthog-js'

export function PostHogIdentify() {
  const { data: session } = useSession()
  const identifiedRef = useRef<string | null>(null)

  useEffect(() => {
    if (session?.user?.id && identifiedRef.current !== session.user.id) {
      posthog.identify(session.user.id, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      })
      identifiedRef.current = session.user.id
    }

    // 用戶登出時 reset
    if (!session?.user?.id && identifiedRef.current) {
      posthog.reset()
      identifiedRef.current = null
    }
  }, [session?.user?.id, session?.user?.email, session?.user?.name])

  return null
}
