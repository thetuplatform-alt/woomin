const mockUserFindUnique = jest.fn()
const mockUserCreate = jest.fn()
const mockHeaders = jest.fn()

jest.mock('next/headers', () => ({ headers: mockHeaders }))
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn(async () => 'hashed-password') },
}))
jest.mock('@/lib/auth', () => ({ signIn: jest.fn() }))
jest.mock('next-auth', () => ({
  AuthError: class AuthError extends Error {},
}))
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  RATE_LIMIT_CONFIGS: {},
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
  },
}))
jest.mock('@/lib/posthog-server', () => ({
  getPostHogClient: jest.fn(async () => null),
  flushPostHogInBackground: jest.fn(),
}))

import { registerUser } from '@/lib/actions/auth'
import {
  GENERAL_EMAIL_CONSENT_VERSION,
  MARKETING_EMAIL_CONSENT_VERSION,
} from '@/lib/email-consent'

function registrationForm(consents: { general?: boolean; marketing?: boolean } = {}) {
  const form = new FormData()
  form.set('name', 'Local Consent Test')
  form.set('email', 'local-consent@example.test')
  form.set('password', 'test-password-123')
  form.set('confirmPassword', 'test-password-123')
  if (consents.general) form.set('generalEmailConsent', 'on')
  if (consents.marketing) form.set('marketingConsent', 'on')
  return form
}

describe('register versioned email consent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUnique.mockResolvedValue(null)
    mockUserCreate.mockResolvedValue({ id: 'local_user_1' })
    mockHeaders.mockResolvedValue(
      new Headers({ 'x-forwarded-for': '127.0.0.1' })
    )
  })

  it('records current versions for General and Marketing grants', async () => {
    await expect(
      registerUser(undefined, registrationForm({ general: true, marketing: true }))
    ).resolves.toEqual({ success: true })

    const data = mockUserCreate.mock.calls[0][0].data
    expect(data.emailConsentLogs.create).toEqual([
      expect.objectContaining({
        consentType: 'GENERAL',
        action: 'GRANTED',
        source: 'register',
        ip: '127.0.0.1',
        termsVersion: GENERAL_EMAIL_CONSENT_VERSION,
      }),
      expect.objectContaining({
        consentType: 'MARKETING',
        action: 'GRANTED',
        source: 'register',
        ip: '127.0.0.1',
        termsVersion: MARKETING_EMAIL_CONSENT_VERSION,
      }),
    ])
  })

  it('does not block registration when both optional choices are unchecked', async () => {
    await expect(registerUser(undefined, registrationForm())).resolves.toEqual({ success: true })

    const data = mockUserCreate.mock.calls[0][0].data
    expect(data.generalEmailConsent).toBe(false)
    expect(data.marketingConsent).toBe(false)
    expect(data.emailConsentLogs.create).toEqual([
      expect.objectContaining({
        consentType: 'GENERAL',
        action: 'REVOKED',
        termsVersion: GENERAL_EMAIL_CONSENT_VERSION,
      }),
      expect.objectContaining({
        consentType: 'MARKETING',
        action: 'REVOKED',
        termsVersion: MARKETING_EMAIL_CONSENT_VERSION,
      }),
    ])
  })
})
