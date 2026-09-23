import fs from 'node:fs'
import path from 'node:path'
import { getDisplaySiteName } from '@/lib/site-brand'
import { PUBLIC_SITE_DEFAULTS } from '@/lib/site-settings-public-types'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('BestAppStore public brand fallback', () => {
  it('uses BestAppStore when public settings are absent', () => {
    expect(PUBLIC_SITE_DEFAULTS).toMatchObject({
      siteName: 'BestAppStore',
      contactEmail: 'service@bestappstore.co.uk',
      brandDisplayName: 'BestAppStore',
      brandSubtitle: 'Member Services',
    })
    expect(PUBLIC_SITE_DEFAULTS.shareDescription).toContain('多系列會員服務平台')
  })

  it.each([undefined, null, '', 'Course Realms', 'Realms', 'WooMin', 'WooMin Learning System'])(
    'maps the legacy site name %p to BestAppStore',
    (siteName) => {
      expect(getDisplaySiteName(siteName)).toBe('BestAppStore')
    }
  )

  it('preserves a configured custom site name', () => {
    expect(getDisplaySiteName('Customer Brand')).toBe('Customer Brand')
  })

  it('uses BestAppStore metadata on auth entry pages', () => {
    const files = [
      'app/(auth)/login/page.tsx',
      'app/(auth)/register/page.tsx',
      'app/(auth)/forgot-password/page.tsx',
      'app/(auth)/reset-password/page.tsx',
      'app/(main)/activate-account/page.tsx',
    ]

    for (const file of files) {
      const source = readProjectFile(file)
      expect(source).toMatch(/title: '[^']+ \| BestAppStore'/)
      expect(source).not.toMatch(/title: '[^']+ \| 課程平台'/)
    }
  })

  it('keeps approved routes while converging visible navigation copy', () => {
    const source = readProjectFile('components/layouts/main-header.tsx')
    expect(source).toContain('href="/my-courses"')
    expect(source).toContain('href="/login"')
    expect(source).toContain('我的服務')
    expect(source).toContain('進入服務')
    expect(source).not.toContain('我的學習中心')
    expect(source).not.toContain('開始學習')
  })
})
