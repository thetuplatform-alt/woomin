// lib/welcome-email.ts
// 課程歡迎信共用設定與模板渲染工具

export interface WelcomeEmailTemplateContext {
  userName: string
  courseTitle: string
  courseUrl: string
  supportEmail: string
  purchaseDate: string
}

export interface WelcomeEmailVariable {
  token: string
  label: string
  description: string
  example: string
}

export const WELCOME_EMAIL_VARIABLES: WelcomeEmailVariable[] = [
  {
    token: '{{用戶名稱}}',
    label: '用戶名稱',
    description: '購買者姓名，若無名稱則使用「學員」',
    example: 'Allen',
  },
  {
    token: '{{課程名稱}}',
    label: '課程名稱',
    description: '目前購買的課程標題',
    example: '我的第一門課程',
  },
  {
    token: '{{課程連結}}',
    label: '課程連結',
    description: '課程頁面網址',
    example: `https://your-domain.com/courses/your-course-slug`,
  },
  {
    token: '{{客服信箱}}',
    label: '客服信箱',
    description: '站點客服信箱，未設定時使用 no-reply',
    example: 'support@example.com',
  },
  {
    token: '{{購買日期}}',
    label: '購買日期',
    description: '付款成功日期（台北時區）',
    example: '2026/02/18',
  },
]

const TOKEN_ALIASES: Record<string, string> = {
  '{{user_name}}': '{{用戶名稱}}',
  '{{course_name}}': '{{課程名稱}}',
  '{{course_url}}': '{{課程連結}}',
  '{{support_email}}': '{{客服信箱}}',
  '{{purchase_date}}': '{{購買日期}}',
}

const TOKEN_VALUE_KEYS: Record<string, keyof WelcomeEmailTemplateContext> = {
  '{{用戶名稱}}': 'userName',
  '{{課程名稱}}': 'courseTitle',
  '{{課程連結}}': 'courseUrl',
  '{{客服信箱}}': 'supportEmail',
  '{{購買日期}}': 'purchaseDate',
}

export const DEFAULT_WELCOME_EMAIL_SUBJECT = '歡迎加入《{{課程名稱}}》'

export const DEFAULT_WELCOME_EMAIL_MARKDOWN = `嗨，{{用戶名稱}} 你好！

我是課程平台團隊，先祝你一切順利。

感謝你購買 **{{課程名稱}}**，歡迎正式加入我們！

你可以從這裡開始上課：
[立即前往課程]({{課程連結}})

學習過程中若有問題，歡迎直接回信或聯絡 {{客服信箱}}。

購買日期：{{購買日期}}

課程平台團隊`

function replaceTokenAll(input: string, token: string, value: string): string {
  return input.split(token).join(value)
}

export function renderWelcomeEmailTemplate(
  template: string,
  context: WelcomeEmailTemplateContext
): string {
  let output = template

  for (const [token, valueKey] of Object.entries(TOKEN_VALUE_KEYS)) {
    output = replaceTokenAll(output, token, context[valueKey])
  }

  for (const [alias, canonical] of Object.entries(TOKEN_ALIASES)) {
    const valueKey = TOKEN_VALUE_KEYS[canonical]
    output = replaceTokenAll(output, alias, context[valueKey])
  }

  return output
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInlineMarkdown(input: string): string {
  let output = escapeHtml(input)

  output = output.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" style="color: #0f766e; text-decoration: underline;">$1</a>'
  )
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  output = output.replace(/`([^`]+)`/g, '<code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 6px; font-size: 0.9em;">$1</code>')

  return output
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) {
      blocks.push('</ul>')
      inList = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      closeList()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      blocks.push(
        `<h${level} style="margin: 0 0 16px 0; font-size: ${Math.max(18, 30 - level * 2)}px; line-height: 1.4; color: #111827;">${renderInlineMarkdown(headingMatch[2])}</h${level}>`
      )
      continue
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/)
    if (listMatch) {
      if (!inList) {
        blocks.push('<ul style="margin: 0 0 16px 0; padding-left: 20px; color: #444;">')
        inList = true
      }
      blocks.push(`<li style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.8;">${renderInlineMarkdown(listMatch[1])}</li>`)
      continue
    }

    closeList()
    blocks.push(
      `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.8; color: #444;">${renderInlineMarkdown(line)}</p>`
    )
  }

  closeList()

  return blocks.join('\n')
}

export function renderWelcomeEmailHtmlFromMarkdown(markdown: string): string {
  const contentHtml = markdownToHtml(markdown)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f8f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f8f8; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 32px 36px 36px 36px;">
              ${contentHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function getUnknownWelcomeEmailTokens(template: string): string[] {
  const matched = template.match(/{{\s*[^{}]+\s*}}/g) || []
  if (matched.length === 0) return []

  const knownTokens = new Set([
    ...Object.keys(TOKEN_VALUE_KEYS),
    ...Object.keys(TOKEN_ALIASES),
  ])

  const unknown = new Set<string>()

  for (const token of matched) {
    const normalized = token.replace(/\s+/g, '')
    if (!knownTokens.has(normalized)) {
      unknown.add(token)
    }
  }

  return Array.from(unknown)
}

export async function buildWelcomeEmailContext(params: {
  userName?: string | null
  courseTitle: string
  courseSlug: string
  supportEmail?: string | null
  purchaseDate?: Date
}): Promise<WelcomeEmailTemplateContext> {
  const purchaseDate = params.purchaseDate || new Date()
  const { resolveAppUrl } = await import('@/lib/app-url')
  const appUrl = await resolveAppUrl()

  return {
    userName: params.userName?.trim() || '學員',
    courseTitle: params.courseTitle,
    courseUrl: `${appUrl}/courses/${params.courseSlug}`,
    supportEmail: params.supportEmail || process.env.EMAIL_FROM || 'noreply@example.com',
    purchaseDate: purchaseDate.toLocaleDateString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
  }
}
