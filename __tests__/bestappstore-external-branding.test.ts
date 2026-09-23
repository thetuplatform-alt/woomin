import fs from 'node:fs'
import path from 'node:path'
import { testEmailTemplate } from '@/lib/email-templates'
import {
  DEFAULT_WELCOME_EMAIL_MARKDOWN,
  WELCOME_EMAIL_VARIABLES,
} from '@/lib/welcome-email'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('BestAppStore external output branding', () => {
  it('uses the approved name and logo when email branding is absent', () => {
    const html = testEmailTemplate()

    expect(html).toContain('BestAppStore')
    expect(html).toContain('/bestappstore-logo.png')
    expect(html).not.toContain('WooMin')
    expect(html).not.toContain('/icon.png')
  })

  it('preserves configured custom email branding', () => {
    const html = testEmailTemplate({
      siteName: 'Customer Brand',
      siteLogo: 'https://assets.example.test/customer-logo.png',
      appUrl: 'https://customer.example.test',
    })

    expect(html).toContain('Customer Brand')
    expect(html).toContain('https://assets.example.test/customer-logo.png')
    expect(html).not.toContain('/bestappstore-logo.png')
  })

  it('uses BestAppStore in the default welcome message and support example', () => {
    expect(DEFAULT_WELCOME_EMAIL_MARKDOWN).toContain('BestAppStore 團隊')
    expect(DEFAULT_WELCOME_EMAIL_MARKDOWN).not.toContain('課程平台團隊')
    expect(WELCOME_EMAIL_VARIABLES.find((item) => item.token === '{{客服信箱}}')?.example)
      .toBe('service@bestappstore.co.uk')
  })

  it('keeps database-provided values ahead of BestAppStore fallbacks', () => {
    const newsletter = readProjectFile('lib/newsletter/settings.ts')
    const settings = readProjectFile('lib/actions/settings.ts')
    const preview = readProjectFile('app/api/admin/email/preview/route.ts')
    const pdf = readProjectFile('lib/pdf-watermark.ts')

    expect(newsletter).toContain('resolveAssetUrl(map.get(SETTING_KEYS.SITE_LOGO), appUrl) ||')
    expect(newsletter).toContain('const senderName = getDisplaySiteName(')
    expect(settings).toContain('const siteName = getDisplaySiteName(map.get(SETTING_KEYS.SITE_NAME))')
    expect(settings).toContain("process.env.EMAIL_FROM || 'service@bestappstore.co.uk'")
    expect(preview).toContain('getDisplaySiteName(siteName?.value)')
    expect(preview).toContain('resolveAssetUrl(siteLogo?.value, appUrl) ||')
    expect(pdf).toContain("map.get(SETTING_KEYS.SITE_LOGO) || '/bestappstore-logo.png'")
  })
})
