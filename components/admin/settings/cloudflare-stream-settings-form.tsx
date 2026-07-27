'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  ChevronDown,
  Loader2,
  Plug,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import {
  cloudflareStreamSettingsSchema,
  type CloudflareStreamSettingsFormData,
} from '@/lib/validations/settings'
import {
  getCloudflareStreamSettings,
  testCloudflareStreamConnection,
  updateCloudflareStreamSettings,
} from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

export interface CloudflareStreamSettingsViewData {
  accountId: string
  customerCode: string
  apiTokenHint: string
  signingSecretHint: string
  webhookSecretHint: string
  isUploadConfigured: boolean
  isPlaybackConfigured: boolean
  isSigningConfigured: boolean
  isWebhookConfigured: boolean
}

interface CloudflareStreamSettingsFormProps {
  initialData: CloudflareStreamSettingsViewData
  submitLabel?: string
  onSaved?: (data: CloudflareStreamSettingsViewData) => void
}

function generateSecret() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

interface FieldCardProps {
  label: string
  description: string
  helper: string
  children: ReactNode
}

function FieldCard({ label, description, helper, children }: FieldCardProps) {
  return (
    <div className="rounded-xl border border-divider bg-white p-4">
      <Label className="text-heading">{label}</Label>
      <p className="mt-2 text-sm text-body">{description}</p>
      <div className="mt-3">{children}</div>
      <p className="mt-2 text-xs leading-5 text-caption">{helper}</p>
    </div>
  )
}

