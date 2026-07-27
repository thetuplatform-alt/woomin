import fs from 'fs/promises'
import path from 'path'
import { applyUnsubscribe, type UnsubscribeScope } from '@/lib/newsletter/consent'

export interface PendingUnsubscribeRequest {
  userId: string
  email: string
  scope: UnsubscribeScope
  campaignId?: string | null
  source?: string
  ip?: string | null
  requestedAt: string
}

function outboxPath() {
  return (
    process.env.NEWSLETTER_UNSUBSCRIBE_OUTBOX_PATH ||
    (process.env.NODE_ENV === 'production'
      ? '/data/newsletter-unsubscribe-outbox.jsonl'
      : path.join(process.cwd(), '.newsletter-unsubscribe-outbox.jsonl'))
  )
}

export async function enqueueUnsubscribeRequest(request: Omit<PendingUnsubscribeRequest, 'requestedAt'>) {
  const file = outboxPath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.appendFile(file, `${JSON.stringify({ ...request, requestedAt: new Date().toISOString() })}\n`, 'utf8')
}

export async function processPendingUnsubscribeOutbox() {
  const file = outboxPath()
  let raw = ''
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch {
    return
  }

  const pending: string[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const request = JSON.parse(line) as PendingUnsubscribeRequest
      await applyUnsubscribe({
        userId: request.userId,
        email: request.email,
        scope: request.scope,
        campaignId: request.campaignId,
        source: request.source || 'unsubscribe_page_retry',
        ip: request.ip,
      })
    } catch {
      pending.push(line)
    }
  }

  if (pending.length === 0) {
    await fs.rm(file, { force: true })
  } else {
    await fs.writeFile(file, `${pending.join('\n')}\n`, 'utf8')
  }
}
