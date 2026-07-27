// __tests__/assignment-upload-local-storage-key.test.ts
//
// 對應 fix-critical-xss-and-assignment-upload change 的 task 3.2：
// 本地儲存模式下，作業附件直傳 API（POST /api/assignment/upload，
// multipart 路徑）組出的 storage key 是
// `assignments/{assignmentId}/{userId}/{timestamp}-{filename}`，
// 不符合 lib/storage.ts 的 assertValidLocalStorageKey 要求的
// `media/` 開頭、單層安全字元格式（/^media\/[A-Za-z0-9][A-Za-z0-9._-]*$/），
// 導致 writeLocalUpload 內部驗證一律拋出「Invalid storage key」、
// 上傳一律失敗。
//
// 不 mock lib/storage，讓真正的 assertValidLocalStorageKey／
// writeLocalUpload／getPublicUrlForStorageKey 跑過一次，只 mock 掉
// 檔案系統（fs.mkdir／fs.writeFile）避免真的寫磁碟。這樣測試才真的
// 踩到 bug 的根因（key 格式），不是只測 mock 行為。

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/assignment/upload/route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStorageKeyFromUrl } from '@/lib/storage'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    assignment: { findUnique: jest.fn() },
    purchase: { findUnique: jest.fn() },
    siteSetting: { findUnique: jest.fn(), findMany: jest.fn() },
    assignmentAttachment: { aggregate: jest.fn(), create: jest.fn() },
    assignmentSubmission: { findFirst: jest.fn(), create: jest.fn() },
    media: { create: jest.fn() },
  },
}))

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    statfs: jest.fn(),
  },
}))

function buildAssignment() {
  return {
    id: 'assignment_1',
    maxImages: null,
    maxImageSize: null,
    maxFiles: null,
    maxFileSize: null,
    allowedExtensions: null,
    lesson: {
      id: 'lesson_1',
      title: '單元一',
      chapter: {
        title: '章節一',
        courseId: 'course_1',
        course: { title: '測試課程' },
      },
    },
  }
}

function buildUploadRequest() {
  const formData = new FormData()
  formData.set(
    'file',
    new File(['hello world'], 'note.txt', { type: 'text/plain' })
  )
  formData.set('assignmentId', 'assignment_1')
  formData.set('fileType', 'file')

  return new NextRequest('https://realms.test/api/assignment/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('作業附件本地儲存上傳（POST /api/assignment/upload）', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user_1' } })
    ;(prisma.assignment.findUnique as jest.Mock).mockResolvedValue(buildAssignment())
    ;(prisma.purchase.findUnique as jest.Mock).mockResolvedValue({
      revokedAt: null,
      expiresAt: null,
    })
    ;(prisma.siteSetting.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.siteSetting.findMany as jest.Mock).mockResolvedValue([
      { key: 'storage_driver', value: 'local' },
      { key: 'local_storage_root', value: '/tmp/realms-test-uploads' },
    ])
    ;(prisma.assignmentAttachment.aggregate as jest.Mock).mockResolvedValue({
      _sum: { size: 0 },
    })
    ;(prisma.assignmentSubmission.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.assignmentSubmission.create as jest.Mock).mockResolvedValue({
      id: 'submission_1',
    })
    ;(prisma.assignmentAttachment.create as jest.Mock).mockImplementation(
      async ({ data }) => ({ id: 'attachment_1', ...data })
    )
    ;(prisma.media.create as jest.Mock).mockResolvedValue({ id: 'media_1' })
  })

  it('本地儲存模式下，直傳作業附件成功，storage key 符合 media/ 格式', async () => {
    const response = await POST(buildUploadRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.storageKey).toMatch(/^media\/[A-Za-z0-9][A-Za-z0-9._-]*$/)
    expect(body.data.url).toMatch(/^\/uploads\/media\//)
  })

  it('上傳成功後的 URL 可解析回原本的 storage key（附件可正常存取）', async () => {
    const response = await POST(buildUploadRequest())
    const body = await response.json()

    const resolvedKey = await getStorageKeyFromUrl(body.data.url)
    expect(resolvedKey).toBe(body.data.storageKey)
  })
})
