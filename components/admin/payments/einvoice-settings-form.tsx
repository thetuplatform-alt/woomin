// components/admin/payments/einvoice-settings-form.tsx
// 臺灣統一發票設定表單
// 支援綠界 ECPay / 藍新 ezPay 兩家加值中心；預設關閉，啟用後填憑證即可串接。

'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  updateEInvoiceSettings,
  testEInvoiceConnection,
  type EInvoiceSettingsView,
} from '@/lib/actions/einvoice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ReceiptText,
  AlertTriangle,
} from 'lucide-react'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
import type { EInvoiceProvider } from '@/lib/validations/einvoice'

interface EInvoiceSettingsFormProps {
  initialData: EInvoiceSettingsView
}

const PROVIDER_OPTIONS: {
  value: EInvoiceProvider
  title: string
  description: string
  recommended?: boolean
  hashKeyLen: number
}[] = [
  {
    value: 'ecpay',
    title: '綠界 ECPay',
    description: '文件完整、新戶常有免費額度，最易上手。B2C 電子發票 2.0。',
    recommended: true,
    hashKeyLen: 16,
  },
  {
    value: 'ezpay',
    title: '藍新 ezPay',
    description: '用 PAYUNi 收款的商家常搭配 ezPay 開立發票。',
    hashKeyLen: 32,
  },
]

