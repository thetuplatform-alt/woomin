import crypto from 'crypto'
import { isInternalAppHost } from '@/lib/app-url'
import { escapeHtml } from '@/lib/email-templates'
import type { NewsletterBlock, NewsletterContent, NewsletterRenderContext } from '@/lib/newsletter/types'

const GENERAL_COLOR = '#6366F1'
const PROMO_COLOR = '#F5A524'
const ACCENT_COLOR = '#10B981'

export const MAX_EMAIL_HTML_BYTES = 102 * 1024

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function sanitizeUrl(raw: string, appUrl?: string): string {
  try {
    const value = raw.trim()
    if (value.startsWith('/')) {
      return appUrl ? new URL(value, appUrl).toString() : value
    }
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'mailto:') {
      return '#'
    }
    if (appUrl && (url.protocol === 'http:' || url.protocol === 'https:') && isInternalAppHost(url.hostname)) {
      return new URL(`${url.pathname}${url.search}${url.hash}`, appUrl).toString()
    }
    return url.toString()
  } catch {
    return '#'
  }
}

export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<form[\s\S]*?>[\s\S]*?<\/form>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\shref\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, ' href="#"')
    .replace(/\ssrc\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, ' src=""')
}

function formatTaipeiDate(input: Date | string | null | undefined): string {
  if (!input) return ''
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function applyMergeTags(value: string, context: NewsletterRenderContext): string {
  const replacements: Record<string, string> = {
    '{{name}}': context.recipientName || '同學',
    '{{學員姓名}}': context.recipientName || '同學',
    '{{course_name}}': context.courseName || '課程',
    '{{課程名稱}}': context.courseName || '課程',
    '{{coupon_code}}': context.couponCode || '',
    '{{優惠碼}}': context.couponCode || '',
    '{{優惠到期時間}}': formatTaipeiDate(context.couponExpiresAt),
    '{{unsubscribeUrl}}': context.unsubscribeUrl,
  }

  let result = value
  for (const [key, replacement] of Object.entries(replacements)) {
    result = result.split(key).join(replacement)
  }
  return result
}

function paragraphHtml(text: string, context: NewsletterRenderContext): string {
  const escaped = escapeHtml(applyMergeTags(text, context))
  return escaped
    .split(/\n{2,}/)
    .map((part) => `<p style="font-size:16px;line-height:${context.type === 'PROMO' ? '1.6' : '1.7'};color:#334155;margin:0 0 18px 0;">${part.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function blockHtml(block: NewsletterBlock, context: NewsletterRenderContext): string {
  const primary = context.type === 'PROMO' ? PROMO_COLOR : GENERAL_COLOR

  switch (block.type) {
    case 'heading':
      return `<h1 style="font-size:28px;line-height:1.3;color:#0F172A;margin:0 0 20px 0;font-weight:700;">${escapeHtml(applyMergeTags(block.text, context))}</h1>`
    case 'paragraph':
      return paragraphHtml(block.text, context)
    case 'quote':
      return `<blockquote style="border-left:4px solid ${primary};margin:24px 0;padding:4px 0 4px 18px;color:#475569;font-size:17px;line-height:1.7;">${paragraphHtml(block.text, context)}${block.cite ? `<p style="font-size:13px;color:#94A3B8;margin:8px 0 0 0;">— ${escapeHtml(block.cite)}</p>` : ''}</blockquote>`
    case 'button': {
      const align = block.align || 'center'
      return `<div style="text-align:${align};margin:26px 0;"><a href="${escapeAttr(sanitizeUrl(block.url, context.appUrl))}" style="display:inline-block;background:${primary};color:#FFFFFF;text-decoration:none;border-radius:8px;padding:${context.type === 'PROMO' ? '16px 32px' : '14px 28px'};font-size:${context.type === 'PROMO' ? '17px' : '16px'};font-weight:700;min-height:20px;">${escapeHtml(applyMergeTags(block.text, context))}</a></div>`
    }
    case 'cta':
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${context.type === 'PROMO' ? '#FFFBEB' : '#EEF2FF'};border:1px solid ${context.type === 'PROMO' ? '#FCD34D' : '#C7D2FE'};border-radius:14px;margin:28px 0;"><tr><td style="padding:22px;text-align:center;"><h2 style="font-size:22px;line-height:1.35;color:#0F172A;margin:0 0 10px 0;">${escapeHtml(applyMergeTags(block.title, context))}</h2>${block.text ? `<p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 18px 0;">${escapeHtml(applyMergeTags(block.text, context))}</p>` : ''}<a href="${escapeAttr(sanitizeUrl(block.url, context.appUrl))}" style="display:inline-block;background:${primary};color:#FFFFFF;text-decoration:none;border-radius:8px;padding:14px 28px;font-size:16px;font-weight:800;">${escapeHtml(applyMergeTags(block.buttonText, context))}</a></td></tr></table>`
    case 'divider':
      return '<hr style="border:none;border-top:1px solid #E2E8F0;margin:28px 0;">'
    case 'image':
      return `<div style="margin:24px 0;"><img src="${escapeAttr(sanitizeUrl(block.url, context.appUrl))}" alt="${escapeAttr(block.alt || '')}" width="552" style="display:block;width:100%;max-width:552px;border-radius:12px;height:auto;"></div>`
    case 'video':
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;margin:24px 0;"><tr><td style="padding:16px;"><p style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#0F172A;">${escapeHtml(block.title)}</p><a href="${escapeAttr(sanitizeUrl(block.url, context.appUrl))}" style="color:${GENERAL_COLOR};font-size:14px;">觀看影片</a></td></tr></table>`
    case 'course':
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #E2E8F0;border-radius:12px;margin:24px 0;background:#FFFFFF;"><tr><td style="padding:18px;">${block.imageUrl ? `<img src="${escapeAttr(sanitizeUrl(block.imageUrl, context.appUrl))}" alt="${escapeAttr(block.title)}" width="516" style="display:block;width:100%;max-width:516px;border-radius:10px;height:auto;margin-bottom:16px;">` : ''}<h2 style="font-size:20px;line-height:1.35;color:#0F172A;margin:0 0 10px 0;">${escapeHtml(block.title)}</h2>${block.priceLabel ? `<p style="font-size:28px;line-height:1.2;color:${ACCENT_COLOR};font-weight:800;margin:0 0 16px 0;">${escapeHtml(block.priceLabel)}</p>` : ''}<a href="${escapeAttr(sanitizeUrl(block.url, context.appUrl))}" style="display:inline-block;background:${PROMO_COLOR};color:#FFFFFF;text-decoration:none;border-radius:8px;padding:15px 28px;font-weight:800;">查看課程</a></td></tr></table>`
    case 'coupon':
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#FFFBEB;border:1px solid #FCD34D;border-radius:12px;margin:24px 0;"><tr><td style="padding:20px;text-align:center;"><p style="margin:0 0 8px 0;color:#92400E;font-size:14px;font-weight:700;">限時優惠碼</p><p style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:1px;background:#FFFFFF;border:1px dashed #F5A524;border-radius:10px;color:#0F172A;font-size:24px;font-weight:800;margin:0 auto 10px auto;padding:12px 18px;display:inline-block;">${escapeHtml(block.code)}</p>${block.description ? `<p style="font-size:14px;color:#92400E;margin:0 0 6px 0;">${escapeHtml(block.description)}</p>` : ''}${block.expiresAt ? `<p style="font-size:13px;color:#64748B;margin:0;">優惠截止：${escapeHtml(formatTaipeiDate(block.expiresAt))}</p>` : ''}</td></tr></table>`
    case 'countdown':
      return `<div style="margin:20px 0;padding:14px 16px;border-radius:10px;background:#FFF7ED;border:1px solid #FDBA74;color:#9A3412;font-size:15px;font-weight:700;text-align:center;">${escapeHtml(block.text || `優惠倒數至 ${formatTaipeiDate(block.expiresAt)}`)}</div>`
    default:
      return ''
  }
}

export function normalizeNewsletterContent(input: unknown): NewsletterContent {
  if (!input || typeof input !== 'object') {
    return { blocks: [] }
  }
  const candidate = input as { blocks?: unknown; meta?: unknown }
  if (!Array.isArray(candidate.blocks)) return { blocks: [] }
  return {
    meta: candidate.meta && typeof candidate.meta === 'object' ? candidate.meta as NewsletterContent['meta'] : undefined,
    blocks: candidate.blocks.filter((block): block is NewsletterBlock => {
      return !!block && typeof block === 'object' && 'type' in block && 'id' in block
    }),
  }
}

export function renderCampaignHtml(
  content: NewsletterContent,
  context: NewsletterRenderContext
): string {
  const primary = context.type === 'PROMO' ? PROMO_COLOR : GENERAL_COLOR
  const preheader = context.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(applyMergeTags(context.preheader, context))}</div>`
    : ''
  const testBanner = context.mode === 'test'
    ? '<div style="background:#FEF3C7;color:#92400E;text-align:center;font-weight:700;font-size:14px;padding:10px 14px;border-radius:10px;margin-bottom:18px;">這是測試信</div>'
    : ''

  const body = content.blocks.map((block) => blockHtml(block, context)).join('')
  const footerReason = context.type === 'PROMO'
    ? '你收到這封信是因為你曾明確同意接收促銷優惠電子報。'
    : '你收到這封信是因為你曾註冊或購買本平台課程。'
  const footerParts = [
    escapeHtml(context.footerName),
    context.footerAddress ? escapeHtml(context.footerAddress) : '',
    `<a href="mailto:${escapeAttr(context.footerEmail)}" style="color:#64748B;">${escapeHtml(context.footerEmail)}</a>`,
  ].filter(Boolean).join('｜')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(context.subject || context.siteName)}</title></head><body style="margin:0;padding:20px;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;">${preheader}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border-collapse:collapse;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;"><tr><td style="padding:28px 24px 10px 24px;text-align:center;">${testBanner}<img src="${escapeAttr(sanitizeUrl(context.siteLogo, context.appUrl))}" width="50" height="50" alt="${escapeAttr(context.siteName)}" style="border-radius:12px;display:inline-block;margin-bottom:10px;"><div style="font-size:16px;font-weight:700;color:#0F172A;">${escapeHtml(context.siteName)}</div><div style="height:4px;width:44px;background:${primary};border-radius:999px;margin:14px auto 0 auto;"></div></td></tr><tr><td style="padding:22px 24px 8px 24px;">${body || paragraphHtml('開始撰寫你的電子報內容。', context)}</td></tr><tr><td style="padding:24px;border-top:1px solid #E2E8F0;color:#64748B;font-size:13px;line-height:1.6;text-align:center;"><p style="margin:0 0 8px 0;">${escapeHtml(footerReason)}</p><p style="margin:0 0 8px 0;">${footerParts}</p><p style="margin:0;"><a href="${escapeAttr(context.unsubscribeUrl)}" style="color:#64748B;text-decoration:underline;font-size:13px;">退訂或更新訂閱偏好</a></p></td></tr></table></td></tr></table></body></html>`

  return sanitizeEmailHtml(html)
}

