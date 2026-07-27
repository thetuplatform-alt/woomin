import { prisma } from '../lib/prisma'

const userEmail = 'v180-student@example.test'
const courseId = 'cmrw2qd1i00051oz7bh79rhdk' // v180-verification-stripe-active（既有課程，借用即可）

async function upsertOrder(orderNo: string, amount: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } })
  return prisma.order.upsert({
    where: { orderNo },
    update: { status: 'PAID', amount, originalAmount: amount, paidAt: new Date() },
    create: {
      orderNo,
      userId: user.id,
      courseId,
      amount,
      originalAmount: amount,
      status: 'PAID',
      paymentGateway: 'payuni',
      paidAt: new Date(),
    },
  })
}

async function main() {
  // 1. missing：PAID 訂單，完全沒有 Invoice
  const missingOrder = await upsertOrder('RECON-MISSING-001', 690)
  await prisma.invoice.deleteMany({ where: { orderId: missingOrder.id } })

  // 2. stuck：PAID 訂單，Invoice 狀態 FAILED
  const stuckOrder = await upsertOrder('RECON-STUCK-001', 790)
  await prisma.invoice.upsert({
    where: { orderId: stuckOrder.id },
    update: { status: 'FAILED', failReason: '會員載具驗證失敗（測試資料）' },
    create: {
      orderId: stuckOrder.id,
      provider: 'ezpay',
      status: 'FAILED',
      amount: 790,
      failReason: '會員載具驗證失敗（測試資料）',
    },
  })

  // 3. incompleteFields：PAID 訂單，Invoice 狀態 ISSUED 但 invoiceNumber 為 null
  const incompleteOrder = await upsertOrder('RECON-INCOMPLETE-001', 990)
  await prisma.invoice.upsert({
    where: { orderId: incompleteOrder.id },
    update: { status: 'ISSUED', invoiceNumber: null, invoiceDate: null },
    create: {
      orderId: incompleteOrder.id,
      provider: 'ezpay',
      status: 'ISSUED',
      amount: 990,
      invoiceNumber: null,
      invoiceDate: null,
    },
  })

  // 4. 完整 ISSUED：不該出現在任何分類（排除檢查）
  const completeOrder = await upsertOrder('RECON-COMPLETE-001', 590)
  await prisma.invoice.upsert({
    where: { orderId: completeOrder.id },
    update: { status: 'ISSUED', invoiceNumber: 'AB12345678', invoiceDate: new Date() },
    create: {
      orderId: completeOrder.id,
      provider: 'ezpay',
      status: 'ISSUED',
      amount: 590,
      invoiceNumber: 'AB12345678',
      invoiceDate: new Date(),
    },
  })

  // 5. 非 PAID 訂單：不該出現在任何分類（排除檢查）
  const user = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } })
  await prisma.order.upsert({
    where: { orderNo: 'RECON-PENDING-001' },
    update: { status: 'PENDING' },
    create: {
      orderNo: 'RECON-PENDING-001',
      userId: user.id,
      courseId,
      amount: 490,
      originalAmount: 490,
      status: 'PENDING',
      paymentGateway: 'payuni',
    },
  })

  console.log('Seed 完成：missing=%s stuck=%s incompleteFields=%s complete(應排除)=%s pending(應排除)=RECON-PENDING-001',
    'RECON-MISSING-001', 'RECON-STUCK-001', 'RECON-INCOMPLETE-001', 'RECON-COMPLETE-001')
}

main().finally(() => prisma.$disconnect())
