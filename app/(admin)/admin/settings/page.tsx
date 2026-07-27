import {
  getAISettings,
  getCloudflareStreamSettings,
  getBunnyStreamSettings,
  getEmailSettings,
  getLayoutSettings,
  getSiteSettings,
  getSocialLoginSettings,
} from '@/lib/actions/settings'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { detectDeploymentCapabilities } from '@/lib/deployment-capabilities'
import { SettingsPageClient } from './client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '系統設定 | 後台',
}

export default async function SettingsPage() {
  await requireOnlyAdminAuth()
  const capabilities = detectDeploymentCapabilities()
  const [
    siteSettings,
    emailSettings,
    socialLoginSettings,
    layoutSettings,
    aiSettings,
    cloudflareStreamSettings,
    bunnyStreamSettings,
  ] = await Promise.all([
    getSiteSettings(),
    getEmailSettings(),
    getSocialLoginSettings(),
    getLayoutSettings(),
    getAISettings(),
    getCloudflareStreamSettings(),
    getBunnyStreamSettings(),
  ])

  return (
    <SettingsPageClient
      siteSettings={siteSettings}
      detectedDefaults={{
        videoProvider: capabilities.inferredVideoProvider,
        storageDriver: capabilities.inferredStorageDriver,
        localStorageRoot: process.env.LOCAL_STORAGE_ROOT || '/data/uploads',
      }}
      emailSettings={emailSettings}
      socialLoginSettings={socialLoginSettings}
      layoutSettings={layoutSettings}
      aiSettings={aiSettings}
      cloudflareStreamSettings={cloudflareStreamSettings}
      bunnyStreamSettings={bunnyStreamSettings}
    />
  )
}
