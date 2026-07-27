// __tests__/newsletter/prepare-recipients.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 6.4（原分支 2 / v1.7.3 遺留任務 2.3）
// 「Newsletter 同 campaign/email 只建立一位收件人」。
//
// 依 prisma/schema.prisma 的 NewsletterRecipient @@unique([campaignId, toEmail])
// （已由 __tests__/prisma-schema-preservation.test.ts 鎖定該欄位存在），
// lib/newsletter/send.ts 的 prepareNewsletterRecipients() 一律用
// campaignId_toEmail 複合唯一鍵 upsert（不是 create），確保：
// 1. 同一批受眾名單裡若同一 email 出現兩次，只會對到同一筆收件人紀錄。
// 2. 重複呼叫 prepareNewsletterRecipients（例如管理員重按「準備收件人」，
//    或排程重跑）不會建立第二筆收件人，而是 upsert 回同一筆。

const mockFindUniqueOrThrow = jest.fn()
const mockRecipientFindUnique = jest.fn()
const mockRecipientUpsert = jest.fn()
const mockRecipientGroupBy = jest.fn()
const mockCampaignUpdate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    newsletterCampaign: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockCampaignUpdate,
    },
    newsletterRecipient: {
      findUnique: mockRecipientFindUnique,
      upsert: mockRecipientUpsert,
      groupBy: mockRecipientGroupBy,
    },
  },
}))

const mockGetAudienceUsers = jest.fn()
jest.mock('@/lib/newsletter/audience', () => ({
  getAudienceUsers: mockGetAudienceUsers,
  parseSegmentJson: jest.fn((value: unknown) => value),
}))

const mockAssertEmailConsent = jest.fn()
jest.mock('@/lib/newsletter/consent', () => ({
  assertEmailConsent: mockAssertEmailConsent,
  createUnsubscribeToken: jest.fn(),
}))

jest.mock('@/lib/newsletter/unsubscribe-outbox', () => ({
  processPendingUnsubscribeOutbox: jest.fn(),
}))

jest.mock('@/lib/app-url', () => ({
  isInternalAppHost: jest.fn(() => false),
}))

import { prepareNewsletterRecipients } from '@/lib/newsletter/send'

const CAMPAIGN_FIXTURE = {
  id: 'campaign_1',
  type: 'GENERAL',
  segmentJson: null,
  createdById: 'admin_1',
  createdBy: { id: 'admin_1', role: 'ADMIN' },
}

function userFixture(overrides: Partial<{ id: string; email: string; name: string }> = {}) {
  return { id: 'user_1', email: 'student@example.com', name: '學員', ...overrides }
}

describe('prepareNewsletterRecipients：同 campaign/email 只建立一位收件人', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindUniqueOrThrow.mockResolvedValue(CAMPAIGN_FIXTURE)
    mockAssertEmailConsent.mockResolvedValue({ allowed: true })
    mockRecipientFindUnique.mockResolvedValue(null)
    mockRecipientUpsert.mockResolvedValue({ id: 'recipient_1' })
    mockRecipientGroupBy.mockResolvedValue([{ status: 'PENDING', _count: 1 }])
    mockCampaignUpdate.mockResolvedValue({})
  })

  it('同一批受眾名單中同一 email 出現兩次，兩次都 upsert 到完全相同的 campaignId_toEmail 複合鍵（不會產生兩筆收件人）', async () => {
    mockGetAudienceUsers.mockResolvedValue([
      userFixture({ id: 'user_1', email: 'STUDENT@example.com' }),
      userFixture({ id: 'user_1', email: 'student@example.com' }),
    ])

    await prepareNewsletterRecipients('campaign_1')

    expect(mockRecipientUpsert).toHaveBeenCalledTimes(2)
    const firstCallWhere = mockRecipientUpsert.mock.calls[0][0].where
    const secondCallWhere = mockRecipientUpsert.mock.calls[1][0].where
    // Email 統一小寫比對：即使名單裡大小寫不同，複合鍵仍指向同一列。
    expect(firstCallWhere).toEqual({
      campaignId_toEmail: { campaignId: 'campaign_1', toEmail: 'student@example.com' },
    })
    expect(secondCallWhere).toEqual(firstCallWhere)
  })

  it('重複呼叫 prepareNewsletterRecipients（例如管理員重按「準備收件人」）：第二次一律 upsert 回同一筆，不會呼叫 create 產生第二筆', async () => {
    mockGetAudienceUsers.mockResolvedValue([userFixture()])

    await prepareNewsletterRecipients('campaign_1')
    expect(mockRecipientUpsert).toHaveBeenCalledTimes(1)

    // 第二次呼叫時，該收件人已存在且狀態為 PENDING（尚未寄出）。
    mockRecipientFindUnique.mockResolvedValue({ status: 'PENDING', isTest: false })
    await prepareNewsletterRecipients('campaign_1')

    expect(mockRecipientUpsert).toHaveBeenCalledTimes(2)
    expect(mockRecipientUpsert.mock.calls[1][0].where).toEqual(
      mockRecipientUpsert.mock.calls[0][0].where
    )
    // prepareNewsletterRecipients 完全不使用 create()：唯一的寫入路徑是
    // 帶 create/update 兩段的 upsert，鍵住 campaignId_toEmail 複合唯一鍵，
    // 確保第二次呼叫是「更新既有列」而非「插入新列」。
    expect(mockRecipientUpsert.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: expect.any(Object),
        create: expect.any(Object),
        update: expect.any(Object),
      })
    )
  })

  it('已經寄出（SENT）的收件人不會被重新排入，也不會再次 upsert（避免重複寄送同一封）', async () => {
    mockGetAudienceUsers.mockResolvedValue([userFixture()])
    mockRecipientFindUnique.mockResolvedValue({ status: 'SENT', isTest: false })

    await prepareNewsletterRecipients('campaign_1')

    expect(mockRecipientUpsert).not.toHaveBeenCalled()
  })
})
