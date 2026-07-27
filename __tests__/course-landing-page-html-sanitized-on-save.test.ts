// __tests__/course-landing-page-html-sanitized-on-save.test.ts
//
// 對應 fix-critical-xss-and-assignment-upload change 的 task 2.2：
// lib/actions/courses.ts 儲存 landingPageHtml 的三個寫入點（建立 createCourse、
// 更新 updateCourse、發布 updateCourseDetails）都必須在寫入資料庫前呼叫
// sanitizeLandingPageHtml() 清理過。
//
// 第一個 it 直接呼叫 createCourse 驗證行為（實際跑一次，確認資料庫寫入的
// landingPageHtml 已被清理，而不只是「有 import」）；第二個 it 用原始碼比對
// 確認 updateCourse／updateCourseDetails 的另外兩個寫入點也套用了同一個清理
// 函式（三處呼叫點寫法完全相同，不需要各自重複整套 mock）。

import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, isInstructorRole } from '@/lib/require-admin'
import { getActiveGatewayType } from '@/lib/payment/gateway-factory'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    course: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    courseInstructor: { create: jest.fn() },
    adminLog: { create: jest.fn() },
  },
}))

jest.mock('@/lib/require-admin', () => ({
  requireAdminAuth: jest.fn(),
  isInstructorRole: jest.fn(() => false),
}))

jest.mock('@/lib/course-permissions', () => ({
  manageableCourseWhereForUser: jest.fn(),
  requireCourseManageAccess: jest.fn(),
}))

jest.mock('@/lib/stripe', () => ({
  syncCourseToStripe: jest.fn(),
  archiveCourseStripeResources: jest.fn(),
}))

jest.mock('@/lib/payment/gateway-factory', () => ({
  getActiveGatewayType: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { createCourse } from '@/lib/actions/courses'

describe('課程銷售頁 HTML 儲存前清理', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireAdminAuth as jest.Mock).mockResolvedValue({ id: 'admin_1', role: 'ADMIN' })
    ;(isInstructorRole as unknown as jest.Mock).mockReturnValue(false)
    ;(getActiveGatewayType as jest.Mock).mockResolvedValue('shopline')
    ;(prisma.course.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.course.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'course_1',
      ...data,
    }))
    ;(prisma.adminLog.create as jest.Mock).mockResolvedValue({ id: 'log_1' })
  })

  it('createCourse：資料庫寫入的 landingPageHtml 已移除 <script>，保留安全內容', async () => {
    const result = await createCourse({
      title: '測試課程',
      slug: 'test-course',
      price: 1000,
      status: 'DRAFT',
      landingPageMode: 'html',
      landingPageHtml: '<div>安全內容</div><script>alert(document.cookie)</script>',
    } as never)

    expect(result.success).toBe(true)
    expect(prisma.course.create).toHaveBeenCalledTimes(1)

    const createCall = (prisma.course.create as jest.Mock).mock.calls[0][0]
    const savedHtml = createCall.data.landingPageHtml as string

    expect(savedHtml).not.toContain('<script')
    expect(savedHtml).not.toContain('alert(document.cookie)')
    expect(savedHtml).toContain('安全內容')
  })

  it('updateCourse／updateCourseDetails 的寫入點也套用同一個清理函式（原始碼比對）', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/actions/courses.ts'),
      'utf8'
    )

    expect(source).toContain(
      "import { sanitizeLandingPageHtml } from '@/lib/utils/sanitize-landing-page-html'"
    )

    const occurrences = source.match(
      /landingPageHtml:\s*validatedData\.landingPageHtml\s*\?\s*sanitizeLandingPageHtml\(validatedData\.landingPageHtml\)\s*:\s*null,/g
    )
    expect(occurrences).toHaveLength(3)
  })
})
