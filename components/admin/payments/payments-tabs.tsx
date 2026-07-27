'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CreditCard, ReceiptText } from 'lucide-react'
import { PaymentSettingsForm } from '@/components/admin/settings/payment-settings-form'
import { EInvoiceSettingsForm } from '@/components/admin/payments/einvoice-settings-form'
import type { EInvoiceSettingsView } from '@/lib/actions/einvoice'

interface PaymentsTabsProps {
  paymentSettings: {
    gateway: 'shopline' | 'stripe' | 'payuni'
    shopline: React.ComponentProps<typeof PaymentSettingsForm>['shopline']
    stripe: React.ComponentProps<typeof PaymentSettingsForm>['stripe']
    payuni: React.ComponentProps<typeof PaymentSettingsForm>['payuni']
  }
  einvoiceSettings: EInvoiceSettingsView
}

export function PaymentsTabs({ paymentSettings, einvoiceSettings }: PaymentsTabsProps) {
  return (
    <Tabs defaultValue="collection" className="w-full">
      <TabsList className="h-auto w-full justify-start gap-1 bg-secondary p-1 sm:w-fit">
        <TabsTrigger data-tour="payments-tab-collection" value="collection" className="gap-1.5 px-4 py-2">
          <CreditCard className="h-4 w-4" />
          金流收款
        </TabsTrigger>
        <TabsTrigger data-tour="payments-tab-einvoice" value="einvoice" className="gap-1.5 px-4 py-2">
          <ReceiptText className="h-4 w-4" />
          臺灣統一發票
        </TabsTrigger>
      </TabsList>

      <TabsContent value="collection" className="mt-6">
        <PaymentSettingsForm
          initialGateway={paymentSettings.gateway}
          shopline={paymentSettings.shopline}
          stripe={paymentSettings.stripe}
          payuni={paymentSettings.payuni}
        />
      </TabsContent>

      <TabsContent value="einvoice" className="mt-6">
        <EInvoiceSettingsForm initialData={einvoiceSettings} />
      </TabsContent>
    </Tabs>
  )
}
