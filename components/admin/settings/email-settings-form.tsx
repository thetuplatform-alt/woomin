// components/admin/settings/email-settings-form.tsx
// Email 設定表單元件
// 支援 Zeabur Email、ToSend、Resend 和 SMTP provider

'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  emailSettingsSchema,
  testEmailSchema,
  type EmailSettingsFormData,
  type TestEmailFormData,
} from '@/lib/validations/settings'
import { updateEmailSettings, testSmtpSettings } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
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
import { Switch } from '@/components/ui/switch'
import {
  Loader2,
  Send,
  Mail,
  AlertCircle,
  CheckCircle,
  Server,
  Plug,
} from 'lucide-react'

interface EmailSettingsFormProps {
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
  newsletter?: {
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

export function EmailSettingsForm({
  resendApiKeyHint,
  tosendApiKeyHint,
  zsendApiKeyHint,
  zsendDomain,
  senderName,
  fromEmail,
  isConfigured,
  emailProvider,
  resendConfigured,
  tosendConfigured,
  zsendConfigured,
  smtp,
  newsletter,
}: EmailSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [isTestingSmtp, setIsTestingSmtp] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [smtpTestResult, setSmtpTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // 設定表單
  const settingsForm = useForm<EmailSettingsFormData>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      emailProvider: emailProvider,
      resendApiKey: resendApiKeyHint,
      tosendApiKey: tosendApiKeyHint,
      zsendApiKey: zsendApiKeyHint,
      zsendDomain: zsendDomain,
      emailSenderName: senderName,
      emailFrom: fromEmail,
      smtpHost: smtp.host,
      smtpPort: smtp.port,
      smtpUser: smtp.user,
      smtpPass: smtp.passHint,
      smtpSecure: smtp.secure,
      newsletterSenderName: newsletter?.senderName || senderName,
      newsletterReplyTo: newsletter?.replyTo || fromEmail,
      newsletterFooterName: newsletter?.footerName || senderName,
      newsletterFooterAddress: newsletter?.footerAddress || '',
      newsletterFooterEmail: newsletter?.footerEmail || fromEmail,
      newsletterRatePerMinute: newsletter?.ratePerMinute || '60',
    },
  })

  const watchProvider = settingsForm.watch('emailProvider')

