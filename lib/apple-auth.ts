import jwt from 'jsonwebtoken'

interface AppleSecretInput {
  appleId: string
  teamId: string
  keyId: string
  privateKey: string
}

let cachedSecret: string | null = null
let cachedExpiry = 0
let cachedSignature = ''

const CACHE_TTL_MS = 290 * 60 * 1000

export function generateAppleClientSecret(input: AppleSecretInput): string {
  const { teamId, appleId, keyId, privateKey } = input

  if (!teamId || !appleId || !keyId || !privateKey) {
    return ''
  }

  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n')

  return jwt.sign({}, formattedPrivateKey, {
    algorithm: 'ES256',
    expiresIn: '3h',
    audience: 'https://appleid.apple.com',
    issuer: teamId,
    subject: appleId,
    keyid: keyId,
  })
}

export function getAppleClientSecret(input: AppleSecretInput): string {
  const signature = `${input.appleId}:${input.teamId}:${input.keyId}:${input.privateKey.slice(-12)}`
  const now = Date.now()

  if (cachedSecret && cachedExpiry > now && cachedSignature === signature) {
    return cachedSecret
  }

  const secret = generateAppleClientSecret(input)
  if (secret) {
    cachedSecret = secret
    cachedExpiry = now + CACHE_TTL_MS
    cachedSignature = signature
  }

  return secret
}
