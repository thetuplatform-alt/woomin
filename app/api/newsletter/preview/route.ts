import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/require-admin'
import { getNewsletter } from '@/lib/actions/newsletters'
import { getNewsletterSettings } from '@/lib/newsletter/settings'
import { createUnsubscribeToken } from '@/lib/newsletter/consent'
import { normalizeNewsletterContent, renderCampaignHtml } from '@/lib/newsletter/render'

function errorHtml(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#334155}.box{max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:24px}h1{font-size:18px;color:#0f172a;margin:0 0 8px}p{font-size:14px;line-height:1.7;margin:0}</style></head><body><div class="box"><h1>無法顯示預覽</h1><p>${message}</p></div></body></html>`
}

export async function GET(request: Request) {
  try {
    await requireAdminAuth()
  } catch {
    return new NextResponse(errorHtml('請先登入後台，再重新開啟電子報預覽。'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return new NextResponse(errorHtml('缺少電子報 ID。'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const [campaign, settings] = await Promise.all([getNewsletter(id), getNewsletterSettings()]).catch(() => [null, null] as const)
  if (!campaign || !settings) {
    return new NextResponse(errorHtml('找不到這封電子報，或目前帳號沒有權限檢視。'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const previewToken = (() => {
    try {
      return createUnsubscribeToken({
        userId: campaign.createdById,
        email: 'preview@example.com',
        scope: campaign.type === 'PROMO' ? 'marketing' : 'general',
      })
    } catch {
      return 'preview-token-unavailable'
    }
  })()
  const unsubscribeUrl = `${settings.appUrl}/unsubscribe?email=preview@example.com&token=${previewToken}`
  const html = renderCampaignHtml(normalizeNewsletterContent(campaign.contentJson), {
    type: campaign.type,
    subject: campaign.subject,
    preheader: campaign.preheader,
    siteName: settings.siteName,
    siteLogo: settings.siteLogo,
    appUrl: settings.appUrl,
    footerName: settings.footerName || settings.siteName,
    footerAddress: settings.footerAddress,
    footerEmail: settings.footerEmail,
    unsubscribeUrl,
    recipientName: '同學',
    mode: 'preview',
  })

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'",
    },
  })
}
