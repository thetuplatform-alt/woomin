import {
  processAutomationDeliveryById,
  processPendingAutomationDeliveries,
} from '@/lib/newsletter/automation/delivery-service'
import { sendCustomHtmlEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { assertEmailConsent } from '@/lib/newsletter/consent'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    newsletterAutomationDelivery: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    purchase: {
      findMany: jest.fn(),
    },
  },
}))
jest.mock('@/lib/email', () => ({
  sendCustomHtmlEmail: jest.fn(),
}))
jest.mock('@/lib/app-url', () => ({
  resolveAppUrl: jest.fn(() => Promise.resolve('https://realms.test')),
}))
jest.mock('@/lib/newsletter/render', () => ({
  normalizeNewsletterContent: jest.fn(() => ({ blocks: [] })),
  renderCampaignHtml: jest.fn(() => '<html>Automation email</html>'),
}))
jest.mock('@/lib/newsletter/settings', () => ({
  getNewsletterSettings: jest.fn(() =>
    Promise.resolve({
      siteName: 'Realms',
      siteLogo: 'https://realms.test/icon.png',
      appUrl: 'https://realms.test',
      footerName: 'Realms',
      footerAddress: '',
      footerEmail: 'noreply@realms.test',
    })
  ),
}))
jest.mock('@/lib/newsletter/consent', () => ({
  assertEmailConsent: jest.fn(),
}))

const newsletterAutomationDelivery = prisma.newsletterAutomationDelivery as unknown as {
  findMany: jest.Mock
  findUnique: jest.Mock
  update: jest.Mock
  updateMany: jest.Mock
}
const purchase = prisma.purchase as unknown as {
  findMany: jest.Mock
}
const mockedAssertEmailConsent = assertEmailConsent as jest.Mock

function deliveryFixture() {
  return {
    id: 'delivery_1',
    status: 'PENDING',
    scheduledAt: new Date('2026-08-04T10:00:00Z'),
    enrollment: {
      id: 'enrollment_1',
      userId: 'user_1',
      user: {
        email: 'student@example.com',
        name: '學員',
      },
      automation: {
        id: 'automation_1',
        courseId: 'course_abc',
        course: {
          id: 'course_abc',
          title: '自動化測試課',
          slug: 'automation-course',
        },
      },
    },
    step: {
      id: 'step_1',
      enabled: true,
      subjectTemplate: '第 1 封跟進信',
      contentJson: { blocks: [{ id: 'b1', type: 'paragraph', text: 'Hello' }] },
    },
  }
}

describe('newsletter automation delivery-service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    newsletterAutomationDelivery.updateMany.mockResolvedValue({ count: 1 })
    mockedAssertEmailConsent.mockResolvedValue({ allowed: true })
    purchase.findMany.mockResolvedValue([
      {
        id: 'purchase_1',
        revokedAt: null,
        expiresAt: null,
      },
    ])
  })

  it('skips a due delivery without sending when course access has expired', async () => {
    newsletterAutomationDelivery.findMany.mockResolvedValue([deliveryFixture()])
    purchase.findMany.mockResolvedValue([
      {
        id: 'purchase_1',
        revokedAt: null,
        expiresAt: new Date('2026-08-03T10:00:00Z'),
      },
    ])

    await expect(
      processPendingAutomationDeliveries(new Date('2026-08-04T10:00:00Z'))
    ).resolves.toEqual({
      selected: 1,
      claimed: 1,
      sent: 0,
      failed: 0,
      skipped: 1,
      unclaimed: 0,
    })

    expect(sendCustomHtmlEmail).not.toHaveBeenCalled()
    expect(newsletterAutomationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery_1' },
      data: {
        status: 'SKIPPED',
        errorMessage: 'subscription_access_revoked',
      },
    })
  })

  it('sends a due delivery when the student still has active course access', async () => {
    newsletterAutomationDelivery.findUnique.mockResolvedValue(deliveryFixture())
    ;(sendCustomHtmlEmail as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'message_1',
    })

    await expect(processAutomationDeliveryById('delivery_1')).resolves.toBe('sent')

    expect(purchase.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        courseId: 'course_abc',
      },
      select: {
        revokedAt: true,
        expiresAt: true,
      },
    })
    expect(sendCustomHtmlEmail).toHaveBeenCalledWith({
      to: 'student@example.com',
      subject: '第 1 封跟進信',
      html: '<html>Automation email</html>',
    })
    expect(newsletterAutomationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery_1' },
      data: expect.objectContaining({
        status: 'SENT',
        providerMessageId: 'message_1',
      }),
    })
  })
})
