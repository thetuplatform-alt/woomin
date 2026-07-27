'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ShieldAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  CloudflareStreamSettingsForm,
  type CloudflareStreamSettingsViewData,
} from '@/components/admin/settings/cloudflare-stream-settings-form'
import { getCloudflareStreamSettings } from '@/lib/actions/settings'

interface CloudflareStreamSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMPTY_DATA: CloudflareStreamSettingsViewData = {
  accountId: '',
  customerCode: '',
  apiTokenHint: '',
  signingSecretHint: '',
  webhookSecretHint: '',
  isUploadConfigured: false,
  isPlaybackConfigured: false,
  isSigningConfigured: false,
  isWebhookConfigured: false,
}

export function CloudflareStreamSetupDialog({
  open,
  onOpenChange,
}: CloudflareStreamSetupDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<CloudflareStreamSettingsViewData>(EMPTY_DATA)

  useEffect(() => {
    if (!open) return

    let active = true
    setIsLoading(true)

    void getCloudflareStreamSettings()
      .then((result) => {
        if (!active) return
        setData(result)
      })
      .catch((error) => {
        console.error('載入 Cloudflare Stream 設定失敗:', error)
        toast.error('載入 Cloudflare Stream 設定失敗')
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden rounded-xl border-divider bg-white p-0">
        <DialogHeader className="shrink-0 border-b border-divider px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-heading">
            <ShieldAlert className="h-5 w-5 text-cta" />
            設定 Cloudflare Stream
          </DialogTitle>
          <DialogDescription className="text-body">
            完成後就能直接上傳平台託管影片、使用受保護播放，並接收影片轉檔通知。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-caption" />
            </div>
          ) : (
            <CloudflareStreamSettingsForm
              initialData={data}
              submitLabel="儲存並重新檢查"
              onSaved={(latest) => {
                setData(latest)
                router.refresh()
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface CloudflareStreamSetupPromptProps {
  title?: string
  description?: string
  buttonLabel?: string
  onOpenSetup: () => void
}

export function CloudflareStreamSetupPrompt({
  title = '尚未設定 Cloudflare Stream',
  description = '請先完成 Cloudflare Stream 設定，之後就能直接上傳平台託管影片與播放課程影片。',
  buttonLabel = '現在設定',
  onOpenSetup,
}: CloudflareStreamSetupPromptProps) {
  return (
    <div className="rounded-xl border border-divider bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-cta/10 p-2">
          <ShieldAlert className="h-5 w-5 text-cta" />
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-heading">{title}</p>
            <p className="mt-1 text-sm text-body">{description}</p>
          </div>
          <Button
            type="button"
            onClick={onOpenSetup}
            className="rounded-lg bg-cta text-white hover:bg-cta-hover"
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
