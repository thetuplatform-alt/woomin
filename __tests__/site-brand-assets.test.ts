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

function readPngMetadata(filePath: string) {
  const file = fs.readFileSync(path.join(root, filePath))
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    colorType: file[25],
  }
}

function readIcoSizes(filePath: string) {
  const file = fs.readFileSync(path.join(root, filePath))
  const count = file.readUInt16LE(4)
  return Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16
    return [file[offset] || 256, file[offset + 1] || 256]
  })
}

describe('site brand assets', () => {
  it('resolves empty and legacy logo values to the approved BestAppStore icon', () => {
    expect(DEFAULT_SITE_ICON_PATH).toBe('/bestappstore-icon.png')
    expect(resolveSiteIconPath()).toBe('/bestappstore-icon.png')
    expect(resolveSiteIconPath('')).toBe('/bestappstore-icon.png')
    expect(resolveSiteIconPath('   ')).toBe('/bestappstore-icon.png')
    expect(resolveSiteIconPath('/icon.png')).toBe('/bestappstore-icon.png')
    expect(resolveSiteIconPath('/icon.svg')).toBe('/bestappstore-icon.png')
    expect(resolveSiteIconPath('https://aiver.me/icon.png', 'https://aiver.me')).toBe('/bestappstore-icon.png')
    expect(resolveSiteIconPath('/uploads/custom-logo.webp')).toBe('/uploads/custom-logo.webp')
    expect(resolveSiteIconPath('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png')
  })

  it('uses the approved square icon fallback while branded surfaces use the horizontal logo', () => {
    expect(PUBLIC_SITE_DEFAULTS.siteLogo).toBe('/bestappstore-icon.png')

    const layoutSource = readProjectFile('app/layout.tsx')
    expect(layoutSource).toContain("url: '/favicon-16.png'")
    expect(layoutSource).toContain("url: '/favicon-32.png'")
    expect(layoutSource).toContain("url: '/favicon-48.png'")
    expect(layoutSource).toContain("shortcut: '/favicon.ico'")
    expect(layoutSource).toContain("url: '/apple-touch-icon.png'")
    expect(layoutSource).not.toContain('shareImage || shareLogo || siteIcon')
    expect(layoutSource).not.toContain("icon: siteLogo || '/icon.png'")

    const logoSource = readProjectFile('components/shared/logo.tsx')
    expect(logoSource).toContain("src={siteLogo || DEFAULT_SITE_ICON_PATH}")
    expect(logoSource).not.toContain("siteLogo || '/icon.png'")

    const homeSource = readProjectFile('app/(home)/page.tsx')
    expect(homeSource).toContain('BestAppStoreBrand')
    expect(homeSource).not.toContain('logo: `${appUrl}/icon.png`')
  })

  it('ships the approved favicon, Apple, app, and runtime icon sizes', () => {
    expect(readPngMetadata('public/bestappstore-symbol.png')).toEqual({
      width: 1024,
      height: 1024,
      colorType: 6,
    })
    expect(readPngMetadata('public/bestappstore-icon.png')).toEqual({
      width: 512,
      height: 512,
      colorType: 6,
    })
    expect(readPngMetadata('app/icon.png')).toEqual({
      width: 1024,
      height: 1024,
      colorType: 6,
    })
    expect(readPngMetadata('public/favicon-16.png')).toMatchObject({ width: 16, height: 16 })
    expect(readPngMetadata('public/favicon-32.png')).toMatchObject({ width: 32, height: 32 })
    expect(readPngMetadata('public/favicon-48.png')).toMatchObject({ width: 48, height: 48 })
    expect(readPngMetadata('public/apple-touch-icon.png')).toEqual({
      width: 180,
      height: 180,
      colorType: 2,
    })
    expect(readIcoSizes('public/favicon.ico')).toEqual([
      [16, 16],
      [32, 32],
      [48, 48],
    ])

    const compatibilityIcon = readProjectFile('public/icon.svg')
    expect(compatibilityIcon).toContain('/bestappstore-icon.png')
    expect(compatibilityIcon).not.toMatch(/muni/i)

    const sidebarSource = readProjectFile('components/admin/sidebar.tsx')
    expect(sidebarSource).toContain('isActuallyCollapsed ? "/bestappstore-icon.png" : "/bestappstore-logo.png"')
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
    expect(nextConfigSource).toContain('source: "/bestappstore-icon.png"')
    expect(nextConfigSource).toContain('Cache-Control')
    expect(nextConfigSource).toContain('public, max-age=31536000, immutable')
  })
})
