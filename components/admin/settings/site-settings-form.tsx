/* eslint-disable @next/next/no-img-element */
'use client'

import { useCallback, useRef, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Upload, X, Settings } from 'lucide-react'
import {
  siteSettingsSchema,
  type SiteSettingsFormData,
  SETTING_KEYS,
} from '@/lib/validations/settings'
import { updateSiteSettings } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
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

interface SiteSettingsFormProps {
  initialSettings: Record<string, string>
  detectedDefaults: {
    storageDriver: 'local' | 's3'
    localStorageRoot: string
  }
}

export function SiteSettingsForm({
  initialSettings,
  detectedDefaults,
}: SiteSettingsFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [uploadingShareField, setUploadingShareField] = useState<
    'shareLogo' | 'shareImage' | null
  >(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const shareLogoInputRef = useRef<HTMLInputElement>(null)
  const shareImageInputRef = useRef<HTMLInputElement>(null)

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
      storageDriver:
        (initialSettings[SETTING_KEYS.STORAGE_DRIVER] as 'local' | 's3') ||
        detectedDefaults.storageDriver,
      localStorageRoot:
        initialSettings[SETTING_KEYS.LOCAL_STORAGE_ROOT] ||
        detectedDefaults.localStorageRoot,
      gaId: initialSettings[SETTING_KEYS.GA_ID] || '',
      posthogKey: initialSettings[SETTING_KEYS.POSTHOG_KEY] || '',
      posthogHost: initialSettings[SETTING_KEYS.POSTHOG_HOST] || '',
      posthogPersonalApiKey: initialSettings[SETTING_KEYS.POSTHOG_PERSONAL_API_KEY] || '',
      metaPixelId: initialSettings[SETTING_KEYS.META_PIXEL_ID] || '',
      metaCapiAccessToken: initialSettings[SETTING_KEYS.META_CAPI_ACCESS_TOKEN] || '',
    },
  })

  const uploadImageToMedia = useCallback(async (file: File) => {
    const presignRes = await fetch(
      `/api/admin/media/upload?filename=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type)}`
    )
    const presignData = await presignRes.json()

    if (!presignData.success) {
      throw new Error(presignData.error || '取得上傳資訊失敗')
    }

    const uploadRes = await fetch(presignData.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })

    if (!uploadRes.ok) {
      throw new Error(`檔案上傳失敗 (HTTP ${uploadRes.status})`)
    }

    const metadataRes = await fetch('/api/admin/media/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: presignData.key,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        type: 'IMAGE',
        sourceType: 'MANUAL',
        sourceLabel: '站點分享設定',
        sourceUrl: '/admin/settings',
      }),
    })

    const data = await metadataRes.json()
    if (!data.success) {
      throw new Error(data.error || '建立媒體記錄失敗')
    }

    return data.url as string
  }, [])

  const validateImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔案')
      return false
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('圖片大小不能超過 5MB')
      return false
    }

    return true
  }, [])

  const handleLogoUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      if (!validateImageFile(file)) return

      setIsUploadingLogo(true)

      try {
        const url = await uploadImageToMedia(file)
        form.setValue('siteLogo', url, { shouldDirty: true })
        toast.success('Logo 上傳成功')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Logo 上傳失敗')
      } finally {
        setIsUploadingLogo(false)
        if (logoInputRef.current) {
          logoInputRef.current.value = ''
        }
      }
    },
    [form, uploadImageToMedia, validateImageFile]
  )

  const handleShareImageUpload = useCallback(
    async (
      event: ChangeEvent<HTMLInputElement>,
      fieldName: 'shareLogo' | 'shareImage'
    ) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!validateImageFile(file)) return

      setUploadingShareField(fieldName)
      try {
        const url = await uploadImageToMedia(file)
        form.setValue(fieldName, url, { shouldDirty: true })
        toast.success('分享圖片上傳成功')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '分享圖片上傳失敗')
      } finally {
        setUploadingShareField(null)
        if (fieldName === 'shareLogo' && shareLogoInputRef.current) {
          shareLogoInputRef.current.value = ''
        }
        if (fieldName === 'shareImage' && shareImageInputRef.current) {
          shareImageInputRef.current.value = ''
        }
      }
    },
    [form, uploadImageToMedia, validateImageFile]
  )

  async function onSubmit(data: SiteSettingsFormData) {
    startTransition(async () => {
      const result = await updateSiteSettings(data)

      if (result.success) {
        toast.success('設定已儲存')
        form.reset(data)
        router.refresh()
      } else {
        toast.error(result.error ?? '儲存失敗')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-16">
        <section id="section-basic">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-heading">站點設定</h2>
              <p className="text-sm text-body">
                管理站點名稱、Logo、網站網址與品牌基本資訊。
              </p>
            </div>
          </div>

          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="text-heading">基本資訊</CardTitle>
              <CardDescription className="text-body">
                這些設定會影響站點名稱、Logo、聯絡 Email 與 SEO 基礎資訊。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="siteName"
                render={({ field }) => (
                  <FormItem data-tour="settings-site-name">
                    <FormLabel className="text-heading">
                      站點名稱 <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="WooMin"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      會顯示在瀏覽器標題、Email 寄件名稱與站點識別中。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteLogo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">站點 Logo</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {field.value ? (
                          <div className="flex items-center gap-4">
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-divider bg-surface">
                              <img src={field.value} alt="Logo" className="h-full w-full object-contain" />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-lg border-divider text-body hover:bg-surface"
                                disabled={isUploadingLogo}
                                onClick={() => logoInputRef.current?.click()}
                              >
                                {isUploadingLogo ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                更換圖片
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600"
                                onClick={() => form.setValue('siteLogo', '', { shouldDirty: true })}
                              >
                                <X className="mr-1 h-4 w-4" />
                                移除
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-divider bg-white px-4 py-8 transition-colors hover:border-cta"
                            onClick={() => logoInputRef.current?.click()}
                          >
                            {isUploadingLogo ? (
                              <Loader2 className="mb-2 h-8 w-8 animate-spin text-cta" />
                            ) : (
                              <Upload className="mb-2 h-8 w-8 text-caption" />
                            )}
                            <p className="text-sm font-medium text-body">
                              {isUploadingLogo ? '上傳中...' : '點擊上傳 Logo'}
                            </p>
                            <p className="mt-1 text-xs text-caption">支援 JPG、PNG、WebP，大小限制 5MB</p>
                          </div>
                        )}

                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-caption">
                      如果你使用 Zeabur volume，本地圖片會存到你掛載的永久資料夾。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">網站網址</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://your-domain.com"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      若系統無法從 request 推導網址，會使用這個網址產生 canonical、Email
                      連結與 callback URL。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">聯絡 Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@example.com"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      會顯示在聯絡資訊、Email 模板或後續站點設定中。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brandDisplayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">品牌顯示名稱</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="顯示於 Header 或品牌區塊的簡短名稱"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      可用於頁首、品牌區塊或簡化顯示名稱。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brandSubtitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">品牌副標</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：讓知識變成可販售的數位產品"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      可用於首頁、頁尾或品牌說明。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </section>

        <section id="section-share-preview">
          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="text-heading">分享預覽資訊</CardTitle>
              <CardDescription className="text-body">
                控制網站連結貼到 LINE、Facebook、Discord 等平台時顯示的標題、描述與圖片。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="shareTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">分享標題</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="留空時使用站點名稱"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      全站預設 Open Graph title；課程頁仍可使用課程自己的分享資訊覆蓋。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shareDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-heading">分享描述</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="描述這個平台或品牌"
                        className="border-divider bg-white text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-caption">
                      會寫入全站預設 og:description 和 Twitter description。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="shareLogo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">分享 Logo</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          {field.value && (
                            <div className="relative h-24 overflow-hidden rounded-lg border border-divider bg-surface">
                              <img src={field.value} alt="分享 Logo" className="h-full w-full object-contain" />
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-lg border-divider text-body hover:bg-surface"
                              disabled={uploadingShareField === 'shareLogo'}
                              onClick={() => shareLogoInputRef.current?.click()}
                            >
                              {uploadingShareField === 'shareLogo' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-4 w-4" />
                              )}
                              上傳
                            </Button>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600"
                                onClick={() => form.setValue('shareLogo', '', { shouldDirty: true })}
                              >
                                <X className="mr-1 h-4 w-4" />
                                移除
                              </Button>
                            )}
                          </div>
                          <input
                            ref={shareLogoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleShareImageUpload(event, 'shareLogo')}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-caption">
                        小圖示用途；若未設定，會使用站點 Logo。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shareImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">預設分享圖</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          {field.value && (
                            <div className="relative aspect-[1.91/1] overflow-hidden rounded-lg border border-divider bg-surface">
                              <img src={field.value} alt="預設分享圖" className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-lg border-divider text-body hover:bg-surface"
                              disabled={uploadingShareField === 'shareImage'}
                              onClick={() => shareImageInputRef.current?.click()}
                            >
                              {uploadingShareField === 'shareImage' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-4 w-4" />
                              )}
                              上傳
                            </Button>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600"
                                onClick={() => form.setValue('shareImage', '', { shouldDirty: true })}
                              >
                                <X className="mr-1 h-4 w-4" />
                                移除
                              </Button>
                            )}
                          </div>
                          <input
                            ref={shareImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleShareImageUpload(event, 'shareImage')}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-caption">
                        建議使用 1200 x 630 圖片；課程頁可用課程 OG 圖覆蓋。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <StickySaveBar
          isDirty={form.formState.isDirty}
          isPending={isPending}
          form="submit"
          label="儲存站點設定"
        />
      </form>
    </Form>
  )
}
