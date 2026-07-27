// lib/posthog-server.ts
// Server-side PostHog client for tracking events in API routes and server actions
// Reads PostHog settings from database

import { PostHog } from 'posthog-node'
import { getAnalyticsSettings } from '@/lib/analytics-settings'

let posthogClient: PostHog | null = null
let currentKey: string | null = null

export async function getPostHogClient(): Promise<PostHog | null> {
  const settings = await getAnalyticsSettings()

  if (!settings.posthogKey) {
    return null
  }

  // 如果 key 變了，重新建立 client
  if (posthogClient && currentKey !== settings.posthogKey) {
    await posthogClient.shutdown()
    posthogClient = null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(settings.posthogKey, {
      host: settings.posthogHost || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      // 效能防護：PostHog host 不可達/設錯時，避免單次請求拖數十秒。
      // 只設 requestTimeout 不夠（預設會重試 3 次 × 3s），必須一併關閉重試。
      requestTimeout: 2000,
      fetchRetryCount: 0,
    })
    currentKey = settings.posthogKey

    if (process.env.NODE_ENV === 'development') {
      posthogClient.debug(true)
    }
  }

  return posthogClient
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown()
  }
}

/**
 * 背景送出 PostHog 事件，不阻塞使用者關鍵路徑（登入 / 註冊 / 付款 / 加入課程）。
 * 失敗安靜略過、絕不拋出 —— 避免「追蹤失敗」被外層 try/catch 誤判為「業務失敗」，
 * 也避免逾時的 flush 造成 unhandledRejection。
 * 搭配 client 的 requestTimeout:2000 + fetchRetryCount:0，背景請求本身也有界。
 * 本平台為長駐 Node 伺服器（非 serverless），背景 flush 會在程序存活期間完成、不會遺失事件。
 */
export function flushPostHogInBackground(client: PostHog): void {
  void Promise.resolve(client.flush()).catch(() => {})
}
