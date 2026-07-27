import { reconcileRefundedOrderAccess } from '@/lib/purchase/refund-access'

describe('reconcileRefundedOrderAccess', () => {
  function createTx() {
    return {
      bundle: {
        findUnique: jest.fn().mockResolvedValue({
          courses: [{ courseId: 'course_a' }, { courseId: 'course_b' }],
        }),
      },
      course: {
        findUnique: jest.fn().mockResolvedValue({
          accessType: 'LIFETIME',
          accessDurationDays: null,
          accessExpiresAt: null,
        }),
      },
      order: {
        findMany: jest.fn(async (args) => {
          const where = args.where
          const directCourseId = where.courseId
          const bundleCourseId = where.bundle?.is?.courses?.some?.courseId

          if (directCourseId === 'course_a') {
            return [
              {
                id: 'order_single_a',
                courseId: 'course_a',
                bundleId: null,
                paidAt: new Date('2026-01-01T00:00:00Z'),
                createdAt: new Date('2026-01-01T00:00:00Z'),
              },
            ]
          }

          if (bundleCourseId === 'course_a' || directCourseId === 'course_b' || bundleCourseId === 'course_b') {
            return []
          }

          return []
        }),
      },
      purchase: {
        findMany: jest.fn().mockResolvedValue([
          { courseId: 'course_a' },
          { courseId: 'course_b' },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
  }

  it('keeps course access when another paid order still supports the course', async () => {
    const tx = createTx()
    const now = new Date('2026-07-01T00:00:00Z')

    await reconcileRefundedOrderAccess({
      tx: tx as never,
      order: {
        id: 'order_bundle',
        userId: 'user_1',
        courseId: null,
        bundleId: 'bundle_1',
      },
      now,
    })

    expect(tx.purchase.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        courseId: 'course_a',
        orderId: 'order_bundle',
        revokedAt: null,
      },
      data: {
        orderId: 'order_single_a',
        source: 'PAID',
        bundleId: null,
        expiresAt: null,
        revokedAt: null,
      },
    })
  })

  it('revokes course access when no other active paid order supports it', async () => {
    const tx = createTx()
    const now = new Date('2026-07-01T00:00:00Z')

    await reconcileRefundedOrderAccess({
      tx: tx as never,
      order: {
        id: 'order_bundle',
        userId: 'user_1',
        courseId: null,
        bundleId: 'bundle_1',
      },
      now,
    })

    expect(tx.purchase.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        courseId: 'course_b',
        orderId: 'order_bundle',
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    })
  })
})
