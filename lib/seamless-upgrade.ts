import { SETTING_KEYS } from '@/lib/validations/settings'
import {
  detectDeploymentCapabilities,
  type SetupVideoProvider,
} from '@/lib/deployment-capabilities'
import type { StorageDriver } from '@/lib/storage'

export interface UpgradeSettingSnapshot {
  key: string
  value: string
}

export interface SeamlessUpgradeInputs {
  settings: UpgradeSettingSnapshot[]
  hasLegacyCloudflareLessons: boolean
  hasLegacyObjectStorageMedia: boolean
  localStorageRootEnv?: string
  env?: Record<string, string | undefined>
}

export interface SeamlessUpgradeDecision {
  inferredStorageDriver: StorageDriver
  inferredVideoProvider: SetupVideoProvider
  updates: Array<{ key: string; value: string; reason: string }>
}

export function buildSeamlessUpgradeDecision(
  input: SeamlessUpgradeInputs
): SeamlessUpgradeDecision {
  const settingsMap = new Map(input.settings.map((setting) => [setting.key, setting.value]))
  const capabilities = detectDeploymentCapabilities(input.env)

  const hasStoredStorageDriver = !!settingsMap.get(SETTING_KEYS.STORAGE_DRIVER)?.trim()
  const hasStoredVideoProvider = !!settingsMap.get(SETTING_KEYS.VIDEO_PROVIDER)?.trim()
  const hasStoredLocalRoot = !!settingsMap.get(SETTING_KEYS.LOCAL_STORAGE_ROOT)?.trim()

  const inferredStorageDriver: StorageDriver =
    capabilities.hasObjectStorageEnv || input.hasLegacyObjectStorageMedia ? 's3' : 'local'

  const inferredVideoProvider: SetupVideoProvider =
    capabilities.prefersCloudflareStream || input.hasLegacyCloudflareLessons
      ? 'cloudflare'
      : 'youtube'

  const updates: Array<{ key: string; value: string; reason: string }> = []

  if (!hasStoredStorageDriver) {
    updates.push({
      key: SETTING_KEYS.STORAGE_DRIVER,
      value: inferredStorageDriver,
      reason:
        inferredStorageDriver === 's3'
          ? 'Detected legacy S3/R2 configuration or media URLs during upgrade'
          : 'No legacy object storage configuration detected during upgrade',
    })
  }

  if (!hasStoredVideoProvider) {
    updates.push({
      key: SETTING_KEYS.VIDEO_PROVIDER,
      value: inferredVideoProvider,
      reason:
        inferredVideoProvider === 'cloudflare'
          ? 'Detected legacy Cloudflare Stream configuration or lessons during upgrade'
          : 'No legacy Cloudflare Stream configuration detected during upgrade',
    })
  }

  if (
    inferredStorageDriver === 'local' &&
    !hasStoredLocalRoot &&
    input.localStorageRootEnv?.trim()
  ) {
    updates.push({
      key: SETTING_KEYS.LOCAL_STORAGE_ROOT,
      value: input.localStorageRootEnv.trim(),
      reason: 'Persisted LOCAL_STORAGE_ROOT into SiteSetting during upgrade',
    })
  }

  return {
    inferredStorageDriver,
    inferredVideoProvider,
    updates,
  }
}
