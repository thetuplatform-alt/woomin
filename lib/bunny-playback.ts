import { createHash, timingSafeEqual, createHmac } from 'node:crypto'

export function createBunnyPlaybackToken(apiKey: string, videoGuid: string, expires: number): string {
  return createHash('sha256').update(`${apiKey}${videoGuid}${expires}`).digest('hex')
}

export function bunnyPlaybackExpiry(now: number, duration: number | null): number {
  return now + Math.max(7200, (duration ?? 0) + 3600)
}

export function createBunnyWebhookSignature(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}

export function isValidBunnyWebhookSignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = createBunnyWebhookSignature(secret, rawBody)
  const actual = Buffer.from(signature, 'utf8')
  const wanted = Buffer.from(expected, 'utf8')
  return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}

export function bunnyStatusFromCode(status: number): string {
  if (status === 3 || status === 4) return 'ready'
  if (status === 5) return 'failed'
  return 'processing'
}
