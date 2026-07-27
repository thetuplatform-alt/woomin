// components/main/my-subscriptions/invoice-prefs-form.tsx
// 「更新發票資訊（適用未來期款）」表單（AC-55）。
// 複用結帳頁發票欄位邏輯與 checkoutInvoiceSchema 驗證，更新訂閱快照。

'use client'

import { useState } from 'react'
import { FileText, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  checkoutInvoiceSchema,
  type CheckoutInvoiceType,
} from '@/lib/validations/einvoice'
import { updateMySubscriptionInvoicePrefs } from '@/lib/actions/subscriptions'
import type {
  MySubscription,
  SubscriptionInvoicePrefs,
} from '@/lib/actions/subscriptions'

interface InvoicePrefsFormProps {
  subscription: MySubscription
  onUpdated: () => void
}

function initialCarrierType(prefs: SubscriptionInvoicePrefs): 'member' | 'mobile' {
  return prefs.carrierType === 'mobile' ? 'mobile' : 'member'
}

export function InvoicePrefsForm({ subscription, onUpdated }: InvoicePrefsFormProps) {
  const prefs = subscription.invoicePrefs
  const [isOpen, setIsOpen] = useState(false)

  const [invoiceType, setInvoiceType] = useState<CheckoutInvoiceType>(
    prefs.invoiceType ?? 'PERSONAL'
  )
  const [carrierType, setCarrierType] = useState<'member' | 'mobile'>(
    initialCarrierType(prefs)
  )
  const [carrierId, setCarrierId] = useState(prefs.carrierId ?? '')
  const [invoiceTaxId, setInvoiceTaxId] = useState(prefs.taxId ?? '')
  const [invoiceTitle, setInvoiceTitle] = useState(prefs.title ?? '')
  const [invoiceAddress, setInvoiceAddress] = useState(prefs.address ?? '')
  const [loveCode, setLoveCode] = useState(prefs.loveCode ?? '')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setSaved(false)

    const payload = {
      invoiceType,
      carrierType: invoiceType === 'PERSONAL' ? carrierType : undefined,
      carrierId:
        invoiceType === 'PERSONAL' && carrierType === 'mobile'
          ? carrierId.trim().toUpperCase()
          : '',
      taxId: invoiceType === 'COMPANY' ? invoiceTaxId.trim() : '',
      title: invoiceType === 'COMPANY' ? invoiceTitle.trim() : '',
      address: invoiceType === 'COMPANY' ? invoiceAddress.trim() : '',
      loveCode: invoiceType === 'DONATION' ? loveCode.trim() : '',
    }

    // 前端先用同一份 schema 驗證，錯誤即時回饋
    const parsed = checkoutInvoiceSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || '發票資訊有誤')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await updateMySubscriptionInvoicePrefs(
        subscription.id,
        parsed.data
      )
      if (result.success) {
        setSaved(true)
        onUpdated()
      } else {
        setError(result.error || '更新失敗，請稍後再試')
      }
    } catch {
      setError('更新發票資訊時發生錯誤')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-divider bg-surface/40">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-heading">
          <FileText className="h-4 w-4 text-caption" />
          更新發票資訊（適用未來期款）
        </span>
        <span className="text-xs text-caption">{isOpen ? '收合' : '展開'}</span>
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-divider p-4">
          <p className="text-xs text-caption">
            此設定僅套用於未來各期扣款的發票開立，不影響已開立的過往發票。
          </p>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['PERSONAL', '個人'],
                ['COMPANY', '公司'],
                ['DONATION', '捐贈'],
              ] as [CheckoutInvoiceType, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setInvoiceType(val)}
                className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                  invoiceType === val
                    ? 'border-cta bg-cta/5 text-cta'
                    : 'border-divider text-body hover:border-[#A3A3A3]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {invoiceType === 'PERSONAL' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['member', '雲端發票（存會員載具）'],
                    ['mobile', '手機條碼載具'],
                  ] as ['member' | 'mobile', string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCarrierType(val)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      carrierType === val
                        ? 'border-cta bg-cta/5 text-cta'
                        : 'border-divider text-body hover:border-[#A3A3A3]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {carrierType === 'mobile' && (
                <Input
                  value={carrierId}
                  onChange={(e) => setCarrierId(e.target.value)}
                  placeholder="/ABC1234（手機條碼）"
                  className="h-11 rounded-xl border-divider font-mono uppercase"
                  maxLength={8}
                />
              )}
            </div>
          )}

          {invoiceType === 'COMPANY' && (
            <div className="space-y-2">
              <Input
                value={invoiceTaxId}
                onChange={(e) => setInvoiceTaxId(e.target.value)}
                placeholder="統一編號（8 碼）"
                className="h-11 rounded-xl border-divider font-mono"
                maxLength={8}
              />
              <Input
                value={invoiceTitle}
                onChange={(e) => setInvoiceTitle(e.target.value)}
                placeholder="公司抬頭"
                className="h-11 rounded-xl border-divider"
              />
              <Input
                value={invoiceAddress}
                onChange={(e) => setInvoiceAddress(e.target.value)}
                placeholder="公司地址（開立三聯式發票需要）"
                className="h-11 rounded-xl border-divider"
              />
            </div>
          )}

          {invoiceType === 'DONATION' && (
            <Input
              value={loveCode}
              onChange={(e) => setLoveCode(e.target.value)}
              placeholder="捐贈碼 / 愛心碼（3-7 碼數字）"
              className="h-11 rounded-xl border-divider font-mono"
              maxLength={7}
            />
          )}

          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              已更新，將套用於下一期扣款
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl"
          >
            {isSubmitting ? '儲存中…' : '儲存發票資訊'}
          </Button>
        </div>
      )}
    </div>
  )
}
