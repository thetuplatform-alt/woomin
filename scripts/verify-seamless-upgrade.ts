import assert from 'node:assert/strict'
import { SETTING_KEYS } from '../lib/validations/settings'
import { buildSeamlessUpgradeDecision } from '../lib/seamless-upgrade'

function main() {
  const envBackfill = buildSeamlessUpgradeDecision({
    settings: [],
    hasLegacyCloudflareLessons: false,
    hasLegacyObjectStorageMedia: false,
    env: {
      CLOUDFLARE_ACCOUNT_ID: 'account',
      CLOUDFLARE_API_TOKEN: 'token',
      CLOUDFLARE_STREAM_CUSTOMER_CODE: 'customer',
      CLOUDFLARE_R2_ACCESS_KEY_ID: 'key',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret',
      CLOUDFLARE_R2_BUCKET_NAME: 'bucket',
    },
    localStorageRootEnv: '/data/uploads',
  })

  assert.equal(envBackfill.inferredStorageDriver, 's3')
  assert.equal(envBackfill.inferredVideoProvider, 'cloudflare')
  assert.deepEqual(
    envBackfill.updates.map((update) => update.key).sort(),
    [SETTING_KEYS.STORAGE_DRIVER, SETTING_KEYS.VIDEO_PROVIDER].sort()
  )

  const legacyDataBackfill = buildSeamlessUpgradeDecision({
    settings: [],
    hasLegacyCloudflareLessons: true,
    hasLegacyObjectStorageMedia: true,
    env: {},
    localStorageRootEnv: '/data/uploads',
  })

  assert.equal(legacyDataBackfill.inferredStorageDriver, 's3')
  assert.equal(legacyDataBackfill.inferredVideoProvider, 'cloudflare')

  const storedSettingsNoop = buildSeamlessUpgradeDecision({
    settings: [
      { key: SETTING_KEYS.STORAGE_DRIVER, value: 's3' },
      { key: SETTING_KEYS.VIDEO_PROVIDER, value: 'cloudflare' },
    ],
    hasLegacyCloudflareLessons: true,
    hasLegacyObjectStorageMedia: true,
    env: {},
    localStorageRootEnv: '/data/uploads',
  })

  assert.equal(storedSettingsNoop.updates.length, 0)

  const localRootBackfill = buildSeamlessUpgradeDecision({
    settings: [],
    hasLegacyCloudflareLessons: false,
    hasLegacyObjectStorageMedia: false,
    env: {},
    localStorageRootEnv: '/persistent/uploads',
  })

  assert.equal(localRootBackfill.inferredStorageDriver, 'local')
  assert.equal(localRootBackfill.inferredVideoProvider, 'youtube')
  assert.deepEqual(
    localRootBackfill.updates.map((update) => update.key).sort(),
    [
      SETTING_KEYS.STORAGE_DRIVER,
      SETTING_KEYS.VIDEO_PROVIDER,
      SETTING_KEYS.LOCAL_STORAGE_ROOT,
    ].sort()
  )

  console.log('Seamless upgrade verification passed')
}

main()
