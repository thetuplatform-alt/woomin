// lib/meta-capi.ts
// Meta Conversions API (CAPI) 伺服器端事件追蹤
// 搭配瀏覽器端 Pixel 使用，透過 event_id 去重

import crypto from 'crypto'
import { getAnalyticsSettings } from '@/lib/analytics-settings'

const GRAPH_API_VERSION = 'v21.0'

interface ViewContentEventParams {
  /** 課程名稱 */
  contentName: string
  /** 課程 ID */
  contentId: string
  /** 課程價格 */
  value?: number
  /** 貨幣 */
  currency?: string
  /** 用戶 email（會被 SHA256 雜湊後傳送） */
  userEmail?: string | null
  /** 用戶 IP（從 request header 取得） */
  clientIpAddress?: string | null
  /** 用戶 User Agent */
  clientUserAgent?: string | null
  /** 用於與瀏覽器端 Pixel 去重的 event_id */
  eventId?: string
}

interface PurchaseEventParams {
  /** 訂單編號，同時作為 event_id 用於去重 */
  orderNo: string
  /** 購買金額 */
  value: number
  /** 貨幣 */
  currency?: string
  /** 用戶 email（會被 SHA256 雜湊後傳送） */
  userEmail?: string | null
  /** 課程名稱 */
  contentName?: string
  /** 課程 ID */
  contentId?: string
  /** 用戶 IP（從 request header 取得） */
  clientIpAddress?: string | null
  /** 用戶 User Agent */
  clientUserAgent?: string | null
}

/**
 * SHA256 雜湊（Meta CAPI 要求用戶資料必須雜湊後傳送）
 */
function hashSHA256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/**
 * 發送 Purchase 事件到 Meta Conversions API
 */
export async function sendMetaCAPIPurchaseEvent(params: PurchaseEventParams) {
  const { metaPixelId: PIXEL_ID, metaCapiAccessToken: ACCESS_TOKEN } = await getAnalyticsSettings()
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn('[Meta CAPI] 缺少 META_PIXEL_ID 或 META_CAPI_ACCESS_TOKEN，跳過事件發送')
    return
  }

  const {
    orderNo,
    value,
    currency = 'TWD',
    userEmail,
    contentName,
    contentId,
    clientIpAddress,
    clientUserAgent,
  } = params

  const userData: Record<string, string> = {}
  if (userEmail) {
    userData.em = hashSHA256(userEmail)
  }
  if (clientIpAddress) {
    userData.client_ip_address = clientIpAddress
  }
  if (clientUserAgent) {
    userData.client_user_agent = clientUserAgent
  }

  const eventData = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: orderNo,
        action_source: 'website',
        user_data: userData,
        custom_data: {
          value,
          currency,
          content_name: contentName,
          content_ids: contentId ? [contentId] : undefined,
          content_type: 'product',
        },
      },
    ],
  }

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(eventData),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[Meta CAPI] 事件發送失敗:', result)
    } else {
      console.log('[Meta CAPI] Purchase 事件已發送:', {
        orderNo,
        value,
        currency,
        events_received: result.events_received,
      })
    }
  } catch (error) {
    console.error('[Meta CAPI] 發送錯誤:', error)
  }
}

/**
 * 發送 ViewContent 事件到 Meta Conversions API
 * 搭配瀏覽器端 Pixel ViewContent 使用，提升歸因準確度
 */
export async function sendMetaCAPIViewContentEvent(params: ViewContentEventParams) {
  const { metaPixelId: PIXEL_ID, metaCapiAccessToken: ACCESS_TOKEN } = await getAnalyticsSettings()
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return
  }

  const {
    contentName,
    contentId,
    value,
    currency = 'TWD',
    userEmail,
    clientIpAddress,
    clientUserAgent,
    eventId,
  } = params

  const userData: Record<string, string> = {}
  if (userEmail) {
    userData.em = hashSHA256(userEmail)
  }
  if (clientIpAddress) {
    userData.client_ip_address = clientIpAddress
  }
  if (clientUserAgent) {
    userData.client_user_agent = clientUserAgent
  }

  const eventData = {
    data: [
      {
        event_name: 'ViewContent',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        user_data: userData,
        custom_data: {
          content_name: contentName,
          content_ids: [contentId],
          content_type: 'product',
          value,
          currency,
        },
      },
    ],
  }

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(eventData),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[Meta CAPI] ViewContent 事件發送失敗:', result)
    }
  } catch (error) {
    console.error('[Meta CAPI] ViewContent 發送錯誤:', error)
  }
}
