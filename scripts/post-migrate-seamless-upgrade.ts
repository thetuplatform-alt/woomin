import './load-env'
import { prisma } from '../lib/prisma'
import { SETTING_KEYS } from '../lib/validations/settings'
import { buildSeamlessUpgradeDecision } from '../lib/seamless-upgrade'

async function main() {
  const relevantKeys = [
    SETTING_KEYS.STORAGE_DRIVER,
    SETTING_KEYS.VIDEO_PROVIDER,
    SETTING_KEYS.LOCAL_STORAGE_ROOT,
  ]

  const [settings, legacyCloudflareLesson, legacyObjectStorageMedia] = await Promise.all([
    prisma.siteSetting.findMany({
      where: { key: { in: relevantKeys } },
      select: { key: true, value: true },
    }),
    prisma.lesson.findFirst({
      where: {
        OR: [
          { videoProvider: 'CLOUDFLARE' },
          { videoId: { not: null } },
          { videoSourceId: { not: null } },
        ],
      },
      select: { id: true },
    }),
    prisma.media.findFirst({
      where: {
        type: { in: ['IMAGE', 'ATTACHMENT'] },
        NOT: {
          url: { startsWith: '/uploads/' },
        },
      },
      select: { id: true, url: true },
    }),
  ])

  const decision = buildSeamlessUpgradeDecision({
    settings,
    hasLegacyCloudflareLessons: !!legacyCloudflareLesson,
    hasLegacyObjectStorageMedia: !!legacyObjectStorageMedia,
    localStorageRootEnv: process.env.LOCAL_STORAGE_ROOT,
  })

  if (decision.updates.length === 0) {
    console.log('[seamless-upgrade] No SiteSetting backfill required')
    console.log(
      `[seamless-upgrade] Effective defaults: storage=${decision.inferredStorageDriver}, video=${decision.inferredVideoProvider}`
    )
    return
  }

  await prisma.$transaction(
    decision.updates.map((update) =>
      prisma.siteSetting.upsert({
        where: { key: update.key },
        update: { value: update.value },
        create: { key: update.key, value: update.value },
      })
    )
  )

  console.log('[seamless-upgrade] Applied SiteSetting backfill:')
  for (const update of decision.updates) {
    console.log(`- ${update.key}=${update.value} (${update.reason})`)
  }
}

main()
  .catch((error) => {
    console.error('[seamless-upgrade] Failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
