'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
import { updateSocialLoginSettings } from '@/lib/actions/settings'
import {
  socialLoginSettingsSchema,
  type SocialLoginSettingsFormData,
} from '@/lib/validations/settings'

interface SocialLoginSettingsFormProps {
  initialData: {
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
}

function ProviderStatusBadge({ configured }: { configured: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        configured
          ? 'border-green-500 bg-green-50 text-green-600'
          : 'border-divider text-body'
      }
    >
      {configured ? '已設定' : '未設定'}
    </Badge>
  )
}

export function SocialLoginSettingsForm({
  initialData,
}: SocialLoginSettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<SocialLoginSettingsFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(socialLoginSettingsSchema) as any,
    defaultValues: {
      googleEnabled: initialData.googleEnabled,
      googleClientId: initialData.googleClientId,
      googleClientSecret: initialData.googleClientSecretHint,
      appleEnabled: initialData.appleEnabled,
      appleClientId: initialData.appleClientId,
      appleTeamId: initialData.appleTeamId,
      appleKeyId: initialData.appleKeyId,
      applePrivateKey: initialData.applePrivateKeyHint,
    },
  })

  async function onSubmit(data: SocialLoginSettingsFormData) {
    startTransition(async () => {
      const result = await updateSocialLoginSettings(data)

      if (result.success) {
        toast.success('登入方式 設定已儲存，請重啟服務才會生效', {
          duration: 6000,
        })
        form.reset(data)
      } else {
        toast.error(result.error || '儲存 登入方式 設定失敗')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">⚠️ 修改 OAuth 憑證後需重啟服務才會生效</p>
          <p className="mt-1 text-amber-800">
            為了安全性與效能考量，Google / Apple 登入憑證在服務啟動時載入一次。
            儲存設定後，請執行以下操作：
          </p>
          <ul className="mt-2 ml-4 list-disc space-y-0.5 text-amber-800">
            <li>
              <strong>本機開發</strong>：於終端機按 <code className="rounded bg-white px-1">Ctrl+C</code> 停止後，重新執行 <code className="rounded bg-white px-1">pnpm dev</code>
            </li>
            <li>
              <strong>Zeabur 部署</strong>：到 Zeabur 後台找到 App 服務 → 點右上角「Restart」按鈕
            </li>
            <li>
              <strong>其他平台</strong>：重啟 Node.js 服務（Docker restart、PM2 restart 等）
            </li>
          </ul>
          <p className="mt-2 text-xs text-amber-700">
            未重啟前，前台點擊 Google / Apple 登入會出現 <code className="rounded bg-white px-1">Provider with id &quot;google&quot; not found</code> 錯誤。
          </p>
        </div>

        <Card className="rounded-xl border border-divider bg-white">
          <CardHeader>
            <CardTitle className="text-heading">Google 登入</CardTitle>
            <CardDescription className="text-body">
              啟用後，使用者可透過 Google 快速登入。若現在還沒準備好憑證，可以先保持停用。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="mb-2 font-medium">如何取得 Google OAuth 憑證？</p>
              <ol className="ml-4 list-decimal space-y-1 text-blue-800">
                <li>
                  前往{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Google Cloud Console → APIs &amp; Services → Credentials
                  </a>
                </li>
                <li>
                  建立「OAuth client ID」，應用程式類型選擇「Web application」
                </li>
                <li>
                  在「Authorized redirect URIs（已授權的重新導向 URI）」加入你的網域 + <code className="rounded bg-white px-1">/api/auth/callback/google</code>
                  ，例如：
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    <li>
                      <code className="rounded bg-white px-1">
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}/api/auth/callback/google`
                          : 'https://你的網域/api/auth/callback/google'}
                      </code>
                    </li>
                    <li>
                      本機開發：<code className="rounded bg-white px-1">http://localhost:3000/api/auth/callback/google</code>
                    </li>
                  </ul>
                </li>
                <li>
                  建立完成後，把產生的 Client ID 和 Client Secret 貼到下方欄位並儲存
                </li>
              </ol>
              <p className="mt-2 text-xs text-blue-700">
                ⚠️ Client ID 格式應為 <code className="rounded bg-white px-1">xxxxx.apps.googleusercontent.com</code>，<strong>不是你的 Gmail 信箱</strong>。
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-divider p-4">
              <div>
                <p className="font-medium text-heading">啟用 Google 登入</p>
                <p className="text-sm text-caption">
                  開啟後，前台登入頁會顯示 Google 按鈕。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ProviderStatusBadge configured={initialData.googleConfigured} />
                <FormField
                  control={form.control}
                  name="googleEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="googleClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Client ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder="xxxxx.apps.googleusercontent.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="googleClientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Client Secret</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      value={field.value ?? ''}
                      placeholder="your-google-client-secret"
                    />
                  </FormControl>
                  <FormDescription>
                    若目前欄位內顯示遮罩值，代表系統已保存既有 secret；只有輸入新值時才會覆蓋。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-divider bg-white">
          <CardHeader>
            <CardTitle className="text-heading">Apple 登入</CardTitle>
            <CardDescription className="text-body">
              Apple 登入設定相對進階，建議在站點先上線後再補上。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-divider p-4">
              <div>
                <p className="font-medium text-heading">啟用 Apple 登入</p>
                <p className="text-sm text-caption">
                  開啟後，前台登入頁會顯示 Apple 按鈕。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ProviderStatusBadge configured={initialData.appleConfigured} />
                <FormField
                  control={form.control}
                  name="appleEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="appleClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apple Client ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder="your-apple-client-id"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="appleTeamId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apple Team ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="your-team-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="appleKeyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apple Key ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="your-key-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="applePrivateKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apple Private Key</FormLabel>
                  <FormControl>
                    <textarea
                      className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="-----BEGIN PRIVATE KEY-----"
                    />
                  </FormControl>
                  <FormDescription>
                    若目前欄位內顯示遮罩值，代表系統已保存既有 private key；只有輸入新值時才會覆蓋。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <StickySaveBar
          isDirty={form.formState.isDirty}
          isPending={isPending}
          form="submit"
          label="儲存 登入方式"
        />
        <Button type="submit" className="sr-only">
          儲存
        </Button>
      </form>
    </Form>
  )
}
