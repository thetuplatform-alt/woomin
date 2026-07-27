const mockFindUnique = jest.fn()
const mockFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
    },
  },
}))

import {
  clearTransportCache,
  getEmailTransport,
  isEmailServiceConfigured,
} from '@/lib/email-transport'

describe('email transport', () => {
  beforeEach(() => {
    clearTransportCache()
    mockFindUnique.mockReset()
    mockFindMany.mockReset()
    delete process.env.TOSEND_API_KEY
    delete process.env.TOSEND_API_BASE_URL
    delete process.env.EMAIL_PROVIDER
    delete process.env.ZSEND_API_KEY
    delete process.env.RESEND_API_KEY
    delete process.env.SMTP_HOST
    global.fetch = jest.fn()
  })

  it('uses ToSend API when provider is tosend', async () => {
    mockFindUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'email_provider') {
        return Promise.resolve({ value: 'tosend' })
      }
      if (where.key === 'tosend_api_key') {
        return Promise.resolve({ value: 'tsend_test_key' })
      }
      return Promise.resolve(null)
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: 'msg_123' }),
    })

    const transport = await getEmailTransport()
    const result = await transport?.send({
      from: 'Aiver <fish@aiver.me>',
      to: ['student@example.com'],
      subject: '測試信',
      html: '<p>Hello</p>',
      text: 'Hello',
    })

    expect(result).toEqual({ messageId: 'msg_123' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.tosend.com/v2/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tsend_test_key',
        },
      })
    )

    const request = (global.fetch as jest.Mock).mock.calls[0][1] as { body: string }
    expect(JSON.parse(request.body)).toEqual({
      from: { name: 'Aiver', email: 'fish@aiver.me' },
      to: [{ email: 'student@example.com' }],
      subject: '測試信',
      html: '<p>Hello</p>',
      text: 'Hello',
    })
  })

  it('treats ToSend env key as configured', async () => {
    process.env.TOSEND_API_KEY = 'tsend_env_key'
    mockFindUnique.mockResolvedValue(null)

    await expect(isEmailServiceConfigured()).resolves.toBe(true)
  })

  it('uses ToSend when EMAIL_PROVIDER is set in env', async () => {
    process.env.EMAIL_PROVIDER = 'tosend'
    process.env.TOSEND_API_KEY = 'tsend_env_key'
    mockFindUnique.mockResolvedValue(null)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: 'msg_env' }),
    })

    const transport = await getEmailTransport()
    const result = await transport?.send({
      from: 'fish@aiver.me',
      to: ['student@example.com'],
      subject: '測試信',
      html: '<p>Hello</p>',
    })

    expect(result).toEqual({ messageId: 'msg_env' })
    expect(global.fetch).toHaveBeenCalled()
  })
})
