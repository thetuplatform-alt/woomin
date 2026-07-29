// app/(setup)/admin/setup/page.tsx
// 系統初始化頁面
// 類似 Ghost 的初始化機制，首次部署時引導用戶完成基本設定
// 此頁面放在獨立 route group 中，不受 admin layout 的權限檢查限制

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { checkNeedsSetup } from '@/lib/actions/setup'
import { detectDeploymentCapabilities } from '@/lib/deployment-capabilities'
import { getCloudflareStreamConfigStatus } from '@/lib/cloudflare-stream-config'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { SetupClient } from './setup-client'

async function detectPreConfiguredEmail(): Promise<{
  preConfigured: boolean
  provider: 'resend' | 'smtp' | 'zsend' | 'tosend' | null
  zsendDomain: string
}> {
  const settings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: [
          SETTING_KEYS.EMAIL_PROVIDER,
          SETTING_KEYS.ZSEND_API_KEY,
          SETTING_KEYS.TOSEND_API_KEY,
          SETTING_KEYS.RESEND_API_KEY,
          SETTING_KEYS.SMTP_HOST,
          SETTING_KEYS.ZSEND_DOMAIN,
        ],
      },
    },
  })
  const map = new Map(settings.map((s) => [s.key, s.value]))
  const provider = map.get(SETTING_KEYS.EMAIL_PROVIDER) || process.env.EMAIL_PROVIDER || ''
  const zsendKey = map.get(SETTING_KEYS.ZSEND_API_KEY) || process.env.ZSEND_API_KEY || ''
  const tosendKey = map.get(SETTING_KEYS.TOSEND_API_KEY) || process.env.TOSEND_API_KEY || ''
  const resendKey = map.get(SETTING_KEYS.RESEND_API_KEY) || process.env.RESEND_API_KEY || ''
  const smtpHost = map.get(SETTING_KEYS.SMTP_HOST) || process.env.SMTP_HOST || ''
  const zsendDomain = map.get(SETTING_KEYS.ZSEND_DOMAIN) || ''

  if (provider === 'zsend' && zsendKey) {
    return { preConfigured: true, provider: 'zsend', zsendDomain }
  }
  if (provider === 'tosend' && tosendKey) {
    return { preConfigured: true, provider: 'tosend', zsendDomain }
  }
  if (provider === 'smtp' && smtpHost) {
    return { preConfigured: true, provider: 'smtp', zsendDomain }
  }
  if (provider === 'resend' && resendKey) {
    return { preConfigured: true, provider: 'resend', zsendDomain }
  }
  if (zsendKey) {
    return { preConfigured: true, provider: 'zsend', zsendDomain }
  }
  if (tosendKey) {
    return { preConfigured: true, provider: 'tosend', zsendDomain }
  }
  if (resendKey) {
    return { preConfigured: true, provider: 'resend', zsendDomain }
  }
  if (smtpHost) {
    return { preConfigured: true, provider: 'smtp', zsendDomain }
  }

  return { preConfigured: false, provider: null, zsendDomain: '' }
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '系統初始化',
}

export default async function SetupPage() {
  const capabilities = detectDeploymentCapabilities()
  const cloudflareStream = await getCloudflareStreamConfigStatus()
  const emailStatus = await detectPreConfiguredEmail()

  // 檢查是否需要初始化
  const needsSetup = await checkNeedsSetup()

  if (!needsSetup) {
    // 已有管理員，檢查當前用戶是否有權限進入後台
    const session = await auth()
    const role = session?.user?.role
    if (role === 'ADMIN' || role === 'INSTRUCTOR' || role === 'EDITOR') {
      redirect('/admin')
    }
    // 非管理員用戶，導回首頁
    redirect('/')
  }

  // 檢查用戶是否已登入
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/setup')
  }

  return (
    <SetupClient
      user={{
        name: session.user.name || '',
        email: session.user.email || '',
      }}
      detectedDefaults={{
        videoProvider: cloudflareStream.isConfigured
          ? 'cloudflare'
          : capabilities.inferredVideoProvider,
        storageDriver: capabilities.inferredStorageDriver,
        localStorageRoot: process.env.LOCAL_STORAGE_ROOT || '/data/uploads',
        hasObjectStorageEnv: capabilities.hasObjectStorageEnv,
        hasCloudflareStreamEnv: cloudflareStream.isConfigured,
        hasCloudflareSigningEnv: cloudflareStream.hasSigningConfig,
        hasCloudflareWebhookEnv: cloudflareStream.hasWebhookConfig,
        emailPreConfigured: emailStatus.preConfigured,
        emailPreConfiguredProvider: emailStatus.provider,
        emailPreConfiguredDomain: emailStatus.zsendDomain,
      }}
    />
  )
}
