import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

const emails = {
  student: 'v180-student@example.test',
  guest: 'v180-guest@example.test',
  oauth: 'v180-google@example.test',
  admin: 'v180-admin@example.test',
} as const

const adminPassword = 'V180-Admin-Local-Only!'
const now = new Date()
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

async function main() {
  const adminHash = await bcrypt.hash(adminPassword, 12)

  const users = {
    student: await prisma.user.upsert({
      where: { email: emails.student },
      update: { name: 'v1.8 一般測試帳號', password: null, isGuest: false, role: 'USER' },
      create: { email: emails.student, name: 'v1.8 一般測試帳號', role: 'USER' },
    }),
    guest: await prisma.user.upsert({
      where: { email: emails.guest },
      update: { name: 'v1.8 訪客測試帳號', password: null, isGuest: true, guestSource: 'v180-verification', role: 'USER' },
      create: { email: emails.guest, name: 'v1.8 訪客測試帳號', isGuest: true, guestSource: 'v180-verification' },
    }),
    oauth: await prisma.user.upsert({
      where: { email: emails.oauth },
      update: { name: 'v1.8 Google 測試帳號', password: null, isGuest: false, role: 'USER' },
      create: { email: emails.oauth, name: 'v1.8 Google 測試帳號', role: 'USER' },
    }),
    admin: await prisma.user.upsert({
      where: { email: emails.admin },
      update: { name: 'v1.8 管理員測試帳號', password: adminHash, isGuest: false, role: 'ADMIN' },
      create: { email: emails.admin, name: 'v1.8 管理員測試帳號', password: adminHash, role: 'ADMIN' },
    }),
  }

  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'google', providerAccountId: 'v180-google-account' } },
    update: { userId: users.oauth.id, type: 'oauth' },
    create: { userId: users.oauth.id, type: 'oauth', provider: 'google', providerAccountId: 'v180-google-account' },
  })

  const scenarios = [
    { key: 'stripe-active', title: 'v1.8 驗收｜Stripe 使用中', gateway: 'stripe', status: 'ACTIVE' as const, endDays: 30, accessDays: 37, price: 990 },
    { key: 'payuni-active', title: 'v1.8 驗收｜PAYUNi 使用中', gateway: 'payuni', status: 'ACTIVE' as const, endDays: 30, accessDays: 37, price: 790 },
    { key: 'canceled-current', title: 'v1.8 驗收｜取消但期末仍可看', gateway: 'stripe', status: 'CANCELED' as const, endDays: 14, accessDays: 21, price: 690 },
    { key: 'past-due-grace', title: 'v1.8 驗收｜扣款失敗寬限期', gateway: 'payuni', status: 'PAST_DUE' as const, endDays: 5, accessDays: 12, price: 590 },
    { key: 'canceled-expired', title: 'v1.8 驗收｜已到期收回權限', gateway: 'stripe', status: 'CANCELED' as const, endDays: -10, accessDays: -3, price: 490 },
  ]

  const result: Array<Record<string, unknown>> = []
  for (const item of scenarios) {
    const course = await prisma.course.upsert({
      where: { slug: `v180-verification-${item.key}` },
      update: { title: item.title, status: 'PUBLISHED', salesVisibility: 'PUBLIC', createdById: users.admin.id, price: item.price },
      create: { slug: `v180-verification-${item.key}`, title: item.title, description: '僅供 v1.8.0 本機手動驗收使用。', status: 'PUBLISHED', salesVisibility: 'PUBLIC', createdById: users.admin.id, price: item.price },
    })
    const plan = await prisma.courseSubscriptionPlan.upsert({
      where: { id: `v180-plan-${item.key}` },
      update: { courseId: course.id, label: `${item.gateway} 測試月繳`, type: 'UNLIMITED', interval: 'MONTH', price: item.price, enabled: true },
      create: { id: `v180-plan-${item.key}`, courseId: course.id, label: `${item.gateway} 測試月繳`, type: 'UNLIMITED', interval: 'MONTH', price: item.price },
    })
    const periodEnd = daysFromNow(item.endDays)
    const subscription = await prisma.courseSubscription.upsert({
      where: { id: `v180-sub-${item.key}` },
      update: { userId: users.student.id, courseId: course.id, planId: plan.id, status: item.status, gateway: item.gateway, gatewaySubscriptionId: `v180-${item.gateway}-${item.key}`, gatewayEnvironment: item.gateway === 'stripe' ? 'stripe:test' : 'payuni:sandbox', planType: 'UNLIMITED', interval: 'MONTH', pricePerPeriod: item.price, termEndBehavior: 'GRANT_LIFETIME', paidPeriods: 1, currentPeriodEnd: periodEnd, lastPaymentAt: now, canceledAt: item.status === 'CANCELED' ? now : null, cancelRequestedAt: item.status === 'CANCELED' ? now : null },
      create: { id: `v180-sub-${item.key}`, userId: users.student.id, courseId: course.id, planId: plan.id, status: item.status, gateway: item.gateway, gatewaySubscriptionId: `v180-${item.gateway}-${item.key}`, gatewayEnvironment: item.gateway === 'stripe' ? 'stripe:test' : 'payuni:sandbox', planType: 'UNLIMITED', interval: 'MONTH', pricePerPeriod: item.price, termEndBehavior: 'GRANT_LIFETIME', paidPeriods: 1, currentPeriodEnd: periodEnd, lastPaymentAt: now, canceledAt: item.status === 'CANCELED' ? now : null, cancelRequestedAt: item.status === 'CANCELED' ? now : null },
    })
    const purchase = await prisma.purchase.upsert({
      where: { userId_courseId: { userId: users.student.id, courseId: course.id } },
      update: { orderId: null, source: 'SUBSCRIPTION', expiresAt: daysFromNow(item.accessDays), revokedAt: item.accessDays < 0 ? now : null },
      create: { userId: users.student.id, courseId: course.id, source: 'SUBSCRIPTION', expiresAt: daysFromNow(item.accessDays), revokedAt: item.accessDays < 0 ? now : null },
    })
    result.push({ courseId: course.id, course: course.title, subscriptionId: subscription.id, gateway: item.gateway, status: item.status, purchaseId: purchase.id, accessExpiresAt: purchase.expiresAt?.toISOString(), accessRevoked: !!purchase.revokedAt })
  }

  console.log(JSON.stringify({ emails, adminPassword, oauthProvider: 'google', subscriptions: result }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
