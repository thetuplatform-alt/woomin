'use server'

import { readFileSync } from 'fs'
import { join } from 'path'

export interface PlatformUpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  latestDownloadUrl: string | null
  summary: string | null
  error: string | null
}

export async function checkForPlatformUpdate(): Promise<PlatformUpdateInfo> {
  const currentVersion = getCurrentVersion()

  const apiUrl = process.env.PLATFORM_UPDATE_API_URL
  const apiKey = process.env.PLATFORM_API_KEY

  if (!apiUrl || !apiKey) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: null,
      latestDownloadUrl: null,
      summary: null,
      error: null, // Not an error — just not configured
    }
  }

  try {
    const url = new URL('/api/platform-versions', apiUrl)
    url.searchParams.set('apiKey', apiKey)

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!res.ok) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: null,
        latestDownloadUrl: null,
        summary: null,
        error: `API returned ${res.status}`,
      }
    }

    const data = (await res.json()) as {
      latestVersion: string | null
      versions: Array<{
        version: string
        summary: string
        downloadUrl: string | null
        breakingChanges: string | null
      }>
    }

    if (!data.latestVersion) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: null,
        latestDownloadUrl: null,
        summary: null,
        error: null,
      }
    }

    // Find the download URL for the latest version
    const latestVersionData = data.versions.find(
      (v) => v.version === data.latestVersion
    )
    const latestDownloadUrl = latestVersionData?.downloadUrl ?? null

    const hasUpdate = compareVersions(data.latestVersion, currentVersion) > 0

    // Collect summaries for all versions newer than current
    let summary: string | null = null
    if (hasUpdate) {
      const newerVersions = data.versions.filter(
        (v) => compareVersions(v.version, currentVersion) > 0
      )
      summary = newerVersions
        .map((v) => {
          let text = `### v${v.version}\n${v.summary}`
          if (v.breakingChanges) {
            text += `\n\n⚠️ **Breaking Changes:**\n${v.breakingChanges}`
          }
          return text
        })
        .join('\n\n---\n\n')
    }

    return {
      hasUpdate,
      currentVersion,
      latestVersion: data.latestVersion,
      latestDownloadUrl: hasUpdate ? latestDownloadUrl : null,
      summary,
      error: null,
    }
  } catch (err) {
    console.error('Platform update check failed:', err)
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: null,
      latestDownloadUrl: null,
      summary: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

function getCurrentVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}
