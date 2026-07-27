import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { applyUnsubscribe, verifyUnsubscribeToken, type UnsubscribeScope } from '@/lib/newsletter/consent'
import { enqueueUnsubscribeRequest } from '@/lib/newsletter/unsubscribe-outbox'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

async function unsubscribeAction(formData: FormData) {
  'use server'

  const email = String(formData.get('email') || '')
  const token = String(formData.get('token') || '')
  const campaignId = String(formData.get('campaignId') || '') || null
  const verified = verifyUnsubscribeToken({ token, email })
  if (!verified.ok || !verified.userId || !verified.scope) {
    redirect('/unsubscribe?status=invalid')
  }

  let done = false
  try {
    await applyUnsubscribe({
      userId: verified.userId,
      email,
      scope: verified.scope,
      campaignId,
    })
    done = true
  } catch (error) {
    console.error('[Newsletter] unsubscribe deferred:', error)
    await enqueueUnsubscribeRequest({
      userId: verified.userId,
      email,
      scope: verified.scope,
      campaignId,
      source: 'unsubscribe_page_deferred',
    }).catch((outboxError) => {
      console.error('[Newsletter] unsubscribe outbox enqueue failed:', outboxError)
    })
  }
  redirect(done ? '/unsubscribe?status=done' : '/unsubscribe?status=queued')
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : ''
  const email = typeof params.email === 'string' ? params.email : ''
  const token = typeof params.token === 'string' ? params.token : ''
  const campaignId = typeof params.campaignId === 'string' ? params.campaignId : ''
  const verified = email && token ? verifyUnsubscribeToken({ token, email }) : { ok: false }
  const signedScope = verified.ok && verified.scope ? verified.scope : null
  const user = verified.ok && verified.userId
    ? await prisma.user.findUnique({
        where: { id: verified.userId },
        select: { email: true, generalEmailConsent: true, marketingConsent: true, unsubscribedAt: true },
      }).catch(() => null)
    : null

  return (
    <main className="min-h-screen bg-[#f5f5f5] px-4 py-16">
      <Card className="mx-auto max-w-xl rounded-xl border bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">電子報訂閱偏好</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-muted-foreground">
          {status === 'done' ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
              已更新你的訂閱偏好。交易通知（購買確認、密碼重設、帳號安全通知）不受影響。
            </div>
          ) : null}
          {status === 'queued' ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
              已收到你的退訂請求，系統會在服務恢復後完成處理。交易通知不受影響。
            </div>
          ) : null}
          {status === 'invalid' ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              退訂連結驗證失敗，請回到原信件重新點擊連結。
            </div>
          ) : null}
          {!verified.ok && !status ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              退訂連結缺少必要資訊或已無法驗證。
            </div>
          ) : null}
          {verified.ok && !user && !status ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
              已驗證退訂連結，但目前無法讀取訂閱狀態。你仍可送出退訂請求，系統會在服務恢復後完成處理。
            </div>
          ) : null}
          {verified.ok ? (
            <>
              <p>
                目前信箱：<span className="font-medium text-foreground">{user?.email || email}</span>
              </p>
              <p>
                這個連結只會更新原信件簽章授權的訂閱範圍。交易通知仍會在必要時寄送。
              </p>
              <form action={unsubscribeAction} className="grid gap-3">
                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <Button variant={signedScope === 'all' ? 'destructive' : 'default'} type="submit">
                  {scopeLabel(signedScope)}
                </Button>
              </form>
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}

function scopeLabel(scope: UnsubscribeScope | null) {
  if (scope === 'all') return '全部退訂'
  if (scope === 'general') return '退訂一般學習電子報'
  return '退訂促銷優惠電子報'
}
