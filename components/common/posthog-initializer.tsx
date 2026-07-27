// components/common/posthog-initializer.tsx
// 從資料庫設定動態初始化 PostHog
// 在 root layout 的 Server Component 中取得設定，傳給此客戶端元件

'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'

interface PostHogInitializerProps {
  apiKey: string
  apiHost: string
}

export function PostHogInitializer({ apiKey, apiHost }: PostHogInitializerProps) {
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!apiKey || initializedRef.current) return

    // 從 apiHost 推導 ui_host（去掉 .i. 部分）
    // e.g. https://us.i.posthog.com → https://us.posthog.com
    const uiHost = apiHost.replace('.i.posthog.com', '.posthog.com')

    posthog.init(apiKey, {
      api_host: '/ingest',
      ui_host: uiHost || 'https://us.posthog.com',
      capture_exceptions: true,
      debug: process.env.NODE_ENV === 'development',
    })

    initializedRef.current = true
  }, [apiKey, apiHost])

  return null
}