  // 測試表單
  const testForm = useForm<TestEmailFormData>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: {
      email: '',
    },
  })

  // 提交設定
  async function onSubmitSettings(data: EmailSettingsFormData) {
    startTransition(async () => {
      try {
        const result = await updateEmailSettings(data)

        if (result.success) {
          toast.success('設定已儲存')
          settingsForm.reset(data)
        } else {
          toast.error(result.error ?? '儲存設定失敗')
        }
      } catch {
        toast.error('操作失敗，請稍後再試')
      }
    })
  }

  // 測試 SMTP 連線
  async function onTestSmtp() {
    setIsTestingSmtp(true)
    setSmtpTestResult(null)

    try {
      const values = settingsForm.getValues()
      const result = await testSmtpSettings({
        smtpHost: values.smtpHost,
        smtpPort: values.smtpPort,
        smtpUser: values.smtpUser,
        smtpPass: values.smtpPass,
        smtpSecure: values.smtpSecure,
      })

      setSmtpTestResult(result)
      if (result.success) {
        toast.success('SMTP 連線成功')
      } else {
        toast.error(result.message)
      }
    } catch {
      setSmtpTestResult({ success: false, message: '測試連線失敗' })
      toast.error('測試連線失敗')
    } finally {
      setIsTestingSmtp(false)
    }
  }

  // 發送測試郵件
  async function onSendTestEmail(data: TestEmailFormData) {
    setIsSendingTest(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email }),
      })

      const result = await response.json()

      if (result.success) {
        setTestResult({
          success: true,
          message: `測試郵件已發送至 ${data.email}`,
        })
        toast.success('測試郵件已發送')
        testForm.reset()
      } else {
        setTestResult({
          success: false,
          message: result.error || '發送失敗',
        })
        toast.error(result.error || '發送測試郵件失敗')
      }
    } catch {
      setTestResult({
        success: false,
        message: '發送失敗，請檢查網路連線',
      })
      toast.error('發送測試郵件失敗')
    } finally {
      setIsSendingTest(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 發送者設定 */}
      <Card className="bg-white border border-divider rounded-xl">
        <CardHeader>
          <CardTitle className="text-heading">Email 發送方式</CardTitle>
          <CardDescription className="text-body">
            選擇 Zeabur Email、ToSend、Resend 或自訂 SMTP，系統會優先使用資料庫設定
          </CardDescription>
        </CardHeader>
        <CardContent>
              <Form {...settingsForm}>
                <form
                  onSubmit={settingsForm.handleSubmit(onSubmitSettings)}
                  className="space-y-6"
                >
                  {/* Provider 切換 */}
                  <div className="border border-divider rounded-xl p-4 space-y-4">
                    <p className="text-sm font-medium text-heading">
                      Email 發送方式
                    </p>

                    <FormField
                      control={settingsForm.control}
                      name="emailProvider"
                      render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <button
                              type="button"
                              onClick={() => field.onChange('zsend')}
                              className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                                field.value === 'zsend'
                                  ? 'border-cta bg-cta/5'
                                  : 'border-divider hover:border-[#A3A3A3]'
                              }`}
                            >
                              <Mail className={`h-5 w-5 ${field.value === 'zsend' ? 'text-cta' : 'text-body'}`} />
                              <div className="text-left">
                                <p className={`text-sm font-medium ${field.value === 'zsend' ? 'text-cta' : 'text-heading'}`}>
                                  Zeabur Email
                                </p>
                                <p className="text-xs text-caption">
                                  內建寄信服務
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange('tosend')}
                              className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                                field.value === 'tosend'
                                  ? 'border-cta bg-cta/5'
                                  : 'border-divider hover:border-[#A3A3A3]'
                              }`}
                            >
                              <Send className={`h-5 w-5 ${field.value === 'tosend' ? 'text-cta' : 'text-body'}`} />
                              <div className="text-left">
                                <p className={`text-sm font-medium ${field.value === 'tosend' ? 'text-cta' : 'text-heading'}`}>
                                  ToSend
                                </p>
                                <p className="text-xs text-caption">
                                  透過 ToSend API 發送
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange('resend')}
                              className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                                field.value === 'resend'
                                  ? 'border-cta bg-cta/5'
                                  : 'border-divider hover:border-[#A3A3A3]'
                              }`}
                            >
                              <Mail className={`h-5 w-5 ${field.value === 'resend' ? 'text-cta' : 'text-body'}`} />
                              <div className="text-left">
                                <p className={`text-sm font-medium ${field.value === 'resend' ? 'text-cta' : 'text-heading'}`}>
                                  Resend
                                </p>
                                <p className="text-xs text-caption">
                                  透過 Resend API 發送
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange('smtp')}
                              className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                                field.value === 'smtp'
                                  ? 'border-cta bg-cta/5'
                                  : 'border-divider hover:border-[#A3A3A3]'
                              }`}
                            >
                              <Server className={`h-5 w-5 ${field.value === 'smtp' ? 'text-cta' : 'text-body'}`} />
                              <div className="text-left">
                                <p className={`text-sm font-medium ${field.value === 'smtp' ? 'text-cta' : 'text-heading'}`}>
                                  自訂 SMTP
                                </p>
                                <p className="text-xs text-caption">
                                  透過 SMTP 伺服器發送
                                </p>
                              </div>
                            </button>
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Zsend 設定 */}
                    {watchProvider === 'zsend' && (
                      <div className="space-y-4 pt-2">
                        <FormField
                          control={settingsForm.control}
                          name="zsendApiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-heading">
                                Zeabur Email API Key
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="zsend_..."
                                  className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-caption">
                                留空表示不更改現有 API Key。部署時通常已自動填好，不用動它。
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={settingsForm.control}
                          name="zsendDomain"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-heading">
                                寄件網域
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="example.com"
                                  className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-caption">
                                已在 Zeabur Email 驗證通過的網域（寄件地址的 @ 後面那段）
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className={`rounded-lg border p-3 text-sm ${
                          zsendConfigured
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}>
                          {zsendConfigured
                            ? 'Zeabur Email 已設定'
                            : '尚未設定 Zeabur Email API Key'}
                        </div>
                      </div>
                    )}

                    {/* ToSend 設定 */}
                    {watchProvider === 'tosend' && (
                      <div className="space-y-4 pt-2">
                        <FormField
                          control={settingsForm.control}
                          name="tosendApiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-heading">
                                ToSend API Key
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="tsend_..."
                                  className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-caption">
                                留空表示不更改現有 API Key。
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className={`rounded-lg border p-3 text-sm ${
                          tosendConfigured
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}>
                          {tosendConfigured
                            ? 'ToSend 已設定，會優先從資料庫讀取；若資料庫為空才 fallback 到環境變數'
                            : '尚未設定 ToSend API Key'}
                        </div>
                      </div>
                    )}

                    {/* Resend 設定 */}
                    {watchProvider === 'resend' && (
                      <div className="space-y-4 pt-2">
                        <FormField
                          control={settingsForm.control}
                          name="resendApiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-heading">
                                Resend API Key
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="re_123456789"
                                  className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-caption">
                                留空表示不更改現有 API Key。
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className={`rounded-lg border p-3 text-sm ${
                          resendConfigured
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}>
                          {resendConfigured
                            ? 'Resend 已設定，會優先從資料庫讀取；若資料庫為空才 fallback 到環境變數'
                            : '尚未設定 Resend API Key'}
                        </div>
                      </div>
                    )}

                    {/* SMTP 設定 */}
                    {watchProvider === 'smtp' && (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={settingsForm.control}
                            name="smtpHost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-heading">
                                  SMTP Host
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="smtp.gmail.com"
                                    className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={settingsForm.control}
                            name="smtpPort"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-heading">
                                  Port
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="587"
                                    className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={settingsForm.control}
                          name="smtpUser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-heading">
                                帳號（Username）
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="user@example.com"
                                  className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={settingsForm.control}
                          name="smtpPass"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-heading">
                                密碼（Password）
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="••••••••"
                                  className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-caption">
                                留空表示不更改現有密碼
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={settingsForm.control}
                          name="smtpSecure"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border border-divider p-3">
                              <div>
                                <FormLabel className="text-heading">
                                  使用 SSL/TLS
                                </FormLabel>
                                <FormDescription className="text-caption">
                                  Port 465 通常需要開啟，Port 587 使用 STARTTLS 不需開啟
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {/* 測試 SMTP 連線 */}
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onTestSmtp}
                            disabled={isTestingSmtp}
                            className="border-divider text-body hover:text-heading"
                          >
                            {isTestingSmtp ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                連線測試中...
                              </>
                            ) : (
                              <>
                                <Plug className="mr-2 h-4 w-4" />
                                測試 SMTP 連線
                              </>
                            )}
                          </Button>
                        </div>

                        {/* SMTP 測試結果 */}
                        {smtpTestResult && (
                          <div
                            className={`rounded-xl p-4 ${
                              smtpTestResult.success
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-red-50 border border-red-200'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {smtpTestResult.success ? (
                                <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                              )}
                              <p className={`text-sm ${
                                smtpTestResult.success ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {smtpTestResult.message}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border border-divider rounded-xl p-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-heading">
                        發送者設定
                      </p>
                      <p className="mt-1 text-xs text-caption">
                        設定收件者看到的寄件名稱與寄件地址
                      </p>
                    </div>

                    <FormField
                      control={settingsForm.control}
                      name="emailSenderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-heading">
                            發送者名稱 <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="我的課程平台"
                              className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-caption">
                            Email 顯示的發送者名稱，例如：我的課程平台 &lt;hello@example.com&gt;
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="emailFrom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-heading">
                            發送者 Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="fish@fishot.com"
                              className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-caption">
                            用於寄送系統郵件的發送者地址
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border border-divider rounded-xl p-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-heading">
                        電子報法遵與送達率
                      </p>
                      <p className="mt-1 text-xs text-caption">
                        這些欄位會被強制注入每封電子報頁尾；未填實體地址時不可發送促銷信。
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={settingsForm.control}
                        name="newsletterSenderName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-heading">電子報寄件人名稱</FormLabel>
                            <FormControl>
                              <Input className="bg-white border-divider" placeholder="我的課程平台" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={settingsForm.control}
                        name="newsletterReplyTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-heading">電子報 Reply-To</FormLabel>
                            <FormControl>
                              <Input className="bg-white border-divider" placeholder="support@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={settingsForm.control}
                      name="newsletterFooterName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-heading">頁尾寄件人／公司名稱</FormLabel>
                          <FormControl>
                            <Input className="bg-white border-divider" placeholder="某某工作室" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="newsletterFooterAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-heading">頁尾實體地址</FormLabel>
                          <FormControl>
                            <Input className="bg-white border-divider" placeholder="台北市..." {...field} />
                          </FormControl>
                          <FormDescription className="text-caption">
                            平台會要求填寫實體地址，但不提供法律合規保證，請依所在地法規確認。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={settingsForm.control}
                        name="newsletterFooterEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-heading">頁尾聯絡 Email</FormLabel>
                            <FormControl>
                              <Input className="bg-white border-divider" placeholder="support@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={settingsForm.control}
                        name="newsletterRatePerMinute"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-heading">每分鐘發送上限</FormLabel>
                            <FormControl>
                              <Input className="bg-white border-divider" inputMode="numeric" placeholder="60" {...field} />
                            </FormControl>
                            <FormDescription className="text-caption">
                              允許 1-1200；Resend 會以批次 API 分段送出，SMTP 則逐封節流。
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      SPF／DKIM／DMARC 請在寄信網域完成設定。未完成時系統會警告，避免大量信件進垃圾桶。
                      {newsletter?.lastCronHeartbeatAt ? ` 最近排程心跳：${newsletter.lastCronHeartbeatAt}` : ' 尚未偵測到電子報排程心跳。'}
                    </div>
                  </div>

                  <StickySaveBar isDirty={settingsForm.formState.isDirty} isPending={isPending} form="submit" label="儲存設定" />
                </form>
              </Form>

              {/* 測試發送 */}
              <div className="mt-6 pt-6 border-t border-divider">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-heading">測試發送</h3>
                  <p className="text-xs text-body mt-0.5">發送測試郵件以確認設定正確</p>
                </div>
                <Form {...testForm}>
                  <form
                    onSubmit={testForm.handleSubmit(onSendTestEmail)}
                    className="space-y-4"
                  >
                    <FormField
                      control={testForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-heading">
                            收件者 Email <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="your@email.com"
                              className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-caption">
                            輸入您的 Email 地址以接收測試郵件
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center gap-4">
                      <Button
                        type="submit"
                        disabled={isSendingTest || !isConfigured}
                        variant="outline"
                        className="border-cta text-cta hover:bg-cta/10 rounded-full"
                      >
                        {isSendingTest ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            發送中...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            發送測試郵件
                          </>
                        )}
                      </Button>
                      {!isConfigured && (
                        <span className="text-sm text-caption">
                          請先完成 Email 服務設定
                        </span>
                      )}
                    </div>

                    {/* 測試結果 */}
                    {testResult && (
                      <div
                        className={`rounded-xl p-4 ${
                          testResult.success
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {testResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                testResult.success
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {testResult.success ? '發送成功' : '發送失敗'}
                            </p>
                            <p className="text-sm text-body mt-1">
                              {testResult.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </form>
                </Form>
              </div>
            </CardContent>
          </Card>
    </div>
  )
}
