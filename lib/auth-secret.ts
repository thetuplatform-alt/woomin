const FALLBACK_DEVELOPMENT_SECRET = 'course-realms-dev-secret'

function deriveStableSecret(input: string): string {
  let hashA = 0x811c9dc5
  let hashB = 0x9e3779b9

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)

    hashA ^= code
    hashA = Math.imul(hashA, 0x01000193)

    hashB ^= code
    hashB = Math.imul(hashB, 0x85ebca6b)
    hashB = (hashB << 13) | (hashB >>> 19)
  }

  return `derived-auth-secret-${(hashA >>> 0).toString(16).padStart(8, '0')}${(hashB >>> 0)
    .toString(16)
    .padStart(8, '0')}`
}

export function getAuthSecret(): string {
  const envSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (envSecret) {
    return envSecret
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return FALLBACK_DEVELOPMENT_SECRET
  }

  return deriveStableSecret(databaseUrl)
}
