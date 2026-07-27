import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const PROCESSING_LEASE_MS = 5 * 60 * 1000

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}
export async function claimWebhookEvent(params: {
  gateway: 'stripe' | 'payuni'
  eventId: string
  eventType: string
  payload?: Prisma.InputJsonValue
}): Promise<'PROCESS' | 'DUPLICATE' | 'IN_PROGRESS'> {
  try {
    await prisma.paymentWebhookEvent.create({
      data: {
        gateway: params.gateway,
        eventId: params.eventId,
        eventType: params.eventType,
        payload: params.payload,
      },
    })
    return 'PROCESS'
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
  }

  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: {
      gateway_eventId: {
        gateway: params.gateway,
        eventId: params.eventId,
      },
    },
    select: { status: true, updatedAt: true },
  })
  if (!existing || existing.status === 'PROCESSED') return 'DUPLICATE'

  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS)
  const reclaimed = await prisma.paymentWebhookEvent.updateMany({
    where: {
      gateway: params.gateway,
      eventId: params.eventId,
      OR: [
        { status: 'FAILED' },
        { status: 'PROCESSING', updatedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: 'PROCESSING',
      eventType: params.eventType,
      payload: params.payload,
      attempts: { increment: 1 },
      lastError: null,
    },
  })

  return reclaimed.count === 1 ? 'PROCESS' : 'IN_PROGRESS'
}

export async function completeWebhookEvent(
  gateway: 'stripe' | 'payuni',
  eventId: string
): Promise<void> {
  await prisma.paymentWebhookEvent.updateMany({
    where: { gateway, eventId, status: 'PROCESSING' },
    data: {
      status: 'PROCESSED',
      processedAt: new Date(),
      lastError: null,
    },
  })
}

export async function failWebhookEvent(
  gateway: 'stripe' | 'payuni',
  eventId: string,
  error: unknown
): Promise<void> {
  await prisma.paymentWebhookEvent.updateMany({
    where: { gateway, eventId, status: 'PROCESSING' },
    data: {
      status: 'FAILED',
      lastError:
        error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
    },
  })
}

export function fingerprintPayUniPeriodEvent(
  payload: Record<string, unknown>
): string {
  const stable = [
    payload.PeriodOrderNo,
    payload.Status,
    payload.TradeNo,
    payload.ResCode,
    payload.AuthDay,
    payload.AuthTime,
    payload.ThisPeriod,
    payload.AuthAmt,
  ]
    .map((value) => String(value ?? ''))
    .join('|')
  return crypto.createHash('sha256').update(stable).digest('hex')
}
