// components/common/meta-pixel-events.tsx
// Meta Pixel 事件追蹤元件
// 用於在特定頁面觸發 Meta Pixel 標準事件

'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void
  }
}

/**
 * Meta Pixel 初始化元件（含進階配對）
 * 放在 SessionProvider 內，當用戶已登入時會自動帶入 email 做進階配對
 * 同時在每次路由切換時觸發 PageView 事件
 *
 * pixelId 由 server component 從 DB 讀取後傳入
 */
export function MetaPixelInit({ pixelId }: { pixelId?: string }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const initializedRef = useRef(false)

  // 初始化 fbq（帶入進階配對資料）
  useEffect(() => {
    if (typeof window.fbq !== 'function' || !pixelId) return

    // 已登入用戶：帶入 email 做進階配對
    const advancedMatchingData: Record<string, string> = {}
    if (session?.user?.email) {
      advancedMatchingData.em = session.user.email
    }
    if (session?.user?.name) {
      // Meta Pixel 接受 fn（名）— 這裡傳完整姓名，Meta 會自動處理
      advancedMatchingData.fn = session.user.name
    }

    window.fbq('init', pixelId, advancedMatchingData)
    window.fbq('track', 'PageView')
    initializedRef.current = true
  }, [pixelId, session?.user?.email, session?.user?.name])

  // 路由切換時重新觸發 PageView
  useEffect(() => {
    if (!initializedRef.current) return
    if (typeof window.fbq !== 'function') return
    window.fbq('track', 'PageView')
  }, [pathname])

  return null
}

/**
 * 觸發 Meta Pixel Purchase 事件（結帳成功頁面使用）
 */
export function MetaPixelPurchase({
  value,
  currency = 'TWD',
  contentName,
  contentId,
  eventId,
}: {
  value: number
  currency?: string
  contentName?: string
  contentId?: string
  /** 用於與 Conversions API 去重的 event_id（使用 orderNo） */
  eventId?: string
}) {
  useEffect(() => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Purchase', {
        value,
        currency,
        content_name: contentName,
        content_ids: contentId ? [contentId] : undefined,
        content_type: 'product',
      }, { eventID: eventId })
    }
  }, [value, currency, contentName, contentId, eventId])

  return null
}

/**
 * 觸發 Meta Pixel ViewContent 事件（課程銷售頁使用）
 */
export function MetaPixelViewContent({
  contentName,
  contentId,
  value,
  currency = 'TWD',
  eventId,
}: {
  contentName: string
  contentId: string
  value?: number
  currency?: string
  /** 用於與 Conversions API 去重的 event_id */
  eventId?: string
}) {
  useEffect(() => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'ViewContent', {
        content_name: contentName,
        content_ids: [contentId],
        content_type: 'product',
        value,
        currency,
      }, { eventID: eventId })
    }
  }, [contentName, contentId, value, currency, eventId])

  return null
}

/**
 * 觸發 Meta Pixel AddToCart 事件（用戶點擊 CTA 進入結帳頁時使用）
 */
export function MetaPixelAddToCart({
  contentName,
  contentId,
  value,
  currency = 'TWD',
}: {
  contentName: string
  contentId: string
  value?: number
  currency?: string
}) {
  useEffect(() => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'AddToCart', {
        content_name: contentName,
        content_ids: [contentId],
        content_type: 'product',
        value,
        currency,
      })
    }
  }, [contentName, contentId, value, currency])

  return null
}

/**
 * 觸發 Meta Pixel InitiateCheckout 事件（結帳頁載入時使用）
 */
export function MetaPixelInitiateCheckout({
  contentName,
  contentId,
  value,
  currency = 'TWD',
}: {
  contentName: string
  contentId: string
  value?: number
  currency?: string
}) {
  useEffect(() => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout', {
        content_name: contentName,
        content_ids: [contentId],
        content_type: 'product',
        value,
        currency,
        num_items: 1,
      })
    }
  }, [contentName, contentId, value, currency])

  return null
}

/**
 * 觸發 Meta Pixel CompleteRegistration 事件（註冊成功時使用）
 */
export function MetaPixelCompleteRegistration({
  status,
  currency = 'TWD',
}: {
  /** 註冊狀態，例如 'success' */
  status?: string
  currency?: string
}) {
  useEffect(() => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'CompleteRegistration', {
        status,
        currency,
      })
    }
  }, [status, currency])

  return null
}

/**
 * 命令式觸發 Meta Pixel 事件（用於事件處理函數中）
 */
export function trackMetaPixelEvent(
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    if (options) {
      window.fbq('track', eventName, params, options)
    } else {
      window.fbq('track', eventName, params)
    }
  }
}
