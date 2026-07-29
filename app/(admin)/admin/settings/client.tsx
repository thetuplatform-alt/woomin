'use client'

import { useState } from 'react'
import { Layout, Mail, Shield, Sparkles, HardDrive } from 'lucide-react'
import { SiteSettingsForm } from '@/components/admin/settings/site-settings-form'
import { AnalyticsSettingsForm } from '@/components/admin/settings/analytics-settings-form'
import {
  VideoProviderSettingsForm,
} from '@/components/admin/settings/video-provider-settings-form'
import type { CloudflareStreamSettingsViewData } from '@/components/admin/settings/cloudflare-stream-settings-form'
import type { BunnyStreamSettingsViewData } from '@/components/admin/settings/bunny-stream-settings-form'
import { EmailSettingsForm } from '@/components/admin/settings/email-settings-form'
import { SocialLoginSettingsForm } from '@/components/admin/settings/social-login-settings-form'
import { LayoutSettingsForm } from '@/components/admin/settings/layout-settings-form'
import { AISettingsForm } from '@/components/admin/settings/ai-settings-form'
import { SettingsSidebarNav } from '@/components/admin/settings/settings-sidebar-nav'
import { Badge } from '@/components/ui/badge'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { getSettingsSectionClass } from '@/lib/settings-page-tabs'

interface SettingsPageClientProps {
  siteSettings: Record<string, string>
  detectedDefaults: {
    videoProvider: 'youtube' | 'cloudflare' | 'bunny'
    storageDriver: 'local' | 's3'
    localStorageRoot: string
  }
  emailSettings: {
    resendApiKeyHint: string
    tosendApiKeyHint: string
    zsendApiKeyHint: string
    zsendDomain: string
    senderName: string
    fromEmail: string
    isConfigured: boolean
    emailProvider: 'resend' | 'smtp' | 'zsend' | 'tosend'
    resendConfigured: boolean
    tosendConfigured: boolean
    zsendConfigured: boolean
    smtp: {
      host: string
      port: string
      user: string
      passHint: string
      secure: boolean
      isConfigured: boolean
    }
    newsletter: {
      senderName: string
      replyTo: string
      footerName: string
      footerAddress: string
      footerEmail: string
      ratePerMinute: string
      lastCronHeartbeatAt: string
      domainStatus: string
    }
  }
  socialLoginSettings: {
    googleEnabled: boolean
    googleClientId: string
    googleClientSecretHint: string
    googleConfigured: boolean
    appleEnabled: boolean
    appleClientId: string
    appleTeamId: string
    appleKeyId: string
    applePrivateKeyHint: string
    appleConfigured: boolean
  }
  layoutSettings: {
    headerLeftLinks: string
    headerRightLinks: string
    footerDescription: string
    footerSections: string
  }
  aiSettings: {
    geminiApiKeyHint: string
    geminiModel: string
    isConfigured: boolean
  }
  cloudflareStreamSettings: CloudflareStreamSettingsViewData
  bunnyStreamSettings: BunnyStreamSettingsViewData
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="rounded-lg bg-primary/10 p-2">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-heading">{title}</h2>
        <p className="text-sm text-body">{description}</p>
      </div>
    </div>
  )
}

