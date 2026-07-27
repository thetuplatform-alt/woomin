import { GET } from '@/app/api/cron/assignment-cleanup/route'
import { prisma } from '@/lib/prisma'
import { deleteStorageObject } from '@/lib/storage'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    assignment: {
      findMany: jest.fn(),
    },
    media: {
      deleteMany: jest.fn(),
    },
    assignmentAttachment: {
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/storage', () => ({
  deleteStorageObject: jest.fn(),
}))

describe('assignment cleanup cron route', () => {
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

  it('rejects missing authorization without reading assignments', async () => {
    const response = await GET(
      new Request('https://realms.test/api/cron/assignment-cleanup')
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(prisma.assignment.findMany).not.toHaveBeenCalled()
  })

  it('rejects wrong authorization without deleting storage objects', async () => {
    const response = await GET(
      new Request('https://realms.test/api/cron/assignment-cleanup', {
        headers: { authorization: 'Bearer wrong' },
      })
    )

    expect(response.status).toBe(401)
    expect(deleteStorageObject).not.toHaveBeenCalled()
  })

  it('cleans approved stale attachments when authorized', async () => {
    ;(prisma.assignment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'assignment_1',
        autoCleanupDays: 1,
        submissions: [
          {
            id: 'submission_1',
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            attachments: [
              {
                id: 'attachment_1',
                storageKey: 'media/attachment.pdf',
                storageDriver: 'local',
              },
            ],
          },
        ],
      },
    ])
    ;(deleteStorageObject as jest.Mock).mockResolvedValue({ success: true })
    ;(prisma.media.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.assignmentAttachment.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

    const response = await GET(
      new Request('https://realms.test/api/cron/assignment-cleanup', {
        headers: { authorization: 'Bearer cron_secret_123' },
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      deletedAttachments: 1,
    })
    expect(deleteStorageObject).toHaveBeenCalledWith('media/attachment.pdf', 'local')
  })
})
