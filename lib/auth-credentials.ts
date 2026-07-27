import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'

export interface GoogleCredentials {
  enabled: boolean
  clientId: string
  clientSecret: string
  isConfigured: boolean
}

export interface AppleCredentials {
  enabled: boolean
  appleId: string
  teamId: string
  keyId: string
  privateKey: string
  isConfigured: boolean
}

export async function getGoogleCredentials(): Promise<GoogleCredentials> {
  const envClientId = process.env.AUTH_GOOGLE_ID || ''
  const envClientSecret = process.env.AUTH_GOOGLE_SECRET || ''

  try {
    const settings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.GOOGLE_OAUTH_ENABLED,
            SETTING_KEYS.GOOGLE_CLIENT_ID,
            SETTING_KEYS.GOOGLE_CLIENT_SECRET,
          ],
        },
      },
    })

    const map = new Map(settings.map((setting) => [setting.key, setting.value]))
    const clientId = map.get(SETTING_KEYS.GOOGLE_CLIENT_ID) || envClientId
    const clientSecret =
      map.get(SETTING_KEYS.GOOGLE_CLIENT_SECRET) || envClientSecret
    const hasDbToggle = map.has(SETTING_KEYS.GOOGLE_OAUTH_ENABLED)
    const enabled = hasDbToggle
      ? map.get(SETTING_KEYS.GOOGLE_OAUTH_ENABLED) === 'true'
      : !!(clientId && clientSecret)

    return {
      enabled,
      clientId,
      clientSecret,
      isConfigured: enabled && !!(clientId && clientSecret),
    }
  } catch {
    return {
      enabled: !!(envClientId && envClientSecret),
      clientId: envClientId,
      clientSecret: envClientSecret,
      isConfigured: !!(envClientId && envClientSecret),
    }
  }
}

export async function getAppleCredentials(): Promise<AppleCredentials> {
  const envAppleId = process.env.AUTH_APPLE_ID || ''
  const envTeamId = process.env.AUTH_APPLE_TEAM_ID || ''
  const envKeyId = process.env.AUTH_APPLE_KEY_ID || ''
  const envPrivateKey = process.env.AUTH_APPLE_PRIVATE_KEY || ''

  try {
    const settings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.APPLE_OAUTH_ENABLED,
            SETTING_KEYS.APPLE_CLIENT_ID,
            SETTING_KEYS.APPLE_TEAM_ID,
            SETTING_KEYS.APPLE_KEY_ID,
            SETTING_KEYS.APPLE_PRIVATE_KEY,
          ],
        },
      },
    })

    const map = new Map(settings.map((setting) => [setting.key, setting.value]))
    const appleId = map.get(SETTING_KEYS.APPLE_CLIENT_ID) || envAppleId
    const teamId = map.get(SETTING_KEYS.APPLE_TEAM_ID) || envTeamId
    const keyId = map.get(SETTING_KEYS.APPLE_KEY_ID) || envKeyId
    const privateKey =
      map.get(SETTING_KEYS.APPLE_PRIVATE_KEY) || envPrivateKey
    const hasDbToggle = map.has(SETTING_KEYS.APPLE_OAUTH_ENABLED)
    const enabled = hasDbToggle
      ? map.get(SETTING_KEYS.APPLE_OAUTH_ENABLED) === 'true'
      : !!(appleId && teamId && keyId && privateKey)

    return {
      enabled,
      appleId,
      teamId,
      keyId,
      privateKey,
      isConfigured: enabled && !!(appleId && teamId && keyId && privateKey),
    }
  } catch {
    return {
      enabled: !!(envAppleId && envTeamId && envKeyId && envPrivateKey),
      appleId: envAppleId,
      teamId: envTeamId,
      keyId: envKeyId,
      privateKey: envPrivateKey,
      isConfigured: !!(envAppleId && envTeamId && envKeyId && envPrivateKey),
    }
  }
}