export function SettingsPageClient({
  siteSettings,
  detectedDefaults,
  emailSettings,
  socialLoginSettings,
  layoutSettings,
  aiSettings,
  cloudflareStreamSettings,
  bunnyStreamSettings,
}: SettingsPageClientProps) {
  const [activeSection, setActiveSection] = useState('basic')
  const currentStorageDriver =
    (siteSettings[SETTING_KEYS.STORAGE_DRIVER] as 'local' | 's3') ||
    detectedDefaults.storageDriver
  const currentLocalStorageRoot =
    siteSettings[SETTING_KEYS.LOCAL_STORAGE_ROOT] || detectedDefaults.localStorageRoot

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-heading">系統設定</h1>
        <p className="mt-1 text-body">
          這裡集中管理站點、版面、金流、Email、社群登入與 AI 設定。若你在 setup
          階段先跳過部分功能，之後可以回來這裡逐步補齊。
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pt-2 md:hidden">
        <SettingsSidebarNav
          variant="horizontal"
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 md:block" data-tour="settings-section-nav">
          <div className="sticky top-20">
            <SettingsSidebarNav
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-16">
          <section
            id="section-basic"
            className={getSettingsSectionClass(activeSection, 'basic')}
          >
            <SiteSettingsForm
              initialSettings={siteSettings}
              detectedDefaults={detectedDefaults}
            />
          </section>

          <section
            id="section-media"
            data-tour="settings-media-status"
            className={getSettingsSectionClass(activeSection, 'media')}
          >
            <SectionHeader
              icon={HardDrive}
              title="影音設定"
              description="在這裡管理 Cloudflare Stream，並查看目前圖片 / 附件的實際處理方式。"
            />
            <div className="space-y-6">
              <div className="rounded-xl border border-divider bg-white p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <HardDrive className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-heading">
                      圖片 / 附件處理狀態
                    </h3>
                    <p className="mt-1 text-sm text-body">
                      這一塊由部署環境決定，後台不提供切換，只顯示目前平台實際使用的方式。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-divider bg-surface/30 p-4">
                    <p className="text-xs text-caption">目前儲存方式</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className="bg-cta/10 text-cta hover:bg-cta/10">
                        {currentStorageDriver === 'local'
                          ? 'Local Storage'
                          : 'S3 Compatible Storage'}
                      </Badge>
                      <span className="text-xs text-body">
                        {currentStorageDriver === 'local'
                          ? '以本地永久資料夾為主'
                          : '以 S3 / R2 物件儲存為主'}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-divider bg-surface/30 p-4">
                    <p className="text-xs text-caption">本地儲存路徑</p>
                    <p className="mt-2 font-mono text-sm text-heading">
                      {currentLocalStorageRoot}
                    </p>
                    <p className="mt-1 text-xs text-caption">
                      公開讀取路徑固定為 `/uploads`。
                    </p>
                  </div>
                </div>
              </div>

              <VideoProviderSettingsForm
                initialProvider={
                  (siteSettings[SETTING_KEYS.VIDEO_PROVIDER] as 'youtube' | 'cloudflare' | 'bunny') ||
                  detectedDefaults.videoProvider
                }
                cloudflareStreamSettings={cloudflareStreamSettings}
                bunnyStreamSettings={bunnyStreamSettings}
              />
            </div>
          </section>

          <section
            id="section-analytics"
            className={getSettingsSectionClass(activeSection, 'analytics')}
          >
            <AnalyticsSettingsForm
              initialSettings={siteSettings}
              detectedDefaults={detectedDefaults}
            />
          </section>

          <section
            id="section-layout"
            className={getSettingsSectionClass(activeSection, 'layout')}
          >
            <SectionHeader
              icon={Layout}
              title="版面設定"
              description="管理 Header、Footer 導覽與頁尾內容。"
            />
            <div className="rounded-xl border border-divider bg-white p-6">
              <LayoutSettingsForm initialData={layoutSettings} />
            </div>
          </section>

          <section
            id="section-email"
            data-tour="settings-email-section"
            className={getSettingsSectionClass(activeSection, 'email')}
          >
            <SectionHeader
              icon={Mail}
              title="Email 設定"
              description="選擇 Zeabur Email、Resend 或 SMTP，再設定 API Key、連線資訊與寄件者資料。"
            />
            <EmailSettingsForm
              resendApiKeyHint={emailSettings.resendApiKeyHint}
              tosendApiKeyHint={emailSettings.tosendApiKeyHint}
              zsendApiKeyHint={emailSettings.zsendApiKeyHint}
              zsendDomain={emailSettings.zsendDomain}
              senderName={emailSettings.senderName}
              fromEmail={emailSettings.fromEmail}
              isConfigured={emailSettings.isConfigured}
              emailProvider={emailSettings.emailProvider}
              resendConfigured={emailSettings.resendConfigured}
              tosendConfigured={emailSettings.tosendConfigured}
              zsendConfigured={emailSettings.zsendConfigured}
              smtp={emailSettings.smtp}
              newsletter={emailSettings.newsletter}
            />
          </section>

          <section
            id="section-social-login"
            className={getSettingsSectionClass(activeSection, 'social-login')}
          >
            <SectionHeader
              icon={Shield}
              title="登入方式"
              description="設定 Google 與 Apple 登入，可在 setup 後補上。"
            />
            <SocialLoginSettingsForm initialData={socialLoginSettings} />
          </section>

          <section
            id="section-ai"
            data-tour="settings-ai-section"
            className={getSettingsSectionClass(activeSection, 'ai')}
          >
            <SectionHeader
              icon={Sparkles}
              title="AI 設定"
              description="設定 Gemini API Key 與模型，提供 AI 輔助功能。"
            />
            <AISettingsForm initialData={aiSettings} />
          </section>
        </div>
      </div>
    </div>
  )
}
