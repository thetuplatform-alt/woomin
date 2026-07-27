const ABSOLUTE_URL_PATTERN = /^https?:\/\//i
const INTERNAL_ASSET_HOSTS = new Set(['0.0.0.0', '::', '[::]', 'localhost', '127.0.0.1', '::1', '[::1]'])

export function isAbsoluteHttpUrl(value: string): boolean {
  return ABSOLUTE_URL_PATTERN.test(value)
}

function isInternalAssetHost(hostname: string): boolean {
  return INTERNAL_ASSET_HOSTS.has(hostname.trim().toLowerCase())
}

export function resolveAssetUrl(
  value: string | null | undefined,
  appUrl: string
): string | null {
  if (!value) {
    return null
  }

  if (isAbsoluteHttpUrl(value)) {
    try {
      const url = new URL(value)
      if (isInternalAssetHost(url.hostname)) {
        return new URL(`${url.pathname}${url.search}${url.hash}`, appUrl).toString()
      }
    } catch {
      return value
    }
    return value
  }

  if (value.startsWith('/')) {
    return `${appUrl}${value}`
  }

  return value
}
