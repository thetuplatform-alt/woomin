// __tests__/newsletter/consent.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 6.5（原分支 2 / v1.7.3 遺留任務 2.4）
// 「促銷信只寄 marketingConsent=true；促銷退訂不誤擋交易信/允許的 CRM 學習信；
// hard bounce 需全面阻擋」。
//
// assertEmailConsent()（lib/newsletter/consent.ts）是全站唯一的 Email 同意
// 判斷函式，本檔直接測它的每一種分支組合，尚無任何既有測試涵蓋。

const mockUserFindUnique = jest.fn()
const mockEmailConsentLogFindFirst = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    emailConsentLog: { findFirst: mockEmailConsentLogFindFirst },
  },
}))

import { assertEmailConsent } from '@/lib/newsletter/consent'

function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    email: 'student@example.com',
    marketingConsent: false,
    generalEmailConsent: true,
    unsubscribedAt: null,
    emailInvalidAt: null,
    emailBounceState: 'NONE',
    country: 'TW',
    ...overrides,
  }
}

describe('assertEmailConsent：hard bounce 需全面阻擋（優先於任何 type，包含 transactional）', () => {
  it.each(['transactional', 'general', 'marketing'] as const)(
    'HARD_BOUNCED 使用者：type=%s 一律被擋（連交易信也不例外）',
    async (type) => {
      mockUserFindUnique.mockResolvedValue(
        userFixture({ emailBounceState: 'HARD_BOUNCED', marketingConsent: true, unsubscribedAt: null })
      )
      await expect(assertEmailConsent('user_1', type, 'student@example.com')).resolves.toEqual({
        allowed: false,
        reason: 'email_invalid_or_complained',
      })
    }
  )

  it.each(['transactional', 'general', 'marketing'] as const)(
    'COMPLAINED 使用者：type=%s 一律被擋',
    async (type) => {
      mockUserFindUnique.mockResolvedValue(userFixture({ emailBounceState: 'COMPLAINED' }))
      await expect(assertEmailConsent('user_1', type, 'student@example.com')).resolves.toEqual({
        allowed: false,
        reason: 'email_invalid_or_complained',
      })
    }
  )

  it('SOFT_SUSPENDED 且暫停期限尚未到期：連交易信也被擋（soft_bounce_suspended）', async () => {
    mockUserFindUnique.mockResolvedValue(
      userFixture({
        emailBounceState: 'SOFT_SUSPENDED',
        emailInvalidAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 明天才到期
      })
    )
    await expect(assertEmailConsent('user_1', 'transactional')).resolves.toEqual({
      allowed: false,
      reason: 'soft_bounce_suspended',
    })
  })

  it('SOFT_SUSPENDED 但暫停期限已過期：不再被此分支擋下，回到正常同意判斷', async () => {
    mockUserFindUnique.mockResolvedValue(
      userFixture({
        emailBounceState: 'SOFT_SUSPENDED',
        emailInvalidAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨天已到期
      })
    )
    await expect(assertEmailConsent('user_1', 'transactional')).resolves.toEqual({ allowed: true })
  })

  it('emailInvalidAt 有值但 bounceState 不是 SOFT_SUSPENDED：視為無效地址，全面擋下', async () => {
    mockUserFindUnique.mockResolvedValue(
      userFixture({ emailBounceState: 'NONE', emailInvalidAt: new Date('2026-01-01') })
    )
    await expect(assertEmailConsent('user_1', 'transactional')).resolves.toEqual({
      allowed: false,
      reason: 'email_invalid_or_complained',
    })
  })

  it('找不到使用者：明確拒絕（user_not_found），不當作允許處理', async () => {
    mockUserFindUnique.mockResolvedValue(null)
    await expect(assertEmailConsent('user_missing', 'transactional')).resolves.toEqual({
      allowed: false,
      reason: 'user_not_found',
    })
  })
})

describe('assertEmailConsent：促銷退訂不誤擋交易信（unsubscribedAt 只擋 general/marketing）', () => {
  it('已退訂全部（unsubscribedAt 有值）：交易信（type=transactional）仍然允許寄送', async () => {
    mockUserFindUnique.mockResolvedValue(
      userFixture({ unsubscribedAt: new Date('2026-06-01'), marketingConsent: false, generalEmailConsent: false })
    )
    await expect(assertEmailConsent('user_1', 'transactional')).resolves.toEqual({ allowed: true })
  })

  it('已退訂全部：一般電子報（type=general）被擋（unsubscribed_all）', async () => {
    mockUserFindUnique.mockResolvedValue(userFixture({ unsubscribedAt: new Date('2026-06-01') }))
    await expect(assertEmailConsent('user_1', 'general')).resolves.toEqual({
      allowed: false,
      reason: 'unsubscribed_all',
    })
  })

  it('已退訂全部：促銷信（type=marketing）被擋（unsubscribed_all），即使 marketingConsent 仍是 true', async () => {
    mockUserFindUnique.mockResolvedValue(
      userFixture({ unsubscribedAt: new Date('2026-06-01'), marketingConsent: true })
    )
    await expect(assertEmailConsent('user_1', 'marketing')).resolves.toEqual({
      allowed: false,
      reason: 'unsubscribed_all',
    })
  })
})

