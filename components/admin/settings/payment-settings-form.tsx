// components/admin/settings/payment-settings-form.tsx
// 金流設定表單元件
// 支援 Shopline / Stripe / PAYUNi 三選一金流切換與設定

'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import {
  updatePaymentSettings,
  testPaymentConnection,
} from '@/lib/actions/settings'
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
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
import {
  SHOPLINE_PAYMENT_METHOD_CODES,
  SHOPLINE_PAYMENT_METHOD_LABELS,
  type ShoplinePaymentMethodCode,
} from '@/lib/payment/shopline-methods'

type GatewayType = 'shopline' | 'stripe' | 'payuni'

interface PaymentSettingsFormProps {
  initialGateway: GatewayType
  shopline: {
    merchantId: string
    apiKeyHint: string
    clientKeyHint: string
    signKeyHint: string
    testMode: boolean
    enabledMethods: ShoplinePaymentMethodCode[]
    webhookUrl: string
    returnUrl: string
    isConfigured: boolean
  }
  stripe: {
    secretKeyHint: string
    webhookSecretHint: string
    webhookUrl: string
    isConfigured: boolean
    isTestMode: boolean
  }
  payuni: {
    merchantId: string
    hashKeyHint: string
    hashIVHint: string
    testMode: boolean
    returnUrl: string
    notifyUrl: string
    isConfigured: boolean
  }
}

