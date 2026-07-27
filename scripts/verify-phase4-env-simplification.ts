import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { getAppUrl, getAppUrlFromRequest, getStoredAppUrl } from '../lib/app-url'
import { getAuthSecret } from '../lib/auth-secret'
import { getAppleCredentials, getGoogleCredentials } from '../lib/auth-credentials'
import { authConfig } from '../lib/auth.config'

async function main() {
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    APP_URL: process.env.APP_URL,
    SITE_URL: process.env.SITE_URL,
    AUTH_URL: process.env.AUTH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    ZEABUR_URL: process.env.ZEABUR_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_APPLE_ID: process.env.AUTH_APPLE_ID,
    AUTH_APPLE_TEAM_ID: process.env.AUTH_APPLE_TEAM_ID,
    AUTH_APPLE_KEY_ID: process.env.AUTH_APPLE_KEY_ID,
    AUTH_APPLE_PRIVATE_KEY: process.env.AUTH_APPLE_PRIVATE_KEY,
  }

  const originalFindUnique = prisma.siteSetting.findUnique.bind(prisma.siteSetting)
  const originalFindMany = prisma.siteSetting.findMany.bind(prisma.siteSetting)

  try {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.APP_URL
    delete process.env.SITE_URL
    delete process.env.AUTH_URL
    delete process.env.VERCEL_URL
    delete process.env.ZEABUR_URL
    delete process.env.AUTH_SECRET
    delete process.env.NEXTAUTH_SECRET
    delete process.env.AUTH_GOOGLE_ID
    delete process.env.AUTH_GOOGLE_SECRET
    delete process.env.AUTH_APPLE_ID
    delete process.env.AUTH_APPLE_TEAM_ID
    delete process.env.AUTH_APPLE_KEY_ID
    delete process.env.AUTH_APPLE_PRIVATE_KEY
    process.env.DATABASE_URL = 'postgresql://demo:demo@localhost:5432/course_platform'

    prisma.siteSetting.findUnique = ((async (args: { where: { key: string } }) => {
      if (args.where.key === 'site_url') {
        return { value: 'https://db.example.com' } as { value: string }
      }

      return null
    }) as unknown) as typeof prisma.siteSetting.findUnique

    prisma.siteSetting.findMany = ((async (args: { where?: { key?: { in?: string[] } } }) => {
      const keys = args.where?.key?.in || []

      if (keys.includes('google_oauth_enabled')) {
        return [
          { key: 'google_oauth_enabled', value: 'true' },
          { key: 'google_client_id', value: 'google-db-client' },
          { key: 'google_client_secret', value: 'google-db-secret' },
        ] as Array<{ key: string; value: string }>
      }

      if (keys.includes('apple_oauth_enabled')) {
        return [
          { key: 'apple_oauth_enabled', value: 'true' },
          { key: 'apple_client_id', value: 'apple.db.client' },
          { key: 'apple_team_id', value: 'APPLETEAMID' },
          { key: 'apple_key_id', value: 'APPLEKEYID' },
          {
            key: 'apple_private_key',
            value:
              '-----BEGIN PRIVATE KEY-----\\nTESTKEY\\n-----END PRIVATE KEY-----',
          },
        ] as Array<{ key: string; value: string }>
      }

      return [] as Array<{ key: string; value: string }>
    }) as unknown) as typeof prisma.siteSetting.findMany

    const derivedSecretA = getAuthSecret()
    const derivedSecretB = getAuthSecret()
    assert.equal(derivedSecretA, derivedSecretB, 'auth secret should be stable without env secret')
    assert.notEqual(
      derivedSecretA,
      'course-realms-dev-secret',
      'database url should override development fallback'
    )

    assert.equal(
      getAppUrl(),
      'http://localhost:3000',
      'app url should fall back to localhost when no platform env is present'
    )

    assert.equal(
      await getStoredAppUrl(),
      'https://db.example.com',
      'stored app url should fall back to SITE_URL from database before localhost'
    )

    const request = new Request('https://ignored.example/path', {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'courses.example.com',
      },
    })

    assert.equal(
      await getAppUrlFromRequest(request),
      'https://courses.example.com',
      'request origin should take precedence over db and env fallbacks'
    )

    const googleCreds = await getGoogleCredentials()
    assert.deepEqual(
      googleCreds,
      {
        enabled: true,
        clientId: 'google-db-client',
        clientSecret: 'google-db-secret',
        isConfigured: true,
      },
      'google credentials should load from database settings'
    )

    const appleCreds = await getAppleCredentials()
    assert.equal(appleCreds.enabled, true, 'apple oauth should honor database toggle')
    assert.equal(appleCreds.appleId, 'apple.db.client', 'apple client id should load from database')
    assert.equal(appleCreds.teamId, 'APPLETEAMID', 'apple team id should load from database')
    assert.equal(appleCreds.keyId, 'APPLEKEYID', 'apple key id should load from database')
    assert.equal(
      appleCreds.privateKey,
      '-----BEGIN PRIVATE KEY-----\\nTESTKEY\\n-----END PRIVATE KEY-----',
      'apple private key should load from database'
    )
    assert.equal(appleCreds.isConfigured, true, 'apple credentials should be marked configured')

    assert.equal(authConfig.pages?.signIn, '/login', 'auth config should load without AUTH_URL')
    assert.equal(authConfig.pages?.error, '/login', 'auth error page should load without AUTH_URL')
    assert.equal(authConfig.session?.strategy, 'jwt', 'auth config should keep jwt sessions')
    assert.equal(authConfig.trustHost, true, 'auth config should trust hosted request hosts by default')
    assert.equal(typeof authConfig.callbacks?.authorized, 'function', 'auth callbacks should be available without AUTH_URL')

    console.log('Phase 4 env simplification verification passed')
  } finally {
    prisma.siteSetting.findUnique = originalFindUnique
    prisma.siteSetting.findMany = originalFindMany
    process.env.DATABASE_URL = originalEnv.DATABASE_URL
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL
    process.env.APP_URL = originalEnv.APP_URL
    process.env.SITE_URL = originalEnv.SITE_URL
    process.env.AUTH_URL = originalEnv.AUTH_URL
    process.env.VERCEL_URL = originalEnv.VERCEL_URL
    process.env.ZEABUR_URL = originalEnv.ZEABUR_URL
    process.env.AUTH_SECRET = originalEnv.AUTH_SECRET
    process.env.NEXTAUTH_SECRET = originalEnv.NEXTAUTH_SECRET
    process.env.AUTH_GOOGLE_ID = originalEnv.AUTH_GOOGLE_ID
    process.env.AUTH_GOOGLE_SECRET = originalEnv.AUTH_GOOGLE_SECRET
    process.env.AUTH_APPLE_ID = originalEnv.AUTH_APPLE_ID
    process.env.AUTH_APPLE_TEAM_ID = originalEnv.AUTH_APPLE_TEAM_ID
    process.env.AUTH_APPLE_KEY_ID = originalEnv.AUTH_APPLE_KEY_ID
    process.env.AUTH_APPLE_PRIVATE_KEY = originalEnv.AUTH_APPLE_PRIVATE_KEY
  }
}

main()
