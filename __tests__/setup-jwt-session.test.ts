jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(async () => ({ user: { id: 'user-1' } })),
  unstable_update: jest.fn(async () => null),
}))

jest.mock('@/lib/prisma', () => {
  const transactionClient = {
    user: {
      count: jest.fn(async () => 0),
      update: jest.fn(async () => undefined),
    },
  }

  return {
    prisma: {
      $transaction: jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient)),
      siteSetting: {
        upsert: jest.fn(async () => undefined),
      },
      adminLog: {
        create: jest.fn(async () => undefined),
      },
    },
  }
})

jest.mock('@/lib/cloudflare-stream-config', () => ({
  clearCloudflareStreamConfigCache: jest.fn(),
  getCloudflareStreamConfig: jest.fn(async () => ({
    accountId: '',
    apiToken: '',
    customerCode: '',
    signingSecret: '',
    webhookSecret: '',
  })),
}))

import { unstable_update } from '@/lib/auth'
import { completeSetup } from '@/lib/actions/setup'

const setupData = {
  videoProvider: 'youtube' as const,
  storageDriver: 'local' as const,
  localStorageRoot: '/data/uploads',
  emailMode: 'skip' as const,
  googleMode: 'skip' as const,
  appleMode: 'skip' as const,
}

describe('completeSetup session refresh', () => {
  it('refreshes the admin JWT from the server action', async () => {
    const result = await completeSetup(setupData)

    expect(result).toEqual({ success: true })
    expect(unstable_update).toHaveBeenCalledWith({ user: { role: 'ADMIN' } })
  })

  it('session 更新失敗時仍回傳 success', async () => {
    jest.mocked(unstable_update).mockRejectedValueOnce(new Error('session error'))

    const result = await completeSetup(setupData)

    expect(result).toEqual({ success: true })
  })
})
