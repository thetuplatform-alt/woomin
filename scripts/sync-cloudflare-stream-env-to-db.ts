import './load-env'
import { prisma } from '../lib/prisma'
import { SETTING_KEYS } from '../lib/validations/settings'

const ENV_TO_SETTING_KEY = [
  {
    envKey: 'CLOUDFLARE_ACCOUNT_ID',
    settingKey: SETTING_KEYS.CLOUDFLARE_ACCOUNT_ID,
    label: 'Cloudflare Account ID',
  },
  {
    envKey: 'CLOUDFLARE_API_TOKEN',
    settingKey: SETTING_KEYS.CLOUDFLARE_API_TOKEN,
    label: 'Cloudflare API Token',
  },
  {
    envKey: 'CLOUDFLARE_STREAM_CUSTOMER_CODE',
    settingKey: SETTING_KEYS.CLOUDFLARE_STREAM_CUSTOMER_CODE,
    label: 'Cloudflare Stream Customer Code',
  },
  {
    envKey: 'CLOUDFLARE_STREAM_SIGNING_SECRET',
    settingKey: SETTING_KEYS.CLOUDFLARE_STREAM_SIGNING_SECRET,
    label: 'Cloudflare Stream Signing Secret',
  },
  {
    envKey: 'CLOUDFLARE_STREAM_WEBHOOK_SECRET',
    settingKey: SETTING_KEYS.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
    label: 'Cloudflare Stream Webhook Secret',
  },
] as const

function hasValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

async function main() {
  const existingSettings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: ENV_TO_SETTING_KEY.map((entry) => entry.settingKey),
      },
    },
    select: {
      key: true,
      value: true,
    },
  })

  const existingMap = new Map(existingSettings.map((item) => [item.key, item.value]))
  const updates = ENV_TO_SETTING_KEY.flatMap((entry) => {
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

  if (updates.length === 0) {
    console.log('[cloudflare-stream-sync] No env-to-db backfill required')
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

  console.log('[cloudflare-stream-sync] Backfilled Cloudflare Stream settings from environment variables:')
  for (const update of updates) {
    console.log(`- ${update.label} (${update.envKey} -> ${update.key})`)
  }
}

main()
  .catch((error) => {
    console.error('[cloudflare-stream-sync] Failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
