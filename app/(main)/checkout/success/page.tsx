// app/(main)/checkout/success/page.tsx
// 付款成功頁面 — Server Component wrapper（僅負責 metadata）
// 實際訂單狀態輪詢邏輯由 SuccessClient 處理

import { Metadata } from 'next'
import { SuccessClient } from './success-client'

export const metadata: Metadata = {
  title: '付款成功 | 課程平台',
  description: '恭喜您完成購買！',
}

interface SuccessPageProps {
  searchParams: Promise<{
    orderNo?: string
  }>
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { orderNo } = await searchParams

  if (!orderNo) {
    return <SuccessClient orderNo="" />
  }

  return <SuccessClient orderNo={orderNo} />
}
