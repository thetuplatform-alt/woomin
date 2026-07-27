import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const link = await prisma.newsletterLink.findUnique({
    where: { token },
    select: {
      id: true,
      campaignId: true,
      recipientId: true,
      targetUrl: true,
      campaign: { select: { attributionWindowDays: true } },
    },
  })

  if (!link) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  await prisma.$transaction(async (tx) => {
    let uniqueClick = false
    if (link.recipientId) {
      const updated = await tx.newsletterRecipient.updateMany({
        where: { id: link.recipientId, firstClickedAt: null, isTest: false },
        data: { firstClickedAt: new Date() },
      })
      uniqueClick = updated.count === 1
    }
    await tx.newsletterLink.update({
      where: { id: link.id },
      data: {
        clickCount: { increment: 1 },
        ...(uniqueClick ? { uniqueClickCount: { increment: 1 } } : {}),
      },
    })
    await tx.newsletterCampaign.update({
      where: { id: link.campaignId },
      data: { clickCount: { increment: 1 } },
    })
  }).catch(() => undefined)

  const response = NextResponse.redirect(link.targetUrl.startsWith('/') ? new URL(link.targetUrl, request.url) : link.targetUrl)
  response.cookies.set(
    '__newsletter_attr',
    JSON.stringify({
      campaignId: link.campaignId,
      linkId: link.id,
      clickedAt: new Date().toISOString(),
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(request.url).protocol === 'https:',
      path: '/',
      maxAge: Math.max(1, link.campaign.attributionWindowDays || 7) * 24 * 60 * 60,
    }
  )
  return response
}