export function renderBodyText(content: NewsletterContent, context: NewsletterRenderContext): string {
  const lines = content.blocks.flatMap((block) => {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        return [applyMergeTags(block.text, context)]
      case 'button':
        return [`${applyMergeTags(block.text, context)} [${sanitizeUrl(block.url, context.appUrl)}]`]
      case 'cta':
        return [block.title, block.text || '', `${block.buttonText} [${sanitizeUrl(block.url, context.appUrl)}]`].filter(Boolean)
      case 'image':
        return block.alt ? [`[圖片] ${block.alt}`] : []
      case 'video':
        return [`${block.title} [${sanitizeUrl(block.url, context.appUrl)}]`]
      case 'course':
        return [`${block.title}${block.priceLabel ? ` ${block.priceLabel}` : ''} [${sanitizeUrl(block.url, context.appUrl)}]`]
      case 'coupon':
        return [`優惠碼：${block.code}${block.expiresAt ? `，優惠截止：${formatTaipeiDate(block.expiresAt)}` : ''}`]
      case 'countdown':
        return [block.text || `優惠倒數至 ${formatTaipeiDate(block.expiresAt)}`]
      default:
        return []
    }
  })

  return [...lines, '', `退訂或更新訂閱偏好：${context.unsubscribeUrl}`].join('\n\n')
}

export function assertHtmlSize(html: string): { ok: boolean; bytes: number } {
  const bytes = Buffer.byteLength(html, 'utf8')
  return { ok: bytes <= MAX_EMAIL_HTML_BYTES, bytes }
}

export function makeTrackingToken(seed: string): string {
  return crypto.createHash('sha256').update(`${seed}:${crypto.randomUUID()}`).digest('hex').slice(0, 32)
}
