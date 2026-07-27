import { NewsletterAutomationDeliveryStatus, NewsletterType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendCustomHtmlEmail } from '@/lib/email'
import { assertEmailConsent } from '@/lib/newsletter/consent'
import { getNewsletterSettings } from '@/lib/newsletter/settings'
import { normalizeNewsletterContent, renderCampaignHtml } from '@/lib/newsletter/render'
import { isPurchaseActive } from '@/lib/purchase/is-active'
import type {
  AutomationDeliveryProcessCounts,
  AutomationDeliveryProcessOutcome,
  NewsletterAutomationDeliveryForSending,
} from '@/lib/newsletter/automation/types'

const SKIP_REASON_ACCESS_REVOKED = 'subscription_access_revoked'

function createCounts(selected = 0): AutomationDeliveryProcessCounts {
  return {
    selected,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    unclaimed: 0,
  }
}

async function claimDelivery(deliveryId: string): Promise<boolean> {
  const updated = await prisma.newsletterAutomationDelivery.updateMany({
    where: {
      id: deliveryId,
      status: NewsletterAutomationDeliveryStatus.PENDING,
    },
    data: {
      status: NewsletterAutomationDeliveryStatus.PROCESSING,
      errorMessage: null,
    },
  })

  return updated.count === 1
}

async function markFailed(deliveryId: string, errorMessage: string): Promise<void> {
  await prisma.newsletterAutomationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: NewsletterAutomationDeliveryStatus.FAILED,
      errorMessage,
    },
  })
}

async function markSkipped(deliveryId: string, errorMessage: string): Promise<void> {
  await prisma.newsletterAutomationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: NewsletterAutomationDeliveryStatus.SKIPPED,
      errorMessage,
    },
  })
}

async function hasActiveCourseAccess(
  userId: string,
  courseId: string,
  now: Date
): Promise<boolean> {
  const purchases = await prisma.purchase.findMany({
    where: {
      userId,
      courseId,
    },
    select: {
      revokedAt: true,
      expiresAt: true,
    },
  })

  return purchases.some((purchase) => isPurchaseActive(purchase, now))
}

async function renderAutomationHtml(
  delivery: NewsletterAutomationDeliveryForSending
): Promise<string> {
  const settings = await getNewsletterSettings()
  const toEmail = delivery.enrollment.user.email || ''
  const unsubscribeUrl = `${settings.appUrl}/unsubscribe?email=${encodeURIComponent(toEmail)}&automationDeliveryId=${encodeURIComponent(delivery.id)}`
  const context = {
    type: NewsletterType.GENERAL,
    subject: delivery.step?.subjectTemplate || '',
    preheader: null,
    siteName: settings.siteName,
    siteLogo: settings.siteLogo,
    appUrl: settings.appUrl,
    footerName: settings.footerName || settings.siteName,
    footerAddress: settings.footerAddress,
    footerEmail: settings.footerEmail,
    unsubscribeUrl,
    recipientName: delivery.enrollment.user.name,
    courseName: delivery.enrollment.automation.course.title,
    mode: 'send' as const,
  }

  return renderCampaignHtml(
    normalizeNewsletterContent(delivery.step?.contentJson),
    context
  )
}

async function processClaimedDelivery(
  delivery: NewsletterAutomationDeliveryForSending,
  now: Date
): Promise<AutomationDeliveryProcessOutcome> {
  if (!delivery.step || !delivery.step.enabled) {
    await markSkipped(delivery.id, '信件步驟已停用或不存在')
    return 'skipped'
  }

  const toEmail = delivery.enrollment.user.email
  if (!toEmail) {
    await markFailed(delivery.id, '學員沒有 Email')
    return 'failed'
  }

  const consent = await assertEmailConsent(
    delivery.enrollment.userId,
    'transactional'
  )
  if (!consent.allowed) {
    await markSkipped(delivery.id, consent.reason || 'consent_denied')
    return 'skipped'
  }

  const stillHasAccess = await hasActiveCourseAccess(
    delivery.enrollment.userId,
    delivery.enrollment.automation.courseId,
    now
  )
  if (!stillHasAccess) {
    await markSkipped(delivery.id, SKIP_REASON_ACCESS_REVOKED)
    return 'skipped'
  }

  try {
    const result = await sendCustomHtmlEmail({
      to: toEmail,
      subject: delivery.step.subjectTemplate,
      html: await renderAutomationHtml(delivery),
    })

    if (result.success) {
      await prisma.newsletterAutomationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NewsletterAutomationDeliveryStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.messageId || null,
          errorMessage: null,
        },
      })
      return 'sent'
    }

    await markFailed(delivery.id, result.error || '發送失敗')
    return 'failed'
  } catch (error) {
    await markFailed(
      delivery.id,
      error instanceof Error ? error.message : '發送失敗'
    )
    return 'failed'
  }
}

export async function processAutomationDeliveryById(
  deliveryId: string,
  now = new Date()
): Promise<AutomationDeliveryProcessOutcome> {
  const delivery = await prisma.newsletterAutomationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      enrollment: {
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
          automation: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      step: true,
    },
  })

  if (
    !delivery ||
    delivery.status !== NewsletterAutomationDeliveryStatus.PENDING
  ) {
    return delivery ? 'unclaimed' : 'not_found'
  }

  const claimed = await claimDelivery(delivery.id)
  if (!claimed) return 'unclaimed'

  return processClaimedDelivery(delivery, now)
}

export async function processPendingAutomationDeliveries(
  now = new Date(),
  limit = 50
): Promise<AutomationDeliveryProcessCounts> {
  const deliveries = await prisma.newsletterAutomationDelivery.findMany({
    where: {
      status: NewsletterAutomationDeliveryStatus.PENDING,
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    include: {
      enrollment: {
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
          automation: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      step: true,
    },
  })

  const counts = createCounts(deliveries.length)

  for (const delivery of deliveries) {
    const claimed = await claimDelivery(delivery.id)
    if (!claimed) {
      counts.unclaimed += 1
      continue
    }

    counts.claimed += 1
    const outcome = await processClaimedDelivery(delivery, now)
    if (outcome === 'sent') counts.sent += 1
    if (outcome === 'failed') counts.failed += 1
    if (outcome === 'skipped') counts.skipped += 1
  }

  return counts
}