describe('assertEmailConsent：促銷信只寄 marketingConsent=true', () => {
  it('marketingConsent=true 且未退訂：允許寄送促銷信', async () => {
    mockUserFindUnique.mockResolvedValue(userFixture({ marketingConsent: true }))
    await expect(assertEmailConsent('user_1', 'marketing')).resolves.toEqual({ allowed: true })
  })

  it('marketingConsent=false：擋下促銷信（marketing_consent_missing）', async () => {
    mockUserFindUnique.mockResolvedValue(userFixture({ marketingConsent: false }))
    await expect(assertEmailConsent('user_1', 'marketing')).resolves.toEqual({
      allowed: false,
      reason: 'marketing_consent_missing',
    })
  })

  it('marketingConsent=null（未曾表態）：擋下促銷信，不當作預設允許', async () => {
    mockUserFindUnique.mockResolvedValue(userFixture({ marketingConsent: null }))
    await expect(assertEmailConsent('user_1', 'marketing')).resolves.toEqual({
      allowed: false,
      reason: 'marketing_consent_missing',
    })
  })
})

describe('assertEmailConsent：一般電子報（general）與港澳加註規則', () => {
  it('非 HK 使用者：generalEmailConsent=true 允許', async () => {
    mockUserFindUnique.mockResolvedValue(userFixture({ country: 'TW', generalEmailConsent: true }))
    await expect(assertEmailConsent('user_1', 'general')).resolves.toEqual({ allowed: true })
  })

  it('非 HK 使用者：generalEmailConsent=false 擋下（general_unsubscribed）', async () => {
    mockUserFindUnique.mockResolvedValue(userFixture({ country: 'TW', generalEmailConsent: false }))
    await expect(assertEmailConsent('user_1', 'general')).resolves.toEqual({
      allowed: false,
      reason: 'general_unsubscribed',
    })
  })

  it('HK 使用者：即使 generalEmailConsent 預設 true，未明確 opt-in 一樣被擋（hk_general_requires_opt_in）', async () => {
    mockUserFindUnique.mockResolvedValue(
      userFixture({ country: 'HK', generalEmailConsent: false })
    )
    await expect(assertEmailConsent('user_1', 'general')).resolves.toEqual({
      allowed: false,
      reason: 'hk_general_requires_opt_in',
    })
  })

  it('HK 使用者：明確 opt-in（generalEmailConsent=true）後允許', async () => {
    mockUserFindUnique.mockResolvedValue(userFixture({ country: 'HK', generalEmailConsent: true }))
    await expect(assertEmailConsent('user_1', 'general')).resolves.toEqual({ allowed: true })
  })
})

describe('assertEmailConsent：訪客 / 無帳號的外部聯絡人（userId 為 null）', () => {
  it('訪客交易信一律允許（結帳收據等必要通知不受同意機制限制）', async () => {
    await expect(assertEmailConsent(null, 'transactional')).resolves.toEqual({ allowed: true })
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  it('訪客促銷信且沒有 fallbackEmail：直接擋下，不查詢同意紀錄', async () => {
    await expect(assertEmailConsent(null, 'marketing')).resolves.toEqual({
      allowed: false,
      reason: 'external_contact_requires_explicit_consent',
    })
    expect(mockEmailConsentLogFindFirst).not.toHaveBeenCalled()
  })

  it('訪客促銷信且有 fallbackEmail、最新同意紀錄為 GRANTED：允許', async () => {
    mockEmailConsentLogFindFirst.mockResolvedValue({ action: 'GRANTED' })
    await expect(
      assertEmailConsent(null, 'marketing', 'external@example.com')
    ).resolves.toEqual({ allowed: true })
    expect(mockEmailConsentLogFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: 'external@example.com',
          consentType: 'MARKETING',
        }),
      })
    )
  })

  it('訪客促銷信且有 fallbackEmail、最新同意紀錄為 REVOKED（或無紀錄）：擋下', async () => {
    mockEmailConsentLogFindFirst.mockResolvedValue({ action: 'REVOKED' })
    await expect(
      assertEmailConsent(null, 'marketing', 'external@example.com')
    ).resolves.toEqual({
      allowed: false,
      reason: 'external_contact_requires_explicit_consent',
    })
  })

  it('訪客促銷信且有 fallbackEmail、完全沒有同意紀錄：擋下', async () => {
    mockEmailConsentLogFindFirst.mockResolvedValue(null)
    await expect(
      assertEmailConsent(null, 'marketing', 'external@example.com')
    ).resolves.toEqual({
      allowed: false,
      reason: 'external_contact_requires_explicit_consent',
    })
  })
})
