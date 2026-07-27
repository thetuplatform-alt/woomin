// __tests__/subscription/webhook-idempotency.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 2.5 / specs/subscription-billing/spec.md
// 「webhook and recurring-notification processing is idempotent」。
//
// 這是 v1.8.0 才新增的訂閱制功能，目前 repo 完全沒有對應模組
// （lib/payment/webhook-events.ts 不存在，prisma/schema.prisma 也還沒有
// PaymentWebhookEvent / SubscriptionOutbox / CourseSubscription 等 model）。
//
// 這份測試的目標介面（claimWebhookEvent / completeWebhookEvent）不是憑空
// 猜測：對照官方 v1.8.0 下載包（~/Downloads/realms-course-platform-v1.8.0.zip）
// 的 lib/payment/webhook-events.ts 與
// prisma/migrations/20260715120000_harden_subscription_payments/migration.sql
// 得出，確保任務 3.x 合併完成後這份測試不需要跟著改介面就能直接轉綠燈。
// 語意（唯讀）：
// - PaymentWebhookEvent 表以 (gateway, eventId) 唯一鍵防重複；
// - claimWebhookEvent() 回傳 'PROCESS'（可安全處理）/ 'DUPLICATE'（已處理過，
//   略過）/ 'IN_PROGRESS'（其他 worker 正在處理中，租約未過期）；
// - completeWebhookEvent() 在成功處理後把狀態轉為 PROCESSED。
//
// 預期本檔案在合併發生前會因為「找不到模組 @/lib/payment/webhook-events」
// 直接編譯失敗（紅燈），這是刻意且預期中的行為。

import { prisma } from '@/lib/prisma'
import { claimWebhookEvent, completeWebhookEvent } from '@/lib/payment/webhook-events'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    paymentWebhookEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

const mockedPrisma = prisma as unknown as {
  paymentWebhookEvent: {
    create: jest.Mock
    findUnique: jest.Mock
    updateMany: jest.Mock
  }
}

function uniqueConstraintViolation(): Error & { code: string } {
  const error = new Error('Unique constraint failed on the fields: (`gateway`,`eventId`)') as Error & {
    code: string
  }
  error.code = 'P2002'
  return error
}

describe('claimWebhookEvent：Stripe webhook / PAYUNi 定期定額通知冪等處理', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('事件第一次送達：建立紀錄成功，回傳 PROCESS，呼叫端可安全建立訂閱訂單', async () => {
    mockedPrisma.paymentWebhookEvent.create.mockResolvedValue({ id: 'pwe_1' })

    const outcome = await claimWebhookEvent({
      gateway: 'stripe',
      eventId: 'evt_123',
      eventType: 'invoice.paid',
    })

    expect(outcome).toBe('PROCESS')
    expect(mockedPrisma.paymentWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gateway: 'stripe', eventId: 'evt_123' }),
      })
    )
  })

  it('同一個 Stripe 事件（evt_123）已成功處理過，重送時回傳 DUPLICATE，不得再建立第二筆訂閱訂單', async () => {
    mockedPrisma.paymentWebhookEvent.create.mockRejectedValue(uniqueConstraintViolation())
    mockedPrisma.paymentWebhookEvent.findUnique.mockResolvedValue({
      status: 'PROCESSED',
      updatedAt: new Date(),
    })

    const outcome = await claimWebhookEvent({
      gateway: 'stripe',
      eventId: 'evt_123',
      eventType: 'invoice.paid',
    })

    expect(outcome).toBe('DUPLICATE')
    // 已處理完成 → 不應該再去搶佔/重新標記這筆紀錄。
    expect(mockedPrisma.paymentWebhookEvent.updateMany).not.toHaveBeenCalled()
  })

  it('PAYUNi 定期定額通知處理逾時、租約尚未過期：回傳 IN_PROGRESS，避免與另一個處理中的請求重複扣款/重複授權', async () => {
    mockedPrisma.paymentWebhookEvent.create.mockRejectedValue(uniqueConstraintViolation())
    mockedPrisma.paymentWebhookEvent.findUnique.mockResolvedValue({
      status: 'PROCESSING',
      updatedAt: new Date(), // 剛開始處理，租約未過期
    })
    mockedPrisma.paymentWebhookEvent.updateMany.mockResolvedValue({ count: 0 })

    const outcome = await claimWebhookEvent({
      gateway: 'payuni',
      eventId: 'period_evt_456',
      eventType: 'period-notify',
    })

    expect(outcome).toBe('IN_PROGRESS')
  })

  it('PAYUNi 定期定額通知處理逾時、租約已過期：回傳 PROCESS 讓重試從一致狀態接手，不會重複建立訂單', async () => {
    mockedPrisma.paymentWebhookEvent.create.mockRejectedValue(uniqueConstraintViolation())
    mockedPrisma.paymentWebhookEvent.findUnique.mockResolvedValue({
      status: 'PROCESSING',
      updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 分鐘前，早已逾期
    })
    mockedPrisma.paymentWebhookEvent.updateMany.mockResolvedValue({ count: 1 })

    const outcome = await claimWebhookEvent({
      gateway: 'payuni',
      eventId: 'period_evt_456',
      eventType: 'period-notify',
    })

    expect(outcome).toBe('PROCESS')
  })

  it('completeWebhookEvent 把處理中的事件標記為 PROCESSED，之後重送才會被判定為 DUPLICATE', async () => {
    mockedPrisma.paymentWebhookEvent.updateMany.mockResolvedValue({ count: 1 })

    await completeWebhookEvent('stripe', 'evt_123')

    expect(mockedPrisma.paymentWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: { gateway: 'stripe', eventId: 'evt_123', status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'PROCESSED' }),
    })
  })
})
