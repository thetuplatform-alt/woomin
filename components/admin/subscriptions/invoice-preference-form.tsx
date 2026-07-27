// components/admin/subscriptions/invoice-preference-form.tsx
// 訂閱發票偏好編輯（適用未來期款）。
// 複用 checkoutInvoiceSchema 的欄位語意；權威驗證在 server action。

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateSubscriptionInvoicePreference } from '@/lib/actions/subscriptions-admin'
import type { SubscriptionDetail } from '@/lib/actions/subscriptions-admin'

type InvoiceType = 'PERSONAL' | 'COMPANY' | 'DONATION'
type CarrierType = 'member' | 'mobile'

interface InvoicePreferenceFormProps {
  subscriptionId: string
  initial: SubscriptionDetail['invoice']
}

const typeOptions: Array<[InvoiceType, string]> = [
  ['PERSONAL', '個人'],
  ['COMPANY', '公司（統編）'],
  ['DONATION', '捐贈'],
]

const carrierOptions: Array<[CarrierType, string]> = [
  ['member', '雲端發票（會員載具）'],
  ['mobile', '手機條碼載具'],
]

export function InvoicePreferenceForm({
  subscriptionId,
  initial,
}: InvoicePreferenceFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    initial.invoiceType ?? 'PERSONAL'
  )
  const [carrierType, setCarrierType] = useState<CarrierType>(
    (initial.carrierType as CarrierType) ?? 'member'
  )
  const [carrierId, setCarrierId] = useState(initial.carrierId ?? '')
  const [taxId, setTaxId] = useState(initial.taxId ?? '')
  const [title, setTitle] = useState(initial.title ?? '')
  const [address, setAddress] = useState(initial.address ?? '')
  const [loveCode, setLoveCode] = useState(initial.loveCode ?? '')

  const handleSave = async () => {
    try {
      setIsSubmitting(true)
      const payload = {
        invoiceType,
        carrierType: invoiceType === 'PERSONAL' ? carrierType : undefined,
        carrierId:
          invoiceType === 'PERSONAL' && carrierType === 'mobile'
            ? carrierId.trim().toUpperCase()
            : '',
        taxId: invoiceType === 'COMPANY' ? taxId.trim() : '',
        title: invoiceType === 'COMPANY' ? title.trim() : '',
        address: invoiceType === 'COMPANY' ? address.trim() : '',
        loveCode: invoiceType === 'DONATION' ? loveCode.trim() : '',
      }
      const result = await updateSubscriptionInvoicePreference(
        subscriptionId,
        payload
      )
      if (!result.success) {
        throw new Error(result.error || '更新失敗')
      }
      toast.success('發票偏好已更新（適用未來期款）')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失敗，請稍後再試')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-caption">
        修改僅套用於<strong>未來期款</strong>的發票，已開立的發票不受影響。
      </p>

      {/* 發票類型 */}
      <div className="space-y-1.5">
        <Label className="text-heading">發票類型</Label>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setInvoiceType(val)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                invoiceType === val
                  ? 'border-cta bg-cta text-white'
                  : 'border-divider text-body hover:bg-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 個人載具 */}
      {invoiceType === 'PERSONAL' && (
        <div className="space-y-1.5">
          <Label className="text-heading">載具類別</Label>
          <div className="flex flex-wrap gap-2">
            {carrierOptions.map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setCarrierType(val)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  carrierType === val
                    ? 'border-cta bg-cta text-white'
                    : 'border-divider text-body hover:bg-surface'
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
              placeholder="手機條碼（/ 開頭 + 7 碼，如 /AB12345）"
              className="bg-white border-divider text-heading rounded-lg max-w-xs mt-2"
            />
          )}
        </div>
      )}

      {/* 公司 */}
      {invoiceType === 'COMPANY' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-heading">統一編號</Label>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="8 碼數字"
              className="bg-white border-divider text-heading rounded-lg max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-heading">公司抬頭</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="公司抬頭"
              className="bg-white border-divider text-heading rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-heading">公司地址</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="公司地址（開立三聯式發票需要）"
              className="bg-white border-divider text-heading rounded-lg"
            />
          </div>
        </div>
      )}

      {/* 捐贈 */}
      {invoiceType === 'DONATION' && (
        <div className="space-y-1.5">
          <Label className="text-heading">捐贈碼 / 愛心碼</Label>
          <Input
            value={loveCode}
            onChange={(e) => setLoveCode(e.target.value)}
            placeholder="3-7 碼數字"
            className="bg-white border-divider text-heading rounded-lg max-w-xs"
          />
        </div>
      )}

      <Button
        type="button"
        disabled={isSubmitting}
        onClick={handleSave}
        className="bg-cta hover:bg-cta-hover text-white rounded-lg"
      >
        {isSubmitting ? '儲存中...' : '儲存發票偏好'}
      </Button>
    </div>
  )
}