export function CloudflareStreamSettingsForm({
  initialData,
  submitLabel = '儲存設定',
  onSaved,
}: CloudflareStreamSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [viewData, setViewData] = useState(initialData)
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initialData.isSigningConfigured || initialData.isWebhookConfigured)
  )
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const form = useForm<CloudflareStreamSettingsFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(cloudflareStreamSettingsSchema) as any,
    defaultValues: {
      accountId: initialData.accountId,
      apiToken: initialData.apiTokenHint,
      customerCode: initialData.customerCode,
      signingSecret: initialData.signingSecretHint,
      webhookSecret: initialData.webhookSecretHint,
    },
  })

  useEffect(() => {
    setViewData(initialData)
    if (initialData.isSigningConfigured || initialData.isWebhookConfigured) {
      setShowAdvanced(true)
    }
  }, [initialData])

  useEffect(() => {
    form.reset({
      accountId: viewData.accountId,
      apiToken: viewData.apiTokenHint,
      customerCode: viewData.customerCode,
      signingSecret: viewData.signingSecretHint,
      webhookSecret: viewData.webhookSecretHint,
    })
  }, [form, viewData])

  useEffect(() => {
    const signingSecret = form.getValues('signingSecret')
    if (!signingSecret) {
      form.setValue('signingSecret', generateSecret(), { shouldDirty: false })
    }

    const webhookSecret = form.getValues('webhookSecret')
    if (!webhookSecret) {
      form.setValue('webhookSecret', generateSecret(), { shouldDirty: false })
    }
  }, [form, viewData])

  const loadLatest = async () => {
    const latest = await getCloudflareStreamSettings()
    setViewData(latest)
    form.reset({
      accountId: latest.accountId,
      apiToken: latest.apiTokenHint,
      customerCode: latest.customerCode,
      signingSecret: latest.signingSecretHint,
      webhookSecret: latest.webhookSecretHint,
    })
    onSaved?.(latest)
  }

  async function onSubmit(values: CloudflareStreamSettingsFormData) {
    const dirtyFields = form.formState.dirtyFields
    const payload: CloudflareStreamSettingsFormData = {
      ...values,
      apiTokenTouched: Boolean(dirtyFields.apiToken),
      signingSecretTouched: Boolean(dirtyFields.signingSecret),
      webhookSecretTouched: Boolean(dirtyFields.webhookSecret),
    }

    startTransition(async () => {
      const result = await updateCloudflareStreamSettings(payload)

      if (!result.success) {
        toast.error(result.error || '儲存 Cloudflare Stream 設定失敗')
        return
      }

      await loadLatest()
      toast.success('Cloudflare Stream 設定已更新')
    })
  }

  async function onTestConnection() {
    setIsTestingConnection(true)
    setConnectionResult(null)

    try {
      const values = form.getValues()
      const result = await testCloudflareStreamConnection({
        accountId: values.accountId,
        apiToken: values.apiToken,
      })

      setConnectionResult(result)

      if (result.success) {
        toast.success('Cloudflare Stream 連線成功')
      } else {
        toast.error(result.message)
      }
    } catch {
      const fallback = {
        success: false,
        message: 'Cloudflare Stream 連線測試失敗，請稍後再試。',
      }
      setConnectionResult(fallback)
      toast.error(fallback.message)
    } finally {
      setIsTestingConnection(false)
    }
  }

  const isCoreConfigured =
    viewData.isUploadConfigured && viewData.isPlaybackConfigured
  const accountIdValue = form.watch('accountId')
  const apiTokenValue = form.watch('apiToken')
  const shouldReenterTokenHint =
    initialData.accountId &&
    accountIdValue?.trim() !== initialData.accountId &&
    apiTokenValue === initialData.apiTokenHint

  const setGeneratedSecret = (
    field: 'signingSecret' | 'webhookSecret'
  ) => {
    form.setValue(field, generateSecret(), {
      shouldDirty: true,
      shouldTouch: true,
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <Badge
        className={
          isCoreConfigured
            ? 'bg-green-50 text-green-700 hover:bg-green-50'
            : 'bg-amber-50 text-amber-700 hover:bg-amber-50'
        }
      >
        {isCoreConfigured ? '已可開始使用' : '請先完成設定'}
      </Badge>

      <div className="space-y-4">
        <FieldCard
          label="Cloudflare Account ID"
          description="到 Cloudflare Dashboard 的帳號資訊頁，找到你的 Account ID，再貼到這裡。"
          helper="這個值用來呼叫 Cloudflare Stream API，通常是一段英數字識別碼。"
        >
          <Input
            {...form.register('accountId')}
            placeholder="例如：Cloudflare 帳號頁看到的 Account ID"
            className="border-divider bg-white text-heading"
          />
        </FieldCard>

        <FieldCard
          label="Stream Customer Code"
          description="到 Cloudflare Stream 的播放器網域或影片播放設定頁，找到 `customer-xxx.cloudflarestream.com` 裡的 `xxx`。"
          helper="這個值會用來產生影片播放網址與縮圖網址。"
        >
          <Input
            {...form.register('customerCode')}
            placeholder="例如：customer-abc123.cloudflarestream.com 裡的 abc123"
            className="border-divider bg-white text-heading"
          />
        </FieldCard>

        <FieldCard
          label="API Token"
          description="到 Cloudflare 的 API Tokens 建立一組可管理 Stream 的 token，再把它貼到這裡。"
          helper="這個 token 會用於建立上傳網址、同步影片資訊、刪除影片與其他後台管理操作。"
        >
          <Input
            {...form.register('apiToken')}
            placeholder="請貼上可管理 Cloudflare Stream 的 API Token"
            className="border-divider bg-white text-heading"
          />
          {shouldReenterTokenHint ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              你剛剛修改了 Account ID。為了避免帳號與 token 不匹配，建議把 API Token 重新貼一次。
            </div>
          ) : null}
        </FieldCard>

        <Collapsible
          open={showAdvanced}
          onOpenChange={setShowAdvanced}
          className="rounded-xl border border-divider bg-white"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-heading">進階設定（選填）</p>
                <p className="mt-1 text-sm text-body">
                  只有在你要啟用受保護播放或 webhook 驗證時，才需要填下面兩個欄位。
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-caption transition-transform ${showAdvanced ? 'rotate-180' : ''
                  }`}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 border-t border-divider px-4 py-4">
            <FieldCard
              label="Signing Secret"
              description="如果你要啟用受保護播放，這裡要填入一組 secret。若你還沒準備好，系統會先幫你生成一組亂碼。"
              helper="之後請把同一組值填到 Cloudflare Stream 的 token / signed playback 設定中。"
            >
              <div className="flex gap-2">
                <Input
                  {...form.register('signingSecret')}
                  placeholder="系統可先自動生成，你也可以自行替換"
                  className="border-divider bg-white text-heading"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setGeneratedSecret('signingSecret')}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重新產生
                </Button>
              </div>
              <p className="mt-2 flex items-start gap-2 text-sm text-body">
                <Sparkles className="mt-0.5 h-4 w-4 text-cta" />
                若你看到一串亂碼，那是系統幫你先生成的預設 secret，可以直接拿去用。
              </p>
            </FieldCard>

            <FieldCard
              label="Webhook Secret"
              description="如果你要接收 Cloudflare Stream 的轉檔通知，這裡也建議先準備一組 secret。系統同樣會先幫你生成亂碼。"
              helper="之後把同一組值填回 Cloudflare webhook 設定，用來驗證通知來源。"
            >
              <div className="flex gap-2">
                <Input
                  {...form.register('webhookSecret')}
                  placeholder="系統可先自動生成，你也可以自行替換"
                  className="border-divider bg-white text-heading"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setGeneratedSecret('webhookSecret')}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重新產生
                </Button>
              </div>
              <p className="mt-2 flex items-start gap-2 text-sm text-body">
                <Sparkles className="mt-0.5 h-4 w-4 text-cta" />
                若你看到一串亂碼，那是系統幫你先生成的 webhook secret，之後照樣填回 Cloudflare 即可。
              </p>
            </FieldCard>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="sticky bottom-0 flex justify-end border-t border-divider bg-white/95 pt-4 backdrop-blur">
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-cta text-white hover:bg-cta-hover"
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
