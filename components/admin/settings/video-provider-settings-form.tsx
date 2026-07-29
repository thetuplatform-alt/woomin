'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Cloud, Zap } from 'lucide-react'
import { updateVideoProviderSettings } from '@/lib/actions/settings'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
import {
  getCloudVideoProviderOptions,
  getVideoProviderSettingsView,
  isVideoProviderDirty,
} from '@/lib/video-provider-ui'
import {
  CloudflareStreamSettingsForm,
  type CloudflareStreamSettingsViewData,
} from './cloudflare-stream-settings-form'
import {
  BunnyStreamSettingsForm,
  type BunnyStreamSettingsViewData,
} from './bunny-stream-settings-form'
import type { CloudVideoProvider } from '@/lib/video-provider-policy'

interface VideoProviderSettingsFormProps {
  initialProvider: 'youtube' | CloudVideoProvider
  cloudflareStreamSettings: CloudflareStreamSettingsViewData
  bunnyStreamSettings: BunnyStreamSettingsViewData
}

const providerIcons = {
  cloudflare: Cloud,
  bunny: Zap,
} as const

export function VideoProviderSettingsForm({
  initialProvider,
  cloudflareStreamSettings,
  bunnyStreamSettings,
}: VideoProviderSettingsFormProps) {
  const normalizedInitialProvider: CloudVideoProvider =
    initialProvider === 'bunny' ? 'bunny' : 'cloudflare'
  const [selectedProvider, setSelectedProvider] = useState<CloudVideoProvider>(
    normalizedInitialProvider
  )
  const [savedProvider, setSavedProvider] = useState<CloudVideoProvider>(
    normalizedInitialProvider
  )
  const [isPending, startTransition] = useTransition()
  const isDirty = isVideoProviderDirty(savedProvider, selectedProvider)
  const visibleSettings = getVideoProviderSettingsView(selectedProvider)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateVideoProviderSettings(selectedProvider)

      if (!result.success && result.error?.includes('會從媒體庫隱藏')) {
        const confirmed = window.confirm(`${result.error}\n\n要繼續切換嗎？`)
        if (!confirmed) return

        const confirmedResult = await updateVideoProviderSettings(selectedProvider, true)
        if (!confirmedResult.success) {
          toast.error(confirmedResult.error ?? '儲存失敗')
          return
        }
      } else if (!result.success) {
        toast.error(result.error ?? '儲存失敗')
        return
      }

      setSavedProvider(selectedProvider)
      toast.success('影片方案已儲存')
    })
  }

  return (
    <div id="section-video-provider" className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="rounded-xl border border-divider bg-white">
          <div className="p-6">
            <h2 className="text-lg font-bold text-heading">影片方案</h2>
            <p className="mt-1 text-sm text-body">
              Cloudflare Stream 與 Bunny Stream 只會有一個出現在媒體庫；YouTube 與 Vimeo 課程單元不受影響。
            </p>
          </div>
          <div className="border-t border-divider p-6">
            <p className="mb-3 text-sm font-medium text-heading">媒體庫生效方案</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {getCloudVideoProviderOptions().map(({ value, label, description }) => {
                const Icon = providerIcons[value]
                const isSelected = selectedProvider === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedProvider(value)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-cta bg-cta/5'
                        : 'border-divider hover:bg-surface'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-cta" />
                    <span>
                      <span className="block font-medium text-heading">{label}</span>
                      <span className="mt-1 block text-xs text-body">{description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-caption">
              切換時不會刪除影片，只會暫時從媒體庫列表隱藏另一方案的影片。
            </p>
          </div>
        </div>
        <StickySaveBar
          isDirty={isDirty}
          isPending={isPending}
          form="submit"
          label="儲存影片方案"
        />
      </form>

      {visibleSettings.showCloudflare && (
        <div className="rounded-xl border border-divider bg-white p-6">
          <h3 className="mb-6 text-base font-semibold text-heading">Cloudflare Stream 設定</h3>
          <CloudflareStreamSettingsForm initialData={cloudflareStreamSettings} />
        </div>
      )}
      {visibleSettings.showBunny && (
        <div className="rounded-xl border border-divider bg-white p-6">
          <h3 className="mb-6 text-base font-semibold text-heading">Bunny Stream 設定</h3>
          <BunnyStreamSettingsForm initialData={bunnyStreamSettings} />
        </div>
      )}
    </div>
  )
}
