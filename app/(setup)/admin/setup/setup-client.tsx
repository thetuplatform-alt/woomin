'use client'

import { useEffect, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Loader2,
  Mail,
  PlayCircle,
  Rocket,
  ShieldCheck,
  SkipForward,
  UserRound,
} from 'lucide-react'
import { completeSetup } from '@/lib/actions/setup'
import type { SetupFormData } from '@/lib/setup-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface SetupClientProps {
  user: {
    name: string
    email: string
  }
  detectedDefaults: {
    videoProvider: 'youtube' | 'cloudflare' | 'bunny'
    storageDriver: 'local' | 's3'
    localStorageRoot: string
    hasObjectStorageEnv: boolean
    hasCloudflareStreamEnv: boolean
    cloudflareAccountId: string
    cloudflareApiToken: string
    cloudflareStreamCustomerCode: string
    cloudflareStreamSigningSecret: string
    cloudflareStreamWebhookSecret: string
    emailPreConfigured: boolean
    emailPreConfiguredProvider: 'resend' | 'smtp' | 'zsend' | 'tosend' | null
    emailPreConfiguredDomain: string
  }
}

const STEPS = [
  { id: 'video', label: '影片方案', icon: PlayCircle },
  { id: 'storage', label: '儲存方式', icon: HardDrive },
  { id: 'email', label: 'Email 設定', icon: Mail },
  { id: 'google', label: 'Google 登入', icon: UserRound },
  { id: 'apple', label: 'Apple 登入', icon: ShieldCheck },
  { id: 'finish', label: '完成初始化', icon: Rocket },
] as const