export function EInvoiceSettingsForm({ initialData }: EInvoiceSettingsFormProps) {
  const [isSaving, startSaveTransition] = useTransition()
  const [isTesting, startTestTransition] = useTransition()

  const [enabled, setEnabled] = useState(initialData.enabled)
  const [provider, setProvider] = useState<EInvoiceProvider>(initialData.provider)
  const [merchantId, setMerchantId] = useState(initialData.merchantId)
  const [hashKey, setHashKey] = useState('')
  const [hashIV, setHashIV] = useState('')
  const [testMode, setTestMode] = useState(initialData.testMode)
  const [autoIssue, setAutoIssue] = useState(initialData.autoIssue)
  const [sellerName, setSellerName] = useState(initialData.sellerName)
  const [sellerTaxId, setSellerTaxId] = useState(initialData.sellerTaxId)

  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    kind: 'issued' | 'verified' | 'error'
  } | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const hashKeyLen = PROVIDER_OPTIONS.find((p) => p.value === provider)?.hashKeyLen ?? 16

  useEffect(() => {
    const hasChanges =
      enabled !== initialData.enabled ||
      provider !== initialData.provider ||
      merchantId !== initialData.merchantId ||
      hashKey !== '' ||
      hashIV !== '' ||
      testMode !== initialData.testMode ||
      autoIssue !== initialData.autoIssue ||
      sellerName !== initialData.sellerName ||
      sellerTaxId !== initialData.sellerTaxId
    setIsDirty(hasChanges)
  }, [
    enabled,
    provider,
    merchantId,
    hashKey,
    hashIV,
    testMode,
    autoIssue,
    sellerName,
    sellerTaxId,
    initialData,
  ])

  function handleSave() {
    startSaveTransition(async () => {
      try {
        const result = await updateEInvoiceSettings({
          enabled,
          provider,
          merchantId: merchantId || '',
          hashKey: hashKey || '',
          hashIV: hashIV || '',
          testMode,
          autoIssue,
          sellerName: sellerName || '',
          sellerTaxId: sellerTaxId || '',
        })
        if (result.success) {
          toast.success('電子發票設定已儲存')
          setHashKey('')
          setHashIV('')
          setIsDirty(false)
        } else {
          toast.error(result.error || '儲存失敗')
        }
      } catch {
        toast.error('儲存設定失敗')
      }
    })
  }

  function handleTest() {
    setTestResult(null)
    startTestTransition(async () => {
      try {
        const result = await testEInvoiceConnection({
          provider,
          merchantId: merchantId || undefined,
          hashKey: hashKey || undefined,
          hashIV: hashIV || undefined,
          testMode,
        })
        setTestResult(result)
        if (result.success) {
          toast.success(result.kind === 'verified' ? '正式環境憑證驗證成功' : '測試開立成功')
        }
        else toast.error(result.message)
      } catch {
        toast.error('測試失敗')
        setTestResult({ success: false, message: '測試時發生錯誤', kind: 'error' })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* 啟用開關 */}
      <Card data-tour="payments-einvoice-enable" className="bg-white border border-divider rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-heading">
                <ReceiptText className="h-5 w-5 text-primary" />
                臺灣統一發票
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="cursor-help border-amber-200 bg-amber-100 text-amber-700"
                    >
                      實驗性功能
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    此功能處於 Beta 版本，如果發現任何問題，請直接回報。
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription className="text-body">
                啟用後，可在學員付款成功時自動 / 手動開立電子發票（透過加值中心）。
              </CardDescription>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-[#D4D4D4] accent-cta"
              />
              <span className="text-sm font-medium text-heading">
                {enabled ? '已啟用' : '未啟用'}
              </span>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="space-y-1 text-sm text-body">
                <p className="font-semibold text-heading">開立發票前，你必須是有統編的營業人</p>
                <p>個人無法開立統一發票。</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {enabled && (
        <>
          {/* 供應商選擇 */}
          <Card className="bg-white border border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading">發票供應商</CardTitle>
              <CardDescription className="text-body">選擇要使用的加值中心（二擇一）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {PROVIDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setProvider(opt.value)
                      setTestResult(null)
                    }}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      provider === opt.value
                        ? 'border-cta bg-cta/5'
                        : 'border-divider hover:border-[#A3A3A3]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-heading">{opt.title}</p>
                          {opt.recommended && (
                            <Badge className="bg-cta/10 text-cta hover:bg-cta/10">推薦</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-body">{opt.description}</p>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          provider === opt.value ? 'border-cta' : 'border-[#D4D4D4]'
                        }`}
                      >
                        {provider === opt.value && <div className="h-2.5 w-2.5 rounded-full bg-cta" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 憑證與賣方資訊 */}
          <Card className="bg-white border border-divider rounded-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-heading">
                    {provider === 'ecpay' ? '綠界 ECPay' : '藍新 ezPay'} 串接設定
                  </CardTitle>
                  <CardDescription className="text-body">商店代號與加密金鑰、賣方資訊</CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={
                    initialData.isConfigured
                      ? 'border-green-500 bg-green-50 text-green-600'
                      : 'border-cta bg-cta/10 text-cta'
                  }
                >
                  {initialData.isConfigured ? '已設定' : '未設定'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-heading">商店代號（MerchantID）</Label>
                <Input
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder={provider === 'ecpay' ? '如 2000132（測試）' : 'ezPay 商店代號'}
                  className="border-divider font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-heading">HashKey（{hashKeyLen} 字元）</Label>
                <Input
                  type="password"
                  value={hashKey}
                  onChange={(e) => setHashKey(e.target.value)}
                  placeholder={initialData.hashKeyHint || `${hashKeyLen} 字元加密金鑰`}
                  className="border-divider font-mono"
                  maxLength={hashKeyLen}
                />
                <p className="text-xs text-caption">
                  {initialData.hashKeyHint
                    ? `目前已設定（${initialData.hashKeyHint}），留空則不變更`
                    : `目前長度：${hashKey.length}/${hashKeyLen} 字元`}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-heading">HashIV（16 字元）</Label>
                <Input
                  type="password"
                  value={hashIV}
                  onChange={(e) => setHashIV(e.target.value)}
                  placeholder={initialData.hashIVHint || '16 字元加密向量'}
                  className="border-divider font-mono"
                  maxLength={16}
                />
                <p className="text-xs text-caption">
                  {initialData.hashIVHint
                    ? `目前已設定（${initialData.hashIVHint}），留空則不變更`
                    : `目前長度：${hashIV.length}/16 字元`}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-heading">賣方名稱（公司抬頭）</Label>
                  <Input
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    placeholder="會印在發票上的賣方名稱"
                    className="border-divider"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-heading">賣方統一編號</Label>
                  <Input
                    value={sellerTaxId}
                    onChange={(e) => setSellerTaxId(e.target.value)}
                    placeholder="8 碼統編"
                    className="border-divider font-mono"
                    maxLength={8}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-divider pt-4 sm:flex-row sm:items-center sm:gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="h-4 w-4 rounded border-[#D4D4D4] accent-cta"
                  />
                  <span className="text-sm text-heading">測試模式（Stage）</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoIssue}
                    onChange={(e) => setAutoIssue(e.target.checked)}
                    className="h-4 w-4 rounded border-[#D4D4D4] accent-cta"
                  />
                  <span className="text-sm text-heading">付款成功後自動開立發票</span>
                </label>
              </div>

              {!testMode && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  正式模式只會執行<strong>唯讀查詢</strong>來驗證連線與憑證，不會開票或消耗字軌。
                </p>
              )}

              {/* 測試開立 */}
              <div className="flex items-center justify-end border-t border-divider pt-4">
                <Button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  variant="outline"
                  className="rounded-full border-cta text-cta hover:bg-cta/10"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      測試中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {testMode ? '測試連線 / 試開發票' : '驗證正式憑證（不開票）'}
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <div
                  className={`rounded-xl p-4 ${
                    testResult.success
                      ? 'border border-green-200 bg-green-50'
                      : 'border border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          testResult.success ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {testResult.success
                          ? testResult.kind === 'verified'
                            ? '正式連線成功'
                            : '測試開立成功'
                          : '測試失敗'}
                      </p>
                      <p className="mt-1 text-sm text-body">{testResult.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 相關資源 */}
          <Card className="bg-white border border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading">相關資源</CardTitle>
              <CardDescription className="text-body">
                {provider === 'ecpay' ? '綠界 ECPay' : '藍新 ezPay'} 後台與開發文件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {provider === 'ecpay' ? (
                <>
                  <a
                    href="https://www.ecpay.com.tw/Business/invoice"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-cta transition-colors hover:text-cta-hover"
                  >
                    <ExternalLink className="h-4 w-4" />
                    綠界電子發票整合平台
                  </a>
                  <a
                    href="https://developers.ecpay.com.tw/?p=24230"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-cta transition-colors hover:text-cta-hover"
                  >
                    <ExternalLink className="h-4 w-4" />
                    綠界電子發票 API 文件
                  </a>
                </>
              ) : (
                <>
                  <a
                    href="https://inv.ezpay.com.tw/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-cta transition-colors hover:text-cta-hover"
                  >
                    <ExternalLink className="h-4 w-4" />
                    藍新 ezPay 電子發票
                  </a>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <StickySaveBar
        isDirty={isDirty}
        isPending={isSaving}
        onSubmit={handleSave}
        label="儲存設定"
      />
    </div>
  )
}
