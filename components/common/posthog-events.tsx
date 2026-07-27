// components/common/posthog-events.tsx
// PostHog 客戶端事件追蹤元件
// 用於在 Server Component 頁面中觸發 PostHog 事件

'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

/**
 * 頁面載入時觸發 PostHog 事件（用於 Server Component 中嵌入）
 */
export function PostHogPageView({
  event,
  properties,
}: {
  event: string
  properties?: Record<string, unknown>
}) {
  useEffect(() => {
    posthog.capture(event, properties)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])

  return null
}
