import fs from 'fs'
import path from 'path'
import { createOrderSchema } from '@/lib/validations/checkout'
import {
  GENERAL_EMAIL_CONSENT_TEXT,
  GENERAL_EMAIL_CONSENT_VERSION,
  MARKETING_EMAIL_CONSENT_TEXT,
  MARKETING_EMAIL_CONSENT_VERSION,
  REQUIRED_SERVICE_NOTICE_TEXT,
} from '@/lib/email-consent'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const validCheckout = {
  courseId: 'course_1',
  email: 'buyer@example.com',
  name: 'Local Buyer',
  phone: '0912345678',
  country: 'TW',
  paymentMethod: 'CREDIT',
  agreedTerms: true,
}

describe('minimum consent safety contracts', () => {
  it('uses immutable BestAppStore consent versions and full copy', () => {
    expect(GENERAL_EMAIL_CONSENT_VERSION).toBe('GENERAL_EMAIL_V1_202609')
    expect(MARKETING_EMAIL_CONSENT_VERSION).toBe('MARKETING_EMAIL_V1_202609')
    expect(GENERAL_EMAIL_CONSENT_TEXT).toContain('不影響註冊、購買或既有服務使用')
    expect(MARKETING_EMAIL_CONSENT_TEXT).toContain('不影響註冊、購買或既有服務使用')
    expect(REQUIRED_SERVICE_NOTICE_TEXT).toContain('不屬於行銷訂閱')
  })

  it('rejects checkout when agreedTerms is false', () => {
    expect(createOrderSchema.safeParse({ ...validCheckout, agreedTerms: false }).success).toBe(false)
  })

  it('rejects checkout when agreedTerms is missing', () => {
    const input: Partial<typeof validCheckout> = { ...validCheckout }
    delete input.agreedTerms
    expect(createOrderSchema.safeParse(input).success).toBe(false)
  })

  it('allows checkout validation to continue when agreedTerms is true', () => {
    expect(createOrderSchema.safeParse(validCheckout).success).toBe(true)
  })

  it('sends agreedTerms and hides ineffective email options for subscriptions', () => {
    const source = read('app/(main)/checkout/checkout-client.tsx')
    expect(source).toContain('agreedTerms,')
    expect(source).toContain('!isSubscription && (')
  })

  it('writes consent versions from register and checkout paths', () => {
    expect(read('lib/actions/auth.ts')).toContain('termsVersion: GENERAL_EMAIL_CONSENT_VERSION')
    const payment = read('app/api/payment/create/route.ts')
    expect(payment).toContain('termsVersion: GENERAL_EMAIL_CONSENT_VERSION')
    expect(payment).toContain('termsVersion: MARKETING_EMAIL_CONSENT_VERSION')
  })

  it('version-gates general and marketing campaigns', () => {
    expect(read('lib/newsletter/audience.ts')).toContain('assertBestAppStoreEmailConsent')
    expect(read('lib/newsletter/send.ts')).toContain('assertBestAppStoreEmailConsent')
  })
})
