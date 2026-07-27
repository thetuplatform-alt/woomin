import { NextResponse } from 'next/server'
import { dispatchNewsletters } from '@/lib/newsletter/send'
import { runSubscriptionMaintenancePiggyback } from '@/lib/subscription/maintenance'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  const token = auth?.replace(/^Bearer\s+/i, '') || new URL(request.url).searchParams.get('secret')

  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.info('[newsletter] cron dispatch triggered')

  // Piggyback 訂閱維運 tick（AC-72）：maintenance 先跑、硬性預算 ≤10 秒、
  // SiteSetting 時間戳原子 claim（每 20 小時一次）、try/catch 完全隔離——
  // 訂閱維運任何失敗都不得影響 newsletter 既有寄送行為。
  const maintenance = await runSubscriptionMaintenancePiggyback()

  // maintenance 已吃掉部分預算，dispatch 視窗相應縮短為 45 秒（總和 <55s）。
  await dispatchNewsletters({ windowMs: 45_000 })
  return NextResponse.json({ ok: true, maintenance })
}
