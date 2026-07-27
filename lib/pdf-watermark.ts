import { promises as fs } from 'fs'
import path from 'path'
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { resolveAppUrl } from '@/lib/app-url'
import { getDisplaySiteName } from '@/lib/site-brand'
import { readLocalStorageObject } from '@/lib/storage'
import { SETTING_KEYS } from '@/lib/validations/settings'

interface PdfWatermarkOptions {
  sourceUrl?: string | null
  dynamic?: {
    siteName?: string | null
    courseTitle?: string | null
    fileTitle?: string | null
    userName?: string | null
    userEmail?: string | null
    userId?: string | null
    timestamp?: Date
  }
}

interface SiteWatermarkSettings {
  siteName: string
  siteLogo: string
  siteUrl: string
}

const INTERNAL_WATERMARK_HOSTS = new Set(['0.0.0.0', '::', '[::]', 'localhost', '127.0.0.1', '::1', '[::1]'])

function resolveWatermarkSiteUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  try {
    const url = new URL(value)
    if (INTERNAL_WATERMARK_HOSTS.has(url.hostname.toLowerCase())) {
      return fallback
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return fallback
  }
}

function getLocalUploadKey(url: string) {
  if (url.startsWith('/uploads/')) {
    return url.slice('/uploads/'.length)
  }

  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/uploads/')) {
      return parsed.pathname.slice('/uploads/'.length)
    }
  } catch {
    return null
  }

  return null
}

async function getSiteWatermarkSettings(): Promise<SiteWatermarkSettings> {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.SITE_NAME,
            SETTING_KEYS.SITE_LOGO,
            SETTING_KEYS.SITE_URL,
          ],
        },
      },
    })
    const map = new Map(settings.map((setting) => [setting.key, setting.value]))
    const appUrl = await resolveAppUrl()

    return {
      siteName: getDisplaySiteName(map.get(SETTING_KEYS.SITE_NAME)),
      siteLogo: map.get(SETTING_KEYS.SITE_LOGO) || '/icon.png',
      siteUrl: resolveWatermarkSiteUrl(map.get(SETTING_KEYS.SITE_URL), appUrl),
    }
  } catch {
    const appUrl = await resolveAppUrl()
    return {
      siteName: 'WooMin',
      siteLogo: '/icon.png',
      siteUrl: appUrl,
    }
  }
}

async function readLogoBytes(logoUrl: string): Promise<Buffer | null> {
  if (!logoUrl) return null

  if (logoUrl.startsWith('/icon.png')) {
    try {
      return await fs.readFile(path.join(process.cwd(), 'public', 'icon.png'))
    } catch {
      return null
    }
  }

  const localKey = getLocalUploadKey(logoUrl)
  if (localKey) {
    const object = await readLocalStorageObject(localKey)
    return object.success && object.buffer ? object.buffer : null
  }

  try {
    const appUrl = await resolveAppUrl()
    const absoluteUrl = logoUrl.startsWith('http')
      ? logoUrl
      : new URL(logoUrl, appUrl).toString()
    const response = await fetch(absoluteUrl)
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
}

async function embedLogo(pdfDoc: PDFDocument, logoUrl: string) {
  const bytes = await readLogoBytes(logoUrl)
  if (!bytes) return null

  try {
    return await pdfDoc.embedPng(bytes)
  } catch {
    try {
      return await pdfDoc.embedJpg(bytes)
    } catch {
      return null
    }
  }
}

function safePdfText(font: PDFFont, text: string, fallback = 'Protected PDF') {
  const normalized = text.replace(/\s+/g, ' ').trim()
  let output = ''

  for (const char of normalized) {
    try {
      font.encodeText(char)
      output += char
    } catch {
      output += '?'
    }
  }

  return output.replace(/\?{4,}/g, '???').trim() || fallback
}

function buildDynamicWatermarkLines(
  settings: SiteWatermarkSettings,
  dynamic: NonNullable<PdfWatermarkOptions['dynamic']>
) {
  const timestamp = dynamic.timestamp || new Date()
  const userIdentity = [
    dynamic.userName,
    dynamic.userEmail,
    dynamic.userId ? `ID: ${dynamic.userId}` : null,
  ].filter(Boolean).join(' · ')

  return [
    dynamic.siteName || settings.siteName,
    dynamic.courseTitle ? `Course: ${dynamic.courseTitle}` : null,
    dynamic.fileTitle ? `File: ${dynamic.fileTitle}` : null,
    userIdentity || null,
    `Opened: ${timestamp.toISOString()}`,
  ].filter((line): line is string => Boolean(line))
}

export async function applyPdfWatermark(
  input: Buffer,
  options: PdfWatermarkOptions = {}
): Promise<Buffer> {
  const settings = await getSiteWatermarkSettings()
  const pdfDoc = await PDFDocument.load(input, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const logo = await embedLogo(pdfDoc, settings.siteLogo)
  const sourceUrl = options.sourceUrl || settings.siteUrl
  const dynamicLines = options.dynamic
    ? buildDynamicWatermarkLines(settings, options.dynamic).map((line) =>
        safePdfText(font, line)
      )
    : []

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize()
    const diagonalText = safePdfText(
      boldFont,
      dynamicLines.length > 0
        ? dynamicLines.join(' · ')
        : `${settings.siteName} · ${sourceUrl}`
    )
    const fontSize = Math.max(28, Math.min(width, height) * 0.055)
    const xStep = Math.max(300, width * 0.48)
    const yStep = Math.max(220, height * 0.32)

    for (let y = -height * 0.12; y < height * 1.1; y += yStep) {
      for (let x = -width * 0.2; x < width * 1.05; x += xStep) {
        page.drawText(diagonalText, {
          x,
          y,
          size: fontSize,
          font: boldFont,
          color: rgb(0.08, 0.08, 0.08),
          opacity: 0.055,
          rotate: degrees(-28),
        })
      }
    }

    const footerText = safePdfText(
      font,
      dynamicLines.length > 0
        ? `${dynamicLines.join(' · ')} · ${settings.siteUrl}`
        : `${settings.siteName} · ${settings.siteUrl}`
    )
    page.drawText(footerText, {
      x: 28,
      y: 24,
      size: 9,
      font,
      color: rgb(0.12, 0.12, 0.12),
      opacity: 0.28,
    })

    if (logo) {
      const maxLogoWidth = 42
      const scale = Math.min(maxLogoWidth / logo.width, 1)
      page.drawImage(logo, {
        x: width - 28 - logo.width * scale,
        y: 18,
        width: logo.width * scale,
        height: logo.height * scale,
        opacity: 0.22,
      })
    }
  }

  const output = await pdfDoc.save()
  return Buffer.from(output)
}
