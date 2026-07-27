import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  purchaseConfirmationTemplate,
  passwordResetTemplate,
  guestActivationTemplate,
  testEmailTemplate,
  expirationReminderTemplate,
  expiredNoticeTemplate,
  accessExtendedTemplate,
} from '@/lib/email-templates'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { resolveAppUrl } from '@/lib/app-url'
import { resolveAssetUrl } from '@/lib/asset-url'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '未授權存取' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'purchase'

  const [siteName, siteLogo] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: SETTING_KEYS.SITE_NAME } }),
    prisma.siteSetting.findUnique({ where: { key: SETTING_KEYS.SITE_LOGO } }),
  ])

  const appUrl = await resolveAppUrl({ headers: new Headers(request.headers) })
  const branding = {
    siteName: siteName?.value || 'WooMin',
    siteLogo: resolveAssetUrl(siteLogo?.value, appUrl) || `${appUrl}/icon.png`,
  }

  let html = ''

  if (type === 'purchase') {
    html = purchaseConfirmationTemplate(
      {
        userName: '測試學員',
        courseName: '示範課程',
        orderNo: 'TEST-ORDER-001',
        amount: 1990,
      },
      branding
    )
  } else if (type === 'passwordReset') {
    html = passwordResetTemplate(
      {
        userName: '測試學員',
        resetUrl: `${appUrl}/reset-password?token=preview-token`,
      },
      branding
    )
  } else if (type === 'guestActivation') {
    html = guestActivationTemplate(
      {
        userName: '測試學員',
        activationUrl: `${appUrl}/activate-account?token=preview-token`,
      },
      branding
    )
  } else if (type === 'expirationReminder') {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    html = expirationReminderTemplate(
      {
        userName: '測試學員',
        courseName: '示範課程',
        courseUrl: `${appUrl}/courses/demo`,
        daysRemaining: 7,
        expiresAt,
        renewUrl: `${appUrl}/courses/demo`,
      },
      branding
    )
  } else if (type === 'expiredNotice') {
    html = expiredNoticeTemplate(
      {
        userName: '測試學員',
        courseName: '示範課程',
        renewUrl: `${appUrl}/courses/demo`,
        expiredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      branding
    )
  } else if (type === 'accessExtended') {
    html = accessExtendedTemplate(
      {
        userName: '測試學員',
        courseName: '示範課程',
        courseUrl: `${appUrl}/courses/demo`,
        previousExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        newExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        reason: 'extended',
        note: '客服補償',
      },
      branding
    )
  } else {
    html = testEmailTemplate(branding)
  }

  return NextResponse.json({ success: true, html })
}
