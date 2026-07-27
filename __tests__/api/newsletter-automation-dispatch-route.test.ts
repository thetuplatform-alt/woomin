import { GET } from '@/app/api/cron/newsletter-automation-dispatch/route'
import { processPendingAutomationDeliveries } from '@/lib/newsletter/automation/delivery-service'

jest.mock('@/lib/newsletter/automation/delivery-service', () => ({
  processPendingAutomationDeliveries: jest.fn(),
}), { virtual: true })

describe('newsletter automation dispatch cron route', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.resetAllMocks()
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    })
    process.env.CRON_SECRET = 'cron_secret_123'
  })

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      configurable: true,
    })
    delete process.env.CRON_SECRET
  })

  it('rejects missing authorization without processing deliveries', async () => {
    const response = await GET(
      new Request('https://realms.test/api/cron/newsletter-automation-dispatch')
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(processPendingAutomationDeliveries).not.toHaveBeenCalled()
  })

  it('returns delivery outcome counts when authorized', async () => {
    ;(processPendingAutomationDeliveries as jest.Mock).mockResolvedValue({
      selected: 2,
      claimed: 2,
      sent: 1,
      failed: 0,
      skipped: 1,
      unclaimed: 0,
    })

    const response = await GET(
      new Request('https://realms.test/api/cron/newsletter-automation-dispatch', {
        headers: { authorization: 'Bearer cron_secret_123' },
      })
    )

    await expect(response.json()).resolves.toEqual({
      selected: 2,
      claimed: 2,
      sent: 1,
      failed: 0,
      skipped: 1,
      unclaimed: 0,
    })
    expect(response.status).toBe(200)
  })
})
