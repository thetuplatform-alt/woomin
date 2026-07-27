import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const PIXEL = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const recipient = await prisma.newsletterRecipient.findUnique({
    where: { id: token },
    select: { id: true, campaignId: true, openedAt: true, isTest: true },
  }).catch(() => null)

  if (recipient && !recipient.isTest) {
    const firstOpen = !recipient.openedAt
    await prisma.$transaction([
      prisma.newsletterRecipient.update({
        where: { id: recipient.id },
        data: { openedAt: recipient.openedAt || new Date() },
      }),
      ...(firstOpen
        ? [
            prisma.newsletterCampaign.update({
              where: { id: recipient.campaignId },
              data: { openCount: { increment: 1 } },
            }),
          ]
        : []),
    ]).catch(() => undefined)
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