function generateSecret() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function OptionCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition-colors ${
        active ? 'border-cta bg-cta/5' : 'border-divider hover:border-cta/40'
      }`}
    >
      <p className="font-medium text-heading">{title}</p>
      <p className="mt-1 text-xs text-caption">{description}</p>
    </button>
  )
}

export function SetupClient({ user, detectedDefaults }: SetupClientProps) {
  const { update: updateSession } = useSession()
  const [currentStep, setCurrentStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [showAdvancedSecrets, setShowAdvancedSecrets] = useState(false)

  const defaultLocalStorageRoot = detectedDefaults.localStorageRoot

  const [videoProvider, setVideoProvider] = useState<'youtube' | 'cloudflare' | 'bunny'>(
    detectedDefaults.videoProvider
  )
  const [cloudflareAccountId, setCloudflareAccountId] = useState(
    detectedDefaults.cloudflareAccountId
  )
  const [cloudflareApiToken, setCloudflareApiToken] = useState(
    detectedDefaults.cloudflareApiToken
  )
  const [cloudflareStreamCustomerCode, setCloudflareStreamCustomerCode] =
    useState(detectedDefaults.cloudflareStreamCustomerCode)
  const [cloudflareStreamSigningSecret, setCloudflareStreamSigningSecret] =
    useState(detectedDefaults.cloudflareStreamSigningSecret)
  const [cloudflareStreamWebhookSecret, setCloudflareStreamWebhookSecret] =
    useState(detectedDefaults.cloudflareStreamWebhookSecret)
  const [storageDriver, setStorageDriver] = useState<'local' | 's3'>(
    detectedDefaults.storageDriver
  )
  const [localStorageRoot, setLocalStorageRoot] = useState(defaultLocalStorageRoot)
  const [contactEmail, setContactEmail] = useState('')

  const [emailMode, setEmailMode] = useState<'skip' | 'smtp' | 'auto'>(
    detectedDefaults.emailPreConfigured ? 'auto' : 'skip'
  )
  const [emailSenderName, setEmailSenderName] = useState('')
  const [emailFrom, setEmailFrom] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [smtpSecure, setSmtpSecure] = useState(false)

  const [googleMode, setGoogleMode] = useState<'skip' | 'enable'>('skip')
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')

  const [appleMode, setAppleMode] = useState<'skip' | 'enable'>('skip')
  const [appleClientId, setAppleClientId] = useState('')
  const [appleTeamId, setAppleTeamId] = useState('')
  const [appleKeyId, setAppleKeyId] = useState('')
  const [applePrivateKey, setApplePrivateKey] = useState('')

  useEffect(() => {
    if (videoProvider !== 'cloudflare') return

    if (!cloudflareStreamSigningSecret) {
      setCloudflareStreamSigningSecret(generateSecret())
    }

    if (!cloudflareStreamWebhookSecret) {
      setCloudflareStreamWebhookSecret(generateSecret())
    }
  }, [
    videoProvider,
    cloudflareStreamSigningSecret,
    cloudflareStreamWebhookSecret,
  ])

  const isLastStep = currentStep === STEPS.length - 1

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((step) => step + 1)
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep((step) => step - 1)
    }
  }

  const handleComplete = () => {
    const data: SetupFormData = {
      videoProvider,
      cloudflareAccountId: cloudflareAccountId || undefined,
      cloudflareApiToken: cloudflareApiToken || undefined,
      cloudflareStreamCustomerCode: cloudflareStreamCustomerCode || undefined,
      cloudflareStreamSigningSecret: cloudflareStreamSigningSecret || undefined,
      cloudflareStreamWebhookSecret: cloudflareStreamWebhookSecret || undefined,
      storageDriver,
      localStorageRoot: storageDriver === 'local' ? localStorageRoot : '',
      contactEmail: contactEmail || undefined,
      emailMode,
      emailSenderName: emailSenderName || undefined,
      emailFrom: emailFrom || undefined,
      smtpHost: smtpHost || undefined,
      smtpPort: smtpPort || undefined,
      smtpUser: smtpUser || undefined,
      smtpPass: smtpPass || undefined,
      smtpSecure,
      googleMode,
      googleClientId: googleClientId || undefined,
      googleClientSecret: googleClientSecret || undefined,
      appleMode,
      appleClientId: appleClientId || undefined,
      appleTeamId: appleTeamId || undefined,
      appleKeyId: appleKeyId || undefined,
      applePrivateKey: applePrivateKey || undefined,
    }

    startTransition(async () => {
      const result = await completeSetup(data)

      if (result.success) {
        await updateSession({ role: 'ADMIN' })
        toast.success('系統初始化完成，歡迎開始使用平台')
        window.location.href = '/admin'
      } else {
        toast.error(result.error || '初始化失敗')
      }
    })
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="border-b border-divider bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-heading">系統初始化</h1>
            <span className="text-sm text-caption">
              {currentStep + 1} / {STEPS.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-cta' : 'bg-divider'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {currentStep === 0 && (
          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-heading">
                <PlayCircle className="h-5 w-5 text-cta" />
                1. 影片方案
              </CardTitle>
              <CardDescription className="text-body">
                先決定平台預設的影片方案。如果你要用 Cloudflare Stream，也可以直接在這裡補上必要參數。
              </CardDescription>
              {detectedDefaults.hasCloudflareStreamEnv && (
                <p className="text-xs text-cta">
                  已偵測到既有 Cloudflare Stream 設定，已預選 Cloudflare Stream。
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <OptionCard
                  active={videoProvider === 'youtube'}
                  title="YouTube"
                  description="最簡單的影片方案，直接嵌入課程內容即可。"
                  onClick={() => setVideoProvider('youtube')}
                />
                <OptionCard
                  active={videoProvider === 'cloudflare'}
                  title="Cloudflare Stream"
                  description="使用受保護串流與影片託管，適合正式課程平台。"
                  onClick={() => setVideoProvider('cloudflare')}
                />
                <OptionCard
                  active={videoProvider === 'bunny'}
                  title="Bunny Stream"
                  description="使用 Bunny Stream 託管影片；完成初始化後可到影音設定填寫連線資料。"
                  onClick={() => setVideoProvider('bunny')}
                />
              </div>

              {videoProvider === 'cloudflare' && (
                <div className="space-y-4 rounded-xl border border-divider bg-surface/40 p-4">
                  <div className="rounded-xl border border-dashed border-cta/40 bg-cta/5 p-4 text-sm text-body">
                    還沒登入 Cloudflare？先到{' '}
                    <a
                      href="https://dash.cloudflare.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-cta underline underline-offset-2 hover:text-cta-hover"
                    >
                      Cloudflare Dashboard
                    </a>
                    {' '}登入或註冊帳號，再回來填下方欄位。
                  </div>

                  <div className="rounded-xl border border-divider bg-white p-4">
                    <Label className="text-heading">Cloudflare Account ID</Label>
                    <p className="mt-2 text-sm text-body">
                      到{' '}
                      <a
                        href="https://dash.cloudflare.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-cta underline underline-offset-2 hover:text-cta-hover"
                      >
                        Cloudflare Dashboard
                      </a>
                      {' '}的帳號資訊頁，找到你的 Account ID，貼到這裡。
                    </p>
                    <Input
                      value={cloudflareAccountId}
                      onChange={(event) => setCloudflareAccountId(event.target.value)}
                      placeholder="例如：Cloudflare 帳號頁看到的 Account ID"
                      className="mt-3"
                    />
                    <p className="mt-2 text-xs text-caption">
                      這個值會用來呼叫 Cloudflare Stream API。
                    </p>
                  </div>

                  <div className="rounded-xl border border-divider bg-white p-4">
                    <Label className="text-heading">Stream Customer Code</Label>
                    <p className="mt-2 text-sm text-body">
                      到 Cloudflare Stream 的播放器網域設定頁，找到 `customer-xxx.cloudflarestream.com`
                      裡的 `xxx`。
                    </p>
                    <Input
                      value={cloudflareStreamCustomerCode}
                      onChange={(event) =>
                        setCloudflareStreamCustomerCode(event.target.value)
                      }
                      placeholder="例如：customer-abc123.cloudflarestream.com 裡的 abc123"
                      className="mt-3"
                    />
                    <p className="mt-2 text-xs text-caption">
                      這個值會用來產生影片播放網址與縮圖網址。
                    </p>
                  </div>

                  <div className="rounded-xl border border-divider bg-white p-4">
                    <Label className="text-heading">API Token</Label>
                    <p className="mt-2 text-sm text-body">
                      到 Cloudflare 的 API Tokens 建立一組可管理 Stream 的 token，再貼到這裡。
                    </p>
                    <Input
                      value={cloudflareApiToken}
                      onChange={(event) => setCloudflareApiToken(event.target.value)}
                      placeholder="請貼上可管理 Cloudflare Stream 的 API Token"
                      className="mt-3"
                    />
                    <p className="mt-2 text-xs text-caption">
                      這個 token 會用來建立上傳網址、同步影片資訊與其他後台管理操作。
                    </p>
                  </div>

                  <Collapsible
                    open={showAdvancedSecrets}
                    onOpenChange={setShowAdvancedSecrets}
                    className="rounded-xl border border-divider bg-white"
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-4 text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-heading">
                            進階設定（選填）
                          </p>
                          <p className="mt-1 text-sm text-body">
                            只有在你要啟用受保護播放或接 webhook 通知時，才需要展開填寫兩個 secret。
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-caption transition-transform ${
                            showAdvancedSecrets ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="space-y-4 border-t border-divider px-4 py-4">
                      <div className="rounded-xl border border-divider bg-surface/40 p-4">
                        <Label className="text-heading">Signing Secret</Label>
                        <p className="mt-2 text-sm text-body">
                          如果你要啟用受保護播放，系統會先幫你生成一組亂碼，你也可以自行替換。
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={cloudflareStreamSigningSecret}
                            onChange={(event) =>
                              setCloudflareStreamSigningSecret(event.target.value)
                            }
                            placeholder="系統可先自動生成，你也可以自行替換"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            onClick={() =>
                              setCloudflareStreamSigningSecret(generateSecret())
                            }
                          >
                            重新產生
                          </Button>
                        </div>
                        <p className="mt-2 text-xs text-caption">
                          若你看到一串亂碼，那是系統幫你先生成的預設 secret。
                        </p>
                      </div>

                      <div className="rounded-xl border border-divider bg-surface/40 p-4">
                        <Label className="text-heading">Webhook Secret</Label>
                        <p className="mt-2 text-sm text-body">
                          若你要接收 Cloudflare Stream 的轉檔通知，這裡也建議先準備一組 secret。系統會先幫你生成亂碼。
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={cloudflareStreamWebhookSecret}
                            onChange={(event) =>
                              setCloudflareStreamWebhookSecret(event.target.value)
                            }
                            placeholder="系統可先自動生成，你也可以自行替換"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            onClick={() =>
                              setCloudflareStreamWebhookSecret(generateSecret())
                            }
                          >
                            重新產生
                          </Button>
                        </div>
                        <p className="mt-2 text-xs text-caption">
                          之後把同一組值填回 Cloudflare webhook 設定即可。
                        </p>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="rounded-xl border border-dashed border-divider bg-white/70 p-4 text-sm text-body">
                    先填好 `Cloudflare Account ID`、`Stream Customer Code`、`API Token`，
                    就能先開始上傳與播放影片。兩個 secret 可之後再到進階設定補上。
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 1 && (
          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-heading">
                <HardDrive className="h-5 w-5 text-cta" />
                2. 儲存方式
              </CardTitle>
              <CardDescription className="text-body">
                如果你部署在有 Zeabur volume 的環境，建議先用本地儲存；如果已經有 object
                storage，也可以先選 S3 相容儲存。
              </CardDescription>
              {detectedDefaults.hasObjectStorageEnv && (
                <p className="text-xs text-cta">
                  已偵測到 S3 / R2 環境變數，已預選 S3 相容儲存。
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionCard
                  active={storageDriver === 'local'}
                  title="本地儲存"
                  description="適合 Zeabur volume，本地圖片與附件最簡單。"
                  onClick={() => setStorageDriver('local')}
                />
                <OptionCard
                  active={storageDriver === 's3'}
                  title="S3 相容儲存"
                  description="保留給進階部署情境，之後可在後台補上 S3 或 R2 設定。"
                  onClick={() => setStorageDriver('s3')}
                />
              </div>

              {storageDriver === 'local' && (
                <div className="space-y-2">
                  <Label className="text-heading">本地儲存路徑</Label>
                  <Input
                    value={localStorageRoot}
                    onChange={(event) => setLocalStorageRoot(event.target.value)}
                    placeholder="/data/uploads"
                  />
                  <p className="text-xs text-caption">
                    若使用 Zeabur volume，本地硬碟請掛載到 `/data/uploads`。公開讀取路徑固定會是
                    `/uploads`。
                  </p>
                </div>
              )}

              {storageDriver === 's3' && (
                <div className="rounded-lg border border-divider bg-surface/50 p-3 text-xs text-caption">
                  S3 / R2 相關的 bucket、金鑰與 endpoint 可以先在 setup 完成後，再到後台設定頁補齊。
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-heading">
                <Mail className="h-5 w-5 text-cta" />
                3. Email 設定
              </CardTitle>
              <CardDescription className="text-body">
                如果要啟用寄信與通知功能，這一步可以先填入 SMTP。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-heading">聯絡 Email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder={user.email}
                />
              </div>

              {detectedDefaults.emailPreConfigured ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-green-100 p-1.5">
                      <Mail className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-green-800">寄信功能已自動設定完成</p>
                      <p className="mt-1 text-sm text-green-700">
                        系統已幫你接好
                        {detectedDefaults.emailPreConfiguredProvider === 'zsend'
                          ? '內建寄信服務'
                          : detectedDefaults.emailPreConfiguredProvider === 'tosend'
                          ? 'ToSend 寄信服務'
                          : detectedDefaults.emailPreConfiguredProvider === 'resend'
                          ? 'Resend 寄信服務'
                          : '自訂 SMTP 寄信服務'}
                        {detectedDefaults.emailPreConfiguredDomain
                          ? `（寄件網域：${detectedDefaults.emailPreConfiguredDomain}）`
                          : ''}
                        ，不用再填任何東西。之後要換寄信方式，隨時可以到後台調整。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <OptionCard
                    active={emailMode === 'skip'}
                    title="稍後設定"
                    description="先完成初始化，之後再到後台補上寄信設定。"
                    onClick={() => setEmailMode('skip')}
                  />
                  <OptionCard
                    active={emailMode === 'smtp'}
                    title="設定 SMTP"
                    description="立即填入 SMTP，啟用寄信與通知功能。"
                    onClick={() => setEmailMode('smtp')}
                  />
                </div>
              )}

              {emailMode === 'smtp' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-heading">寄件者名稱</Label>
                    <Input
                      value={emailSenderName}
                      onChange={(event) => setEmailSenderName(event.target.value)}
                      placeholder="WooMin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-heading">寄件 Email</Label>
                    <Input
                      type="email"
                      value={emailFrom}
                      onChange={(event) => setEmailFrom(event.target.value)}
                      placeholder="hello@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-heading">SMTP Host</Label>
                    <Input
                      value={smtpHost}
                      onChange={(event) => setSmtpHost(event.target.value)}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-heading">SMTP Port</Label>
                    <Input
                      value={smtpPort}
                      onChange={(event) => setSmtpPort(event.target.value)}
                      placeholder="587"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-heading">SMTP 帳號</Label>
                    <Input
                      value={smtpUser}
                      onChange={(event) => setSmtpUser(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-heading">SMTP 密碼</Label>
                    <Input
                      type="password"
                      value={smtpPass}
                      onChange={(event) => setSmtpPass(event.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-body">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(event) => setSmtpSecure(event.target.checked)}
                    />
                    使用 SSL / TLS
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-heading">
                <UserRound className="h-5 w-5 text-cta" />
                4. Google 登入
              </CardTitle>
              <CardDescription className="text-body">
                如果要開放學員或管理員使用 Google 登入，這一步可以先啟用 Google OAuth。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionCard
                  active={googleMode === 'skip'}
                  title="稍後設定"
                  description="先完成初始化，之後再到後台補上 Google OAuth。"
                  onClick={() => setGoogleMode('skip')}
                />
                <OptionCard
                  active={googleMode === 'enable'}
                  title="立即啟用"
                  description="現在填入 Google OAuth 憑證，立刻開啟 Google 登入。"
                  onClick={() => setGoogleMode('enable')}
                />
              </div>

              {googleMode === 'enable' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-heading">Google Client ID</Label>
                    <Input
                      value={googleClientId}
                      onChange={(event) => setGoogleClientId(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-heading">Google Client Secret</Label>
                    <Input
                      type="password"
                      value={googleClientSecret}
                      onChange={(event) => setGoogleClientSecret(event.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-heading">
                <ShieldCheck className="h-5 w-5 text-cta" />
                5. Apple 登入
              </CardTitle>
              <CardDescription className="text-body">
                Apple 登入通常需要額外準備憑證，如果你已經設定好了，也可以在這一步一併填入。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionCard
                  active={appleMode === 'skip'}
                  title="稍後設定"
                  description="先完成初始化，之後再到後台補上 Apple OAuth。"
                  onClick={() => setAppleMode('skip')}
                />
                <OptionCard
                  active={appleMode === 'enable'}
                  title="立即啟用"
                  description="現在填入 Apple OAuth 憑證，立刻開啟 Apple 登入。"
                  onClick={() => setAppleMode('enable')}
                />
              </div>

              {appleMode === 'enable' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-heading">Apple Client ID</Label>
                    <Input
                      value={appleClientId}
                      onChange={(event) => setAppleClientId(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-heading">Apple Team ID</Label>
                    <Input
                      value={appleTeamId}
                      onChange={(event) => setAppleTeamId(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-heading">Apple Key ID</Label>
                    <Input
                      value={appleKeyId}
                      onChange={(event) => setAppleKeyId(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-heading">Apple Private Key</Label>
                    <Textarea
                      value={applePrivateKey}
                      onChange={(event) => setApplePrivateKey(event.target.value)}
                      rows={6}
                      placeholder="-----BEGIN PRIVATE KEY-----"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 5 && (
          <Card className="rounded-xl border border-divider bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-heading">
                <Rocket className="h-5 w-5 text-cta" />
                6. 完成初始化
              </CardTitle>
              <CardDescription className="text-body">
                確認以上設定後，{user.name || user.email} 就會成為第一位管理員，並可開始使用平台。
              </CardDescription>
            </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-divider bg-surface/50 p-4 text-sm text-body">
                  <p>影片方案：{videoProvider === 'youtube' ? 'YouTube' : videoProvider === 'bunny' ? 'Bunny Stream' : 'Cloudflare Stream'}</p>
                  {videoProvider === 'cloudflare' && (
                    <>
                      <p>Cloudflare Account ID：{cloudflareAccountId || '未填寫'}</p>
                      <p>Stream Customer Code：{cloudflareStreamCustomerCode || '未填寫'}</p>
                    </>
                  )}
                  <p>圖片與附件儲存：{storageDriver === 'local' ? '本地儲存' : 'S3 相容儲存'}</p>
                  {storageDriver === 'local' && <p>本地儲存路徑：{localStorageRoot}</p>}
                  <p>
                    Email：
                    {emailMode === 'auto'
                      ? '已自動設定'
                      : emailMode === 'smtp'
                      ? 'SMTP 已設定'
                      : '稍後設定'}
                  </p>
                  <p>Google 登入：{googleMode === 'enable' ? '已啟用' : '稍後設定'}</p>
                  <p>Apple 登入：{appleMode === 'enable' ? '已啟用' : '稍後設定'}</p>
                </div>
              </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button variant="ghost" onClick={goPrev}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一步
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < STEPS.length - 1 && (
              <Button variant="ghost" onClick={goNext} className="text-caption">
                <SkipForward className="mr-1 h-4 w-4" />
                稍後再說
              </Button>
            )}

            {!isLastStep ? (
              <Button onClick={goNext} className="bg-cta text-white hover:bg-cta-hover">
                下一步
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={isPending}
                className="bg-cta text-white hover:bg-cta-hover"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    初始化中...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    完成初始化
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
