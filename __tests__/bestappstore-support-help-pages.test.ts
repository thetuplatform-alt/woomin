import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('BestAppStore public support and help pages', () => {
  const supportSource = readProjectFile('app/(home)/support/page.tsx')
  const helpSource = readProjectFile('app/(home)/help/page.tsx')

  it('defines the approved metadata and page-specific canonicals', () => {
    expect(supportSource).toContain("title: { absolute: '支援中心 | BestAppStore' }")
    expect(supportSource).toContain("alternates: { canonical: 'https://bestappstore.co.uk/support' }")
    expect(helpSource).toContain("title: { absolute: '使用說明 | BestAppStore' }")
    expect(helpSource).toContain("alternates: { canonical: 'https://bestappstore.co.uk/help' }")
  })

  it('keeps both pages free of authentication, redirects, and page-level data access', () => {
    for (const source of [supportSource, helpSource]) {
      expect(source).not.toMatch(/from ['"]@\/lib\/(?:prisma|auth|entitlement)/)
      expect(source).not.toMatch(/redirect\s*\(/)
    }
  })

  it('contains the approved support address, safety guidance, and help language', () => {
    expect(supportSource).toContain('service@bestappstore.co.uk')
    expect(supportSource).toContain('客服不會要求你提供上述資訊')
    expect(supportSource).toContain('一次性驗證碼')
    expect(helpSource).toContain('已開通服務')
    expect(helpSource).toContain('尚未開通')
    expect(helpSource).toContain('工具目前尚未提供')
    expect(helpSource).toContain('請聯絡支援中心')
  })

  it('does not expose legacy branding or internal implementation language', () => {
    const publicPageSource = `${supportSource}\n${helpSource}`

    for (const forbidden of ['WooMin', 'Woomin', 'Learning System', '課程平台', 'entitlement', 'runtime', 'Prisma', 'internal slug']) {
      expect(publicPageSource).not.toContain(forbidden)
    }
  })

  it('links the homepage, Lumi footer, and default footer to the public routes', () => {
    const home = readProjectFile('app/(home)/page.tsx')
    const lumi = readProjectFile('app/lumi-series/page.tsx')
    const footer = readProjectFile('components/layouts/main-footer.tsx')

    expect(home).toContain('<Link href="/help">使用說明</Link>')
    expect(home).toContain('<Link href="/support">支援中心</Link>')
    expect(lumi).toContain('<Link href="/help">使用說明</Link>')
    expect(lumi).toContain('<Link href="/support">支援中心</Link>')
    expect(footer).toContain("{ label: '使用說明', url: '/help' }")
    expect(footer).toContain("{ label: '支援中心', url: '/support' }")
  })

  it('keeps homepage teaser anchors and includes both routes in the sitemap', () => {
    const home = readProjectFile('app/(home)/page.tsx')
    const sitemap = readProjectFile('app/sitemap.ts')

    expect(home).toContain('id="how"')
    expect(home).toContain('id="support"')
    expect(sitemap).toContain('`${baseUrl}/help`')
    expect(sitemap).toContain('`${baseUrl}/support`')
  })

  it('uses accessible disclosure and heading structures', () => {
    const accordion = readProjectFile('components/ui/accordion.tsx')
    const layoutStyles = readProjectFile('components/main/legal/legal-page-layout.module.css')

    expect(supportSource).toContain('<AccordionTrigger')
    expect(supportSource).toContain('aria-labelledby="support-topics"')
    expect(supportSource).toContain('md:grid-cols-2')
    expect(helpSource).toContain('<ol')
    expect(helpSource).toContain('<h3')
    expect(helpSource).toContain('sm:grid-cols-2')
    expect(accordion).toContain('focus-visible:ring-[3px]')
    expect(layoutStyles).toContain('.page a:focus-visible, .page button:focus-visible')
    expect(layoutStyles).toContain('@media (max-width: 720px)')
  })
})
