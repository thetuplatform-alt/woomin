// __tests__/sanitize-landing-page-html.test.ts
//
// 對應 fix-critical-xss-and-assignment-upload change 的 task 2.1：
// 課程銷售頁 HTML（course.landingPageHtml）目前完全沒有驗證或清理，
// 直接透過 dangerouslySetInnerHTML 輸出給所有訪客，任何有課程編輯權限者
// 可植入任意 <script>。這個清理函式在儲存前移除危險標籤／屬性，
// 只保留銷售頁排版需要的安全子集。

import { sanitizeLandingPageHtml } from '@/lib/utils/sanitize-landing-page-html'

describe('sanitizeLandingPageHtml', () => {
  it('完整移除 <script> 標籤與其內容', () => {
    const result = sanitizeLandingPageHtml(
      '<div>Hello</div><script>alert(document.cookie)</script>'
    )
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert(document.cookie)')
    expect(result).toContain('<div>Hello</div>')
  })

  it('移除 onclick 等事件屬性，保留元素本身', () => {
    const result = sanitizeLandingPageHtml('<div onclick="alert(1)">Buy now</div>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('<div>Buy now</div>')
  })

  it('移除 javascript: scheme 的連結，保留元素文字', () => {
    const result = sanitizeLandingPageHtml('<a href="javascript:alert(1)">Click</a>')
    expect(result).not.toContain('javascript:')
    expect(result).toContain('Click')
  })

  it('移除 iframe／object／embed 等危險標籤', () => {
    const result = sanitizeLandingPageHtml(
      '<iframe src="https://evil.example/"></iframe><object data="evil.swf"></object><embed src="evil.swf" />'
    )
    expect(result).not.toContain('<iframe')
    expect(result).not.toContain('<object')
    expect(result).not.toContain('<embed')
  })

  it('保留 div／p／img／a 等安全排版標籤與 class／src／href／alt 屬性', () => {
    const input =
      '<div class="banner"><p>介紹文字</p>' +
      '<img src="https://cdn.example.com/banner.png" alt="Banner" />' +
      '<a href="https://example.com" class="btn">立即購買</a></div>'
    const result = sanitizeLandingPageHtml(input)

    expect(result).toContain('class="banner"')
    expect(result).toContain('<p>介紹文字</p>')
    expect(result).toContain('src="https://cdn.example.com/banner.png"')
    expect(result).toContain('alt="Banner"')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('class="btn"')
  })
})
