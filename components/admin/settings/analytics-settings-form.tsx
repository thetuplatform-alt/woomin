'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { BarChart3 } from 'lucide-react'
import {
  siteSettingsSchema,
  type SiteSettingsFormData,
  SETTING_KEYS,
} from '@/lib/validations/settings'
import { updateSiteSettings } from '@/lib/actions/settings'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'

interface AnalyticsSettingsFormProps {
  initialSettings: Record<string, string>
  detectedDefaults: {
    videoProvider: 'youtube' | 'cloudflare' | 'bunny'
    storageDriver: 'local' | 's3'
    localStorageRoot: string
  }
}

export function AnalyticsSettingsForm({
  initialSettings,
  detectedDefaults,
}: AnalyticsSettingsFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<SiteSettingsFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(siteSettingsSchema) as any,
    defaultValues: {
      siteName: initialSettings[SETTING_KEYS.SITE_NAME] || 'WooMin',
      siteLogo: initialSettings[SETTING_KEYS.SITE_LOGO] || '',
      shareTitle: initialSettings[SETTING_KEYS.SHARE_TITLE] || '',
      shareDescription: initialSettings[SETTING_KEYS.SHARE_DESCRIPTION] || '',
      shareLogo: initialSettings[SETTING_KEYS.SHARE_LOGO] || '',
      shareImage: initialSettings[SETTING_KEYS.SHARE_IMAGE] || '',
      siteUrl: initialSettings[SETTING_KEYS.SITE_URL] || '',
      contactEmail: initialSettings[SETTING_KEYS.CONTACT_EMAIL] || '',
      brandDisplayName: initialSettings[SETTING_KEYS.BRAND_DISPLAY_NAME] || '',
      brandSubtitle: initialSettings[SETTING_KEYS.BRAND_SUBTITLE] || '',
      videoProvider:
        (initialSettings[SETTING_KEYS.VIDEO_PROVIDER] as 'youtube' | 'cloudflare') ||
        detectedDefaults.videoProvider,
      storageDriver:
        (initialSettings[SETTING_KEYS.STORAGE_DRIVER] as 'local' | 's3') ||
        detectedDefaults.storageDriver,
      localStorageRoot:
        initialSettings[SETTING_KEYS.LOCAL_STORAGE_ROOT] ||
        detectedDefaults.localStorageRoot,
      gaId: initialSettings[SETTING_KEYS.GA_ID] || '',
      posthogKey: initialSettings[SETTING_KEYS.POSTHOG_KEY] || '',
      posthogHost: initialSettings[SETTING_KEYS.POSTHOG_HOST] || '',
      posthogPersonalApiKey:
        initialSettings[SETTING_KEYS.POSTHOG_PERSONAL_API_KEY] || '',
      metaPixelId: initialSettings[SETTING_KEYS.META_PIXEL_ID] || '',
      metaCapiAccessToken:
        initialSettings[SETTING_KEYS.META_CAPI_ACCESS_TOKEN] || '',
    },
  })

  async function onSubmit(data: SiteSettingsFormData) {
    startTransition(async () => {
      const result = await updateSiteSettings(data)

      if (result.success) {
        toast.success('分析追蹤設定已儲存')
        form.reset(data)
        router.refresh()
      } else {
        toast.error(result.error ?? '儲存失敗')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <section id="section-analytics" className="flex flex-col gap-4">
          <div className="mb-2 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-heading">分析追蹤</h2>
              <p className="text-sm text-body">
                設定站點分析工具，方便後續追蹤流量、廣告成效與轉換。
              </p>
            </div>
          </div>

          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="text-heading">Google Analytics</CardTitle>
              <CardDescription className="text-body">設定 GA4 分析代碼。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="gaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">Google Analytics ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="G-XXXXXXXXXX"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      填入 GA4 Measurement ID，例如 `G-ABC123XYZ`。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="text-heading">PostHog</CardTitle>
              <CardDescription className="text-body">設定使用者行為追蹤與事件分析。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="posthogKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">Project API Key</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      填入 PostHog 專案的 Project API Key。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="posthogHost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">PostHog Host</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://us.i.posthog.com"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      PostHog Cloud 常見網址為 `https://us.i.posthog.com` 或
                      `https://eu.i.posthog.com`。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="posthogPersonalApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">Personal API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="phx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      若要使用進階的 PostHog 管理 API，可在這裡填入 Personal API Key。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="text-heading">Meta Pixel / Conversions API</CardTitle>
              <CardDescription className="text-body">
                設定 Meta Pixel 與 CAPI，方便廣告成效追蹤。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="metaPixelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">Meta Pixel ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123456789012345"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      可在 Meta Events Manager 中找到 Pixel ID。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="metaCapiAccessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">
                      Conversions API Access Token
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="EAAxxxxxxxxxxxxxxx..."
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      若要啟用 Conversions API，請填入對應的 access token。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </section>

        <StickySaveBar
          isDirty={form.formState.isDirty}
          isPending={isPending}
          form="submit"
          label="儲存分析追蹤設定"
        />
      </form>
    </Form>
  )
}
