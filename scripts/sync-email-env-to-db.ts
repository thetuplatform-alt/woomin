import './load-env'
import { prisma } from '../lib/prisma'
import { SETTING_KEYS } from '../lib/validations/settings'

const ENV_TO_SETTING_KEY = [
  {
    envKey: 'RESEND_API_KEY',
    settingKey: SETTING_KEYS.RESEND_API_KEY,
    label: 'Resend API Key',
  },
  {
    envKey: 'TOSEND_API_KEY',
    settingKey: SETTING_KEYS.TOSEND_API_KEY,
    label: 'ToSend API Key',
  },
  {
    envKey: 'EMAIL_FROM',
    settingKey: SETTING_KEYS.EMAIL_FROM,
    label: 'Email From',
  },
  {
    envKey: 'SMTP_HOST',
    settingKey: SETTING_KEYS.SMTP_HOST,
    label: 'SMTP Host',
  },
  {
    envKey: 'SMTP_PORT',
    settingKey: SETTING_KEYS.SMTP_PORT,
    label: 'SMTP Port',
  },
  {
    envKey: 'SMTP_USER',
    settingKey: SETTING_KEYS.SMTP_USER,
    label: 'SMTP User',
  },
  {
    envKey: 'SMTP_PASS',
    settingKey: SETTING_KEYS.SMTP_PASS,
    label: 'SMTP Password',
  },
  {
    envKey: 'SMTP_SECURE',
    settingKey: SETTING_KEYS.SMTP_SECURE,
    label: 'SMTP Secure',
  },
] as const

function hasValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

async function main() {
  const existingSettings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: [
          SETTING_KEYS.EMAIL_PROVIDER,
          ...ENV_TO_SETTING_KEY.map((entry) => entry.settingKey),
        ],
      },
    },
    select: {
      key: true,
      value: true,
    },
  })

  const existingMap = new Map(existingSettings.map((item) => [item.key, item.value]))
  const updates: Array<{
    key: string
    value: string
    label: string
    envKey: string
  }> = ENV_TO_SETTING_KEY.flatMap((entry) => {
    const envValue = process.env[entry.envKey]?.trim()
    const existingValue = existingMap.get(entry.settingKey)?.trim() || ''

    if (!hasValue(envValue) || hasValue(existingValue)) {
      return []
    }

    return [
      {
        key: entry.settingKey,
        value: envValue,
        label: entry.label,
        envKey: entry.envKey,
      },
    ]
  })
  const existingProvider = existingMap.get(SETTING_KEYS.EMAIL_PROVIDER)?.trim() || ''

  if (
    !hasValue(existingProvider) &&
    hasValue(process.env.TOSEND_API_KEY?.trim()) &&
    !hasValue(process.env.ZSEND_API_KEY?.trim()) &&
    !hasValue(process.env.RESEND_API_KEY?.trim()) &&
    !hasValue(process.env.SMTP_HOST?.trim())
  ) {
    updates.push({
      key: SETTING_KEYS.EMAIL_PROVIDER,
      value: 'tosend',
      label: 'Email Provider',
      envKey: 'TOSEND_API_KEY',
    })
  }

  if (updates.length === 0) {
    console.log('[email-sync] No env-to-db backfill required')
    return
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.siteSetting.upsert({
        where: { key: update.key },
        update: { value: update.value },
        create: { key: update.key, value: update.value },
      })
    )
  )

  console.log('[email-sync] Backfilled email settings from environment variables:')
  for (const update of updates) {
    console.log(`- ${update.label} (${update.envKey} -> ${update.key})`)
  }
}

main()
  .catch((error) => {
    console.error('[email-sync] Failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
