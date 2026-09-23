import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('BestAppStore third-batch branding', () => {
  it('keeps the course structured data valid without labeling the parent brand as a course platform', () => {
    const source = readProjectFile('app/(main)/courses/[slug]/page.tsx')

    expect(source).toContain("'@context': 'https://schema.org'")
    expect(source).toContain("'@type': 'Course'")
    expect(source).toContain("'@type': 'Organization'")
    expect(source).toContain('name: publicSettings.siteName')
    expect(source).toContain('siteName,')
    expect(source).not.toContain('siteName: `${siteName} 課程平台`')
  })

  it('uses a neutral setup description without changing the setup option', () => {
    const source = readProjectFile('app/(setup)/admin/setup/setup-client.tsx')

    expect(source).toContain('title="Cloudflare Stream"')
    expect(source).toContain('適合正式內容平台。')
    expect(source).not.toContain('適合正式課程平台。')
  })

  it('uses BestAppStore in low-risk page titles while keeping approved routes', () => {
    const files = [
      'app/(main)/checkout/page.tsx',
      'app/(main)/checkout/success/page.tsx',
      'app/(main)/checkout/failed/page.tsx',
      'app/(main)/my-courses/page.tsx',
      'app/(main)/my-subscriptions/page.tsx',
    ]

    for (const file of files) {
      const source = readProjectFile(file)
      expect(source).toMatch(/title: '[^']+ \| BestAppStore'/)
      expect(source).not.toMatch(/title: '[^']+ \| 課程平台'/)
    }
  })
})
