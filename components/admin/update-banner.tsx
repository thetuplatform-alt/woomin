'use client'

import { useState, useEffect } from 'react'
import { X, ArrowUpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PlatformUpdateInfo } from '@/lib/actions/platform-update'

interface UpdateBannerProps {
  updateInfo: PlatformUpdateInfo | null
}

const DISMISSED_KEY = 'platform-update-dismissed-version'

export function UpdateBanner({ updateInfo }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (!updateInfo?.hasUpdate || !updateInfo.latestVersion) return
    const dismissedVersion = localStorage.getItem(DISMISSED_KEY)
    if (dismissedVersion !== updateInfo.latestVersion) {
      setDismissed(false)
    }
  }, [updateInfo])

  if (!updateInfo?.hasUpdate || !updateInfo.latestVersion || dismissed) {
    return null
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, updateInfo.latestVersion!)
    setDismissed(true)
  }

  // Extract first line of summary as preview
  const summaryPreview = updateInfo.summary
    ?.split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .slice(0, 2)
    .join(' ')
    .slice(0, 120)

  return (
    <div className="relative rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <ArrowUpCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-blue-900">平台更新可用</span>
            <span className="text-sm text-blue-700">
              v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
            </span>
          </div>
          {summaryPreview && (
            <p className="text-sm text-blue-700 mt-1 truncate">{summaryPreview}</p>
          )}
          <p className="text-sm text-blue-600 mt-2">
            使用 Claude Code 執行{' '}
            <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">
              /upgrade-platform
            </code>{' '}
            進行升級
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-blue-400 hover:text-blue-600 hover:bg-blue-100"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
