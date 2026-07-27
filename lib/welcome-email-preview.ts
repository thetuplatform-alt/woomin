export interface WelcomeEmailTemplateContext {
  userName: string
  courseTitle: string
  courseUrl: string
  supportEmail: string
  purchaseDate: string
}

const TOKEN_ALIASES: Record<string, string> = {
  '{{user_name}}': '{{?冽?迂}}',
  '{{course_name}}': '{{隤脩??迂}}',
  '{{course_url}}': '{{隤脩????}}',
  '{{support_email}}': '{{摰Ｘ?靽∠拳}}',
  '{{purchase_date}}': '{{鞈潸眺?交?}}',
}

const TOKEN_VALUE_KEYS: Record<string, keyof WelcomeEmailTemplateContext> = {
  '{{?冽?迂}}': 'userName',
  '{{隤脩??迂}}': 'courseTitle',
  '{{隤脩????}}': 'courseUrl',
  '{{摰Ｘ?靽∠拳}}': 'supportEmail',
  '{{鞈潸眺?交?}}': 'purchaseDate',
}

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
  output = output.replace(
    /`([^`]+)`/g,
    '<code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 6px; font-size: 0.9em;">$1</code>'
  )

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
        `<h${level} style="margin: 0 0 16px 0; font-size: ${Math.max(
          18,
          30 - level * 2
        )}px; line-height: 1.4; color: #111827;">${renderInlineMarkdown(
          headingMatch[2]
        )}</h${level}>`
      )
      continue
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/)
    if (listMatch) {
      if (!inList) {
        blocks.push('<ul style="margin: 0 0 16px 0; padding-left: 20px; color: #444;">')
        inList = true
      }
      blocks.push(
        `<li style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.8;">${renderInlineMarkdown(
          listMatch[1]
        )}</li>`
      )
      continue
    }

    closeList()
    blocks.push(
      `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.8; color: #444;">${renderInlineMarkdown(
        line
      )}</p>`
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
