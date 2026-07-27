import fs from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_SITE_ICON_PATH,
  resolveSiteIconPath,
} from '@/lib/site-brand-assets'
import { PUBLIC_SITE_DEFAULTS } from '@/lib/site-settings-public-types'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('site brand assets', () => {
  it('resolves empty and legacy logo values to the lightweight SVG icon', () => {
    expect(DEFAULT_SITE_ICON_PATH).toBe('/icon.svg')
    expect(resolveSiteIconPath()).toBe('/icon.svg')
    expect(resolveSiteIconPath('')).toBe('/icon.svg')
    expect(resolveSiteIconPath('   ')).toBe('/icon.svg')
    expect(resolveSiteIconPath('/icon.png')).toBe('/icon.svg')
    expect(resolveSiteIconPath('https://aiver.me/icon.png', 'https://aiver.me')).toBe('/icon.svg')
    expect(resolveSiteIconPath('/uploads/custom-logo.webp')).toBe('/uploads/custom-logo.webp')
    expect(resolveSiteIconPath('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png')
  })

  it('uses the SVG icon for public defaults, metadata fallback, and the header logo fallback', () => {
    expect(PUBLIC_SITE_DEFAULTS.siteLogo).toBe('/icon.svg')

    const layoutSource = readProjectFile('app/layout.tsx')
    expect(layoutSource).toContain("icon: siteIcon")
    expect(layoutSource).toContain("shortcut: siteIcon")
    expect(layoutSource).toContain("apple: siteIcon")
    expect(layoutSource).not.toContain("icon: siteLogo || '/icon.png'")

    const logoSource = readProjectFile('components/shared/logo.tsx')
    expect(logoSource).toContain("src={siteLogo || DEFAULT_SITE_ICON_PATH}")
    expect(logoSource).not.toContain("siteLogo || '/icon.png'")

    const homeSource = readProjectFile('app/(main)/page.tsx')
    expect(homeSource).toContain('DEFAULT_SITE_ICON_PATH')
    expect(homeSource).not.toContain('logo: `${appUrl}/icon.png`')
  })

  it('keeps public static assets outside the auth middleware catch-all while protecting admin routes', () => {
    const middlewareSource = readProjectFile('middleware.ts')

    expect(middlewareSource).toContain('/admin/:path*')
    expect(middlewareSource).toContain('/courses/:path*/lessons/:path*')
    expect(middlewareSource).toContain('svg')
    expect(middlewareSource).toContain('png')
    expect(middlewareSource).toContain('_next/static')
    expect(middlewareSource).toContain('_next/image')
    expect(middlewareSource).toContain('favicon.ico')
    expect(middlewareSource).toMatch(/\(\?:[^)]*svg[^)]*png[^)]*\)/)

    const nextConfigSource = readProjectFile('next.config.ts')
    expect(nextConfigSource).toContain('source: "/icon.svg"')
    expect(nextConfigSource).toContain('Cache-Control')
    expect(nextConfigSource).toContain('public, max-age=31536000, immutable')
  })
})
