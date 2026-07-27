// lib/payment/coupon-redemption.ts
// 付款成功後記錄優惠券兌換的共用邏輯（供四個付款成功路徑共用：
// 零元訂單、Stripe webhook、PAYUNi notify、Shopline webhook）。
//
// 這裡刻意「不是」Server Action（不加 'use server'），因為需要接收交易客戶端（tx）。

import { Prisma } from '@prisma/client'

/**
 * 在付款成功的交易中記錄一次優惠券兌換，並原子且不超過上限地遞增使用次數。
 *
 * 修正重點（M9）：
 * - 冪等：CouponRedemption.orderId 為 @unique，webhook 重送 / 重複處理時不會重複建立、不會重複計數。
 * - 上限原子化：以 `timesRedeemed < maxRedemptions` 作為條件式 updateMany 的守衛，
 *   即使在競態下，DB 的 timesRedeemed 也永遠不會超過 maxRedemptions。
 */
export async function recordCouponRedemption(
  tx: Prisma.TransactionClient,
  params: { couponId: string; userId: string; orderId: string; amount: number; campaignId?: string | null }
): Promise<void> {
  // 1. 建立兌換紀錄（orderId @unique 提供冪等保護）
  try {
    await tx.couponRedemption.create({
      data: {
        couponId: params.couponId,
        userId: params.userId,
        orderId: params.orderId,
        campaignId: params.campaignId || null,
        amount: params.amount,
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // 此訂單的兌換已記錄過（webhook 重送）→ 不重複計數，直接結束
      return
    }
    throw e
  }

  // 2. 原子遞增使用次數（不超過 maxRedemptions）
  const coupon = await tx.coupon.findUnique({
    where: { id: params.couponId },
    select: { maxRedemptions: true },
  })
  if (!coupon) return

  if (coupon.maxRedemptions && coupon.maxRedemptions > 0) {
    // 條件式更新：只有在尚未達上限時才 +1，避免併發超賣
    const result = await tx.coupon.updateMany({
      where: { id: params.couponId, timesRedeemed: { lt: coupon.maxRedemptions } },
      data: { timesRedeemed: { increment: 1 } },
    })
    if (result.count === 0) {
      // 極端競態：上限已滿但此訂單已付款完成。不再 +1（counter 維持正確），
      // 但留下告警供人工檢視（不影響已付款用戶的開通）。
      console.warn(
        `[Coupon] 優惠券 ${params.couponId} 已達使用上限，但訂單 ${params.orderId} 已付款完成，請人工檢視是否超賣`
      )
    }
  } else {
    // 無上限：直接遞增
    await tx.coupon.update({
      where: { id: params.couponId },
      data: { timesRedeemed: { increment: 1 } },
    })
  }
}