export function PaymentSettingsForm({
  initialGateway,
  shopline: initialShopline,
  stripe: initialStripe,
  payuni: initialPayuni,
}: PaymentSettingsFormProps) {
  const [isSaving, startSaveTransition] = useTransition()
  const [isTesting, startTestTransition] = useTransition()

  const [gateway, setGateway] = useState<GatewayType>(initialGateway)

  // Shopline
  const [shoplineMerchantId, setShoplineMerchantId] = useState(
    initialShopline.merchantId
  )
  const [shoplineApiKey, setShoplineApiKey] = useState('')
  const [shoplineClientKey, setShoplineClientKey] = useState('')
  const [shoplineSignKey, setShoplineSignKey] = useState('')
  const [shoplineTestMode, setShoplineTestMode] = useState(initialShopline.testMode)
  const [shoplineEnabledMethods, setShoplineEnabledMethods] = useState<
    ShoplinePaymentMethodCode[]
  >(initialShopline.enabledMethods)

  // Stripe
  const [stripeSecretKey, setStripeSecretKey] = useState('')
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('')

  // PAYUNi
  const [payuniMerchantId, setPayuniMerchantId] = useState(initialPayuni.merchantId)
  const [payuniHashKey, setPayuniHashKey] = useState('')
  const [payuniHashIV, setPayuniHashIV] = useState('')
  const [payuniTestMode, setPayuniTestMode] = useState(initialPayuni.testMode)

  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    const hasChanges =
      gateway !== initialGateway ||
      shoplineMerchantId !== initialShopline.merchantId ||
      shoplineApiKey !== '' ||
      shoplineClientKey !== '' ||
      shoplineSignKey !== '' ||
      shoplineTestMode !== initialShopline.testMode ||
      shoplineEnabledMethods.join(',') !== initialShopline.enabledMethods.join(',') ||
      stripeSecretKey !== '' ||
      stripeWebhookSecret !== '' ||
      payuniMerchantId !== initialPayuni.merchantId ||
      payuniHashKey !== '' ||
      payuniHashIV !== '' ||
      payuniTestMode !== initialPayuni.testMode
    setIsDirty(hasChanges)
  }, [
    gateway,
    initialGateway,
    shoplineMerchantId,
    shoplineApiKey,
    shoplineClientKey,
    shoplineSignKey,
    shoplineTestMode,
    shoplineEnabledMethods,
    stripeSecretKey,
    stripeWebhookSecret,
    payuniMerchantId,
    payuniHashKey,
    payuniHashIV,
    payuniTestMode,
    initialShopline.merchantId,
    initialShopline.testMode,
    initialShopline.enabledMethods,
    initialPayuni.merchantId,
    initialPayuni.testMode,
  ])

  async function handleSave() {
    if (gateway === 'shopline' && shoplineEnabledMethods.length === 0) {
      toast.error('請至少選擇一種 SHOPLINE 付款方式')
      return
    }

    startSaveTransition(async () => {
      try {
        const result = await updatePaymentSettings({
          gateway,
          shoplineMerchantId: shoplineMerchantId || undefined,
          shoplineApiKey: shoplineApiKey || undefined,
          shoplineClientKey: shoplineClientKey || undefined,
          shoplineSignKey: shoplineSignKey || undefined,
          shoplineTestMode,
          shoplineEnabledMethods,
          stripeSecretKey: stripeSecretKey || undefined,
          stripeWebhookSecret: stripeWebhookSecret || undefined,
          payuniMerchantId: payuniMerchantId || undefined,
          payuniHashKey: payuniHashKey || undefined,
          payuniHashIV: payuniHashIV || undefined,
          payuniTestMode,
        })

        if (result.success) {
          toast.success('金流設定已儲存')
          setIsDirty(false)
        } else {
          toast.error(result.error || '儲存失敗')
        }
      } catch {
        toast.error('儲存設定失敗')
      }
    })
  }

  async function handleTestConnection() {
    if (gateway === 'shopline' && shoplineEnabledMethods.length === 0) {
      toast.error('請至少選擇一種 SHOPLINE 付款方式')
      return
    }

    setTestResult(null)
    startTestTransition(async () => {
      try {
        const result = await testPaymentConnection(gateway, {
          shoplineMerchantId: shoplineMerchantId || undefined,
          shoplineApiKey: shoplineApiKey || undefined,
          shoplineClientKey: shoplineClientKey || undefined,
          shoplineSignKey: shoplineSignKey || undefined,
          shoplineTestMode,
          shoplineEnabledMethods,
          stripeSecretKey: stripeSecretKey || undefined,
          stripeWebhookSecret: stripeWebhookSecret || undefined,
          payuniMerchantId: payuniMerchantId || undefined,
          payuniHashKey: payuniHashKey || undefined,
          payuniHashIV: payuniHashIV || undefined,
          payuniTestMode,
        })
        setTestResult(result)
        if (result.success) {
          toast.success('連線測試成功')
        } else {
          toast.error(result.message)
        }
      } catch {
        toast.error('測試連線失敗')
        setTestResult({ success: false, message: '測試連線時發生錯誤' })
      }
    })
  }

  function toggleShoplineMethod(method: ShoplinePaymentMethodCode) {
    setShoplineEnabledMethods((current) => {
      if (current.includes(method)) {
        return current.filter((item) => item !== method)
      }
      return [...current, method]
    })
  }

  async function handleCopy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success('已複製到剪貼簿')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('複製失敗')
    }
  }

  const gatewayOptions: {
    value: GatewayType
    title: string
    description: string
    recommended?: boolean
  }[] = [
    {
      value: 'shopline',
      title: 'SHOPLINE Payments',
      description: '主力推薦。支援信用卡、Apple Pay、LINE Pay、ATM',
      recommended: true,
    },
    {
      value: 'stripe',
      title: 'Stripe',
      description: '國際金流，支援信用卡、Apple Pay、Google Pay',
    },
    {
      value: 'payuni',
      title: 'PAYUNi 統一金流',
      description: '台灣在地金流，支援信用卡、ATM、超商代碼',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Gateway 選擇 */}
      <Card className="bg-white border border-divider rounded-xl">
        <CardHeader>
          <CardTitle className="text-heading">金流閘道</CardTitle>
          <CardDescription className="text-body">
            選擇要使用的金流服務（三擇一）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            {gatewayOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setGateway(opt.value)
                  setTestResult(null)
                }}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  gateway === opt.value
                    ? 'border-cta bg-cta/5'
                    : 'border-divider hover:border-[#A3A3A3]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-heading">{opt.title}</p>
                      {opt.recommended && (
                        <Badge className="bg-cta/10 text-cta hover:bg-cta/10">
                          <Sparkles className="mr-1 h-3 w-3" />
                          主推
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-body mt-1 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      gateway === opt.value
                        ? 'border-cta'
                        : 'border-[#D4D4D4]'
                    }`}
                  >
                    {gateway === opt.value && (
                      <div className="h-2.5 w-2.5 rounded-full bg-cta" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shopline 設定 */}
      {gateway === 'shopline' && (
        <Card className="bg-white border border-divider rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-heading">
                  SHOPLINE Payments 設定
                </CardTitle>
                <CardDescription className="text-body">
                  商店代號、API Key、Client Key、Sign Key 與沙盒切換
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={
                  initialShopline.isConfigured
                    ? 'border-green-500 text-green-600 bg-green-50'
                    : 'border-cta text-cta bg-cta/10'
                }
              >
                {initialShopline.isConfigured ? '已設定' : '未設定'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Onboarding 引導 */}
            {!initialShopline.isConfigured && (
              <div className="rounded-xl border border-cta/20 bg-cta/5 p-4">
                <p className="text-sm font-semibold text-heading mb-2">
                  還沒有 SHOPLINE Payments 帳號？
                </p>
                <ol className="space-y-1.5 text-sm text-body list-decimal list-inside">
                  <li>
                    前往{' '}
                    <a
                      href="https://docs.shoplinepayments.com/kyc/kycOverview/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cta underline hover:text-cta-hover"
                    >
                      特店申請頁面
                    </a>
                    ，選擇「<strong>直連特店</strong>」並完成 KYC 送件
                  </li>
                  <li>等待審核（一般 3-5 個工作天）</li>
                  <li>
                    審核通過後登入{' '}
                    <a
                      href="https://login.shoplinepayments.com/zh-Hant/signin/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cta underline hover:text-cta-hover"
                    >
                      SHOPLINE Payments 後台
                    </a>{' '}
                    → <strong>開發者管理</strong> → 取得 apiKey / signKey
                  </li>
                  <li>先填 merchantId / apiKey / clientKey，並複製下方 Webhook URL 提供給串接窗口設定</li>
                  <li>收到 signKey 回信後，再回來補上即可正式啟用 webhook 驗證</li>
                </ol>
                <p className="mt-3 text-xs text-caption">
                  想先試用？直接使用沙盒模式，沙盒帳號可於文件中取得 →{' '}
                  <a
                    href="https://docs.shoplinepayments.com/overview/sandboxResource/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cta underline hover:text-cta-hover"
                  >
                    沙盒環境資源
                  </a>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-heading">商店代號 (merchantId)</Label>
              <Input
                value={shoplineMerchantId}
                onChange={(e) => setShoplineMerchantId(e.target.value)}
                placeholder="SHOPLINE 後台 → 開發者管理 → merchantId"
                className="border-divider font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-heading">API Key</Label>
              <Input
                type="password"
                value={shoplineApiKey}
                onChange={(e) => setShoplineApiKey(e.target.value)}
                placeholder={
                  initialShopline.apiKeyHint || 'SHOPLINE 後台 → 開發者管理'
                }
                className="border-divider font-mono"
              />
              <p className="text-xs text-caption">
                {initialShopline.apiKeyHint
                  ? `目前已設定（${initialShopline.apiKeyHint}），留空則不變更`
                  : '用於 Server API 認證'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Client Key</Label>
              <Input
                value={shoplineClientKey}
                onChange={(e) => setShoplineClientKey(e.target.value)}
                placeholder={initialShopline.clientKeyHint || 'pk_sandbox_... / pk_live_...'}
                className="border-divider font-mono"
              />
              <p className="text-xs text-caption">
                {initialShopline.clientKeyHint
                  ? `目前已設定（${initialShopline.clientKeyHint}），留空則不變更`
                  : '內嵌式 SDK 會用到；導轉式目前不強制，但建議一併保存'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Sign Key</Label>
              <Input
                type="password"
                value={shoplineSignKey}
                onChange={(e) => setShoplineSignKey(e.target.value)}
                placeholder={initialShopline.signKeyHint || 'HMAC-SHA256 驗簽金鑰'}
                className="border-divider font-mono"
              />
              <p className="text-xs text-caption">
                {initialShopline.signKeyHint
                  ? `目前已設定（${initialShopline.signKeyHint}），留空則不變更`
                  : 'Webhook URL 提交給 SHOPLINE 後，會由對方產生並回信提供'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shoplineTestMode}
                  onChange={(e) => setShoplineTestMode(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D4D4D4]"
                />
                <span className="text-sm text-heading">
                  沙盒模式（Sandbox）
                </span>
              </label>
              <span className="text-xs text-caption">
                {shoplineTestMode
                  ? '使用 api-sandbox.shoplinepayments.com'
                  : '使用正式環境 api.shoplinepayments.com'}
              </span>
            </div>

            <div className="space-y-3 rounded-xl border border-divider bg-surface p-4">
              <div>
                <Label className="text-heading">啟用的付款方式</Label>
                <p className="mt-1 text-xs text-caption">
                  預設保留信用卡、Apple Pay、LINE Pay；ATM 需確認 SHOPLINE Payments 後台資格已開通後再勾選。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SHOPLINE_PAYMENT_METHOD_CODES.map((method) => (
                  <label
                    key={method}
                    className="flex items-center gap-3 rounded-lg border border-divider bg-white px-3 py-2 text-sm text-heading"
                  >
                    <input
                      type="checkbox"
                      checked={shoplineEnabledMethods.includes(method)}
                      onChange={() => toggleShoplineMethod(method)}
                      className="h-4 w-4 rounded border-[#D4D4D4]"
                    />
                    <span>{SHOPLINE_PAYMENT_METHOD_LABELS[method]}</span>
                    {method === 'VirtualAccount' && (
                      <Badge className="ml-auto bg-cta/10 text-cta hover:bg-cta/10">
                        ATM
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
              {shoplineEnabledMethods.length === 0 && (
                <p className="text-xs text-red-600">
                  請至少選擇一種付款方式。
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Webhook URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={initialShopline.webhookUrl}
                  disabled
                  className="bg-surface border-divider text-body font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    handleCopy(initialShopline.webhookUrl, 'shopline-webhook')
                  }
                  className="border-divider shrink-0"
                >
                  {copied === 'shopline-webhook' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-caption">
                提供此 URL 給 SHOPLINE 串接窗口，用於接收付款成功/失敗事件通知
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Return URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={initialShopline.returnUrl}
                  disabled
                  className="bg-surface border-divider text-body font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    handleCopy(initialShopline.returnUrl, 'shopline-return')
                  }
                  className="border-divider shrink-0"
                >
                  {copied === 'shopline-return' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <ConnectionTestBlock
              isTesting={isTesting}
              onTest={handleTestConnection}
              result={testResult}
            />
          </CardContent>
        </Card>
      )}

      {/* Stripe 設定 */}
      {gateway === 'stripe' && (
        <Card className="bg-white border border-divider rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-heading">Stripe 設定</CardTitle>
                <CardDescription className="text-body">
                  Stripe 支付服務金鑰與 Webhook 設定
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={
                  initialStripe.isConfigured
                    ? 'border-green-500 text-green-600 bg-green-50'
                    : 'border-cta text-cta bg-cta/10'
                }
              >
                {initialStripe.isConfigured ? '已設定' : '未設定'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-heading">Secret Key</Label>
              <Input
                type="password"
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
                placeholder={
                  initialStripe.secretKeyHint || 'sk_test_... 或 sk_live_...'
                }
                className="border-divider font-mono"
              />
              <p className="text-xs text-caption">
                {initialStripe.secretKeyHint
                  ? `目前已設定（${initialStripe.secretKeyHint}），留空則不變更`
                  : 'Stripe Dashboard → Developers → API Keys'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Webhook Signing Secret</Label>
              <Input
                type="password"
                value={stripeWebhookSecret}
                onChange={(e) => setStripeWebhookSecret(e.target.value)}
                placeholder={initialStripe.webhookSecretHint || 'whsec_...'}
                className="border-divider font-mono"
              />
              {initialStripe.webhookSecretHint && (
                <p className="text-xs text-caption">
                  目前已設定（{initialStripe.webhookSecretHint}），留空則不變更
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Webhook URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={initialStripe.webhookUrl}
                  disabled
                  className="bg-surface border-divider text-body font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    handleCopy(initialStripe.webhookUrl, 'stripe-webhook')
                  }
                  className="border-divider shrink-0"
                >
                  {copied === 'stripe-webhook' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-caption space-y-1">
                <p>
                  請在 Stripe Dashboard 的 Webhooks 頁面設定此 URL，並監聽以下事件：
                </p>
                <ul className="list-disc pl-5 space-y-0.5 font-mono">
                  <li>checkout.session.completed</li>
                  <li>checkout.session.async_payment_succeeded</li>
                  <li>checkout.session.async_payment_failed</li>
                  <li>invoice.paid</li>
                  <li>invoice.payment_failed</li>
                  <li>invoice.payment_action_required</li>
                  <li>invoice.finalization_failed</li>
                  <li>customer.subscription.updated</li>
                  <li>customer.subscription.deleted</li>
                  <li>customer.subscription.paused</li>
                  <li>customer.subscription.resumed</li>
                  <li>charge.refunded</li>
                  <li>charge.dispute.created</li>
                  <li>charge.dispute.closed</li>
                </ul>
                <p className="text-caption/80">
                  發票與訂閱事件負責續扣、補繳、暫停及終止；退款與爭議事件負責同步撤權與帳務狀態。若事件未完整訂閱，金流後台與本站資料可能不一致。
                </p>
              </div>
            </div>

            <ConnectionTestBlock
              isTesting={isTesting}
              onTest={handleTestConnection}
              result={testResult}
            />
          </CardContent>
        </Card>
      )}

      {/* PAYUNi 設定 */}
      {gateway === 'payuni' && (
        <Card className="bg-white border border-divider rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-heading">PAYUNi 統一金流設定</CardTitle>
                <CardDescription className="text-body">
                  PAYUNi 商店代號與加密金鑰設定
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={
                  initialPayuni.isConfigured
                    ? 'border-green-500 text-green-600 bg-green-50'
                    : 'border-cta text-cta bg-cta/10'
                }
              >
                {initialPayuni.isConfigured ? '已設定' : '未設定'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-heading">商店代號 (MerID)</Label>
              <Input
                value={payuniMerchantId}
                onChange={(e) => setPayuniMerchantId(e.target.value)}
                placeholder="U00000000"
                className="border-divider font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Hash Key（32 字元）</Label>
              <Input
                type="password"
                value={payuniHashKey}
                onChange={(e) => setPayuniHashKey(e.target.value)}
                placeholder={initialPayuni.hashKeyHint || '32 字元加密金鑰'}
                className="border-divider font-mono"
                maxLength={32}
              />
              <p className="text-xs text-caption">
                {initialPayuni.hashKeyHint
                  ? `目前已設定（${initialPayuni.hashKeyHint}），留空則不變更`
                  : `目前長度：${payuniHashKey.length}/32 字元`}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Hash IV（16 字元）</Label>
              <Input
                type="password"
                value={payuniHashIV}
                onChange={(e) => setPayuniHashIV(e.target.value)}
                placeholder={initialPayuni.hashIVHint || '16 字元加密向量'}
                className="border-divider font-mono"
                maxLength={16}
              />
              <p className="text-xs text-caption">
                {initialPayuni.hashIVHint
                  ? `目前已設定（${initialPayuni.hashIVHint}），留空則不變更`
                  : `目前長度：${payuniHashIV.length}/16 字元`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payuniTestMode}
                  onChange={(e) => setPayuniTestMode(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D4D4D4]"
                />
                <span className="text-sm text-heading">測試模式（Sandbox）</span>
              </label>
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Notify URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={initialPayuni.notifyUrl}
                  disabled
                  className="bg-surface border-divider text-body font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(initialPayuni.notifyUrl, 'payuni-notify')}
                  className="border-divider shrink-0"
                >
                  {copied === 'payuni-notify' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-heading">Return URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={initialPayuni.returnUrl}
                  disabled
                  className="bg-surface border-divider text-body font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(initialPayuni.returnUrl, 'payuni-return')}
                  className="border-divider shrink-0"
                >
                  {copied === 'payuni-return' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-caption">
                請在 PAYUNi 商家後台設定以上 Return URL 和 Notify URL
              </p>
            </div>

            <ConnectionTestBlock
              isTesting={isTesting}
              onTest={handleTestConnection}
              result={testResult}
            />
          </CardContent>
        </Card>
      )}

      {/* 相關資源 */}
      <Card className="bg-white border border-divider rounded-xl">
        <CardHeader>
          <CardTitle className="text-heading">相關資源</CardTitle>
          <CardDescription className="text-body">
            {gateway === 'shopline'
              ? 'SHOPLINE Payments'
              : gateway === 'stripe'
              ? 'Stripe'
              : 'PAYUNi'}{' '}
            開發文件和後台連結
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gateway === 'shopline' && (
            <>
              <a
                href="https://login.shoplinepayments.com/zh-Hant/signin/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:text-cta-hover transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                SHOPLINE Payments 後台
              </a>
              <a
                href="https://docs.shoplinepayments.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:text-cta-hover transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                串接規格文件
              </a>
              <a
                href="https://docs.shoplinepayments.com/overview/sandboxResource/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:text-cta-hover transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                沙盒環境資源
              </a>
            </>
          )}
          {gateway === 'stripe' && (
            <>
              <a
                href="https://dashboard.stripe.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:text-cta-hover transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Stripe Dashboard
              </a>
              <a
                href="https://docs.stripe.com/checkout"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:text-cta-hover transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Checkout 開發文件
              </a>
              <a
                href="https://docs.stripe.com/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:text-cta-hover transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Webhooks 開發文件
              </a>
            </>
          )}
          {gateway === 'payuni' && (
            <>
              <a
                href="https://www.payuni.com.tw/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:text-cta-hover transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                PAYUNi 官網
              </a>
              <a
                href="https://docs.payuni.com.tw/web/#/7/24"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:text-cta-hover transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                統一金流 API 文件
              </a>
            </>
          )}
        </CardContent>
      </Card>

      <StickySaveBar
        isDirty={isDirty}
        isPending={isSaving}
        onSubmit={handleSave}
        label="儲存設定"
      />
    </div>
  )
}

function ConnectionTestBlock({
  isTesting,
  onTest,
  result,
}: {
  isTesting: boolean
  onTest: () => void
  result: { success: boolean; message: string } | null
}) {
  return (
    <>
      <div className="flex items-center justify-end pt-4 border-t border-divider">
        <Button
          type="button"
          onClick={onTest}
          disabled={isTesting}
          variant="outline"
          className="border-cta text-cta hover:bg-cta/10 rounded-full"
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              測試中...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              測試連線
            </>
          )}
        </Button>
      </div>

      {result && (
        <div
          className={`rounded-xl p-4 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  result.success ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {result.success ? '連線成功' : '連線失敗'}
              </p>
              <p className="text-sm text-body mt-1">{result.message}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
