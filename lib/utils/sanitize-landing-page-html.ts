// lib/utils/sanitize-landing-page-html.ts
// 清理課程銷售頁自訂 HTML（course.landingPageHtml），移除 <script>、
// on* 事件屬性、javascript: scheme 連結等可執行任意 JavaScript 的內容，
// 只保留銷售頁排版需要的安全標籤與屬性白名單。
//
// 對應 openspec/changes/fix-critical-xss-and-assignment-upload
// 的「課程銷售頁 HTML 清理」設計決策。
//
// 注意：package.json 的 sanitize-html 版本固定在 2.17.0（不用 ^），
// 因為 2.17.1 起把內部依賴 htmlparser2 升到 ESM-only（^10.1.0／^12.0.0），
// Jest（本專案用 ts-jest + commonjs）會解析失敗（Cannot use import statement
// outside a module）。2.17.0 仍依賴 htmlparser2 ^8.0.0（CJS），可正常在 Jest 下運作。

import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'div',
  'section',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'a',
  'ul',
  'ol',
  'li',
  'span',
  'strong',
  'em',
  'br',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
]

const ALLOWED_ATTRIBUTES = {
  '*': ['class', 'style', 'src', 'href', 'alt', 'width', 'height'],
}

export function sanitizeLandingPageHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
  })
}
