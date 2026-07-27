import Link from 'next/link'
import { ArrowRight, Wrench } from 'lucide-react'
import { getPaymentSettings } from '@/lib/actions/settings'
import { getEInvoiceSettings } from '@/lib/actions/einvoice'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { PaymentsTabs } from '@/components/admin/payments/payments-tabs'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '金流收款 | 後台',
}

export default async function PaymentsPage() {
  await requireOnlyAdminAuth()

  const [paymentSettings, einvoiceSettings] = await Promise.all([
    getPaymentSettings(),
    getEInvoiceSettings(),
  ])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-heading">金流收款</h1>
        <p className="mt-1 text-body">
          設定線上收款金流與臺灣電子發票。兩者各自獨立——用什麼金流收款，與用哪家加值中心開立發票互不影響。
        </p>
      </div>

      <Link href="/admin/payments/invoice-reconciliation" className="block">
        <Card className="rounded-xl border-divider bg-white transition-colors hover:bg-surface">
          <CardContent className="flex items-center justify-between pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cta/10">
                <Wrench className="h-5 w-5 text-cta" />
              </div>
              <div>
                <p className="font-medium text-heading">舊訂單發票資料修復</p>
                <p className="text-sm text-body">
                  找出已付款但發票資料不完整的訂單，單筆或批次重新開立
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-caption" />
          </CardContent>
        </Card>
      </Link>

      <PaymentsTabs
        paymentSettings={paymentSettings}
        einvoiceSettings={einvoiceSettings}
      />
    </div>
  )
}
