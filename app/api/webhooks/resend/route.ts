import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/prisma'

function verifySvixSignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return false
  try {
    new Webhook(secret).verify(body, {
      'svix-id': headers.get('svix-id') || '',
      'svix-timestamp': headers.get('svix-timestamp') || '',
      'svix-signature': headers.get('svix-signature') || '',
    })
    return true
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const body = await request.text()
  if (!verifySvixSignature(body, request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = JSON.parse(body) as {
    type?: string
    data?: {
      email_id?: string
      id?: string
      to?: string[]
      bounce?: { type?: string }
    }
  }
  const messageId = event.data?.email_id || event.data?.id
  if (!messageId) return NextResponse.json({ ok: true })

  const recipient = await prisma.newsletterRecipient.findFirst({
    where: { providerMessageId: messageId },
    include: { user: true },
  })
  if (!recipient) return NextResponse.json({ ok: true })

  if (event.type === 'email.bounced') {
    const isPermanent = event.data?.bounce?.type !== 'transient'
    const nextSoftCount = (recipient.user?.emailBounceCount || 0) + 1
    const softBecomesHard = !isPermanent && recipient.user?.emailBounceState === 'SOFT_SUSPENDED'
    const softSuspendedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await prisma.$transaction([
      prisma.newsletterRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'BOUNCED',
          bounceType: isPermanent || softBecomesHard ? 'permanent' : 'transient',
        },
      }),
      ...(recipient.userId
        ? [
            prisma.user.update({
              where: { id: recipient.userId },
              data:
                isPermanent || softBecomesHard
                  ? { emailInvalidAt: new Date(), emailBounceState: 'HARD_BOUNCED', emailBounceCount: { increment: 1 } }
                  : nextSoftCount >= 3
                  ? {
                      emailInvalidAt: softSuspendedUntil,
                      emailBounceCount: { increment: 1 },
                      emailBounceState: 'SOFT_SUSPENDED',
                    }
                  : { emailBounceCount: { increment: 1 } },
            }),
          ]
        : []),
    ])
    await pauseCampaignIfDeliverabilityThresholdExceeded(recipient.campaignId)
  }

  if (event.type === 'email.complained' && recipient.userId) {
    await prisma.$transaction([
      prisma.newsletterRecipient.update({
        where: { id: recipient.id },
        data: { status: 'BOUNCED', bounceType: 'complained' },
      }),
      prisma.user.update({
        where: { id: recipient.userId },
        data: {
          marketingConsent: false,
          emailBounceState: 'COMPLAINED',
          unsubscribedAt: new Date(),
        },
      }),
    ])
    await pauseCampaignIfDeliverabilityThresholdExceeded(recipient.campaignId)
  }

  return NextResponse.json({ ok: true })
}

async function pauseCampaignIfDeliverabilityThresholdExceeded(campaignId: string) {
  const [campaign, bounced, complained] = await Promise.all([
    prisma.newsletterCampaign.findUnique({
      where: { id: campaignId },
      select: { totalRecipients: true, status: true },
    }),
    prisma.newsletterRecipient.count({
      where: { campaignId, isTest: false, status: 'BOUNCED' },
    }),
    prisma.newsletterRecipient.count({
      where: { campaignId, isTest: false, bounceType: 'complained' },
    }),
  ])
  if (!campaign || campaign.totalRecipients <= 0) return

  const bounceRate = bounced / campaign.totalRecipients
  const complaintRate = complained / campaign.totalRecipients
  const shouldPause = bounceRate > 0.02 || complaintRate > 0.003
  if (!shouldPause) return

  await prisma.$transaction([
    prisma.newsletterCampaign.updateMany({
      where: { id: campaignId, status: { in: ['QUEUED', 'SENDING'] } },
      data: {
        status: 'PAUSED',
        errorMessage: `送達率保護已暫停：退信率 ${(bounceRate * 100).toFixed(2)}%，投訴率 ${(complaintRate * 100).toFixed(2)}%。`,
      },
    }),
    prisma.newsletterAlert.create({
      data: {
        campaignId,
        type: complaintRate > 0.003 ? 'ERROR' : 'WARNING',
        title: '送達率保護已暫停電子報',
        message: `退信率 ${(bounceRate * 100).toFixed(2)}%，投訴率 ${(complaintRate * 100).toFixed(2)}%，需 ADMIN 手動確認後再恢復。`,
      },
    }),
  ])
}
