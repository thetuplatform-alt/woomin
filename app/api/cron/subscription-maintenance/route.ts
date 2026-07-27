// app/api/cron/subscription-maintenance/route.ts
// 訂閱制維運 tick 的主 cron 入口（AC-70）。
//
// 認證：僅接受 Authorization: Bearer CRON_SECRET（不收 ?secret= query param，
// 避免 secret 進 access log）。production 未設 CRON_SECRET 一律拒絕（503），
// 不像 course-expiration 那樣在缺 secret 時放行——扣款端維運不得裸奔。
//
// 觸發者：vercel.json 的 Vercel Cron（Vercel 部署）＋ onboarding 部署的 Zeabur
// curl-loop worker（預設部署目標）。piggyback 另一入口見 /api/cron/newsletter-dispatch。

import { NextResponse } from 'next/server'
import { runSubscriptionMaintenance } from '@/lib/subscription/maintenance'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  // production 未設 secret → 拒絕（維運端不可裸奔）
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 503 }
      )
    }
    // 非 production 且未設 secret：本地測試放行
  } else {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  console.info('[subscription-maintenance] cron triggered')
  const result = await runSubscriptionMaintenance({ budgetMs: 50_000 })
  return NextResponse.json(result)
}
