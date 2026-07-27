import { listNewsletterAutomations } from '@/lib/actions/newsletter-automations'
import { NewsletterAutomationList } from '@/components/admin/newsletter/automation-list'

export const metadata = {
  title: '電子報自動化 | 後台管理',
}

export default async function NewsletterAutomationsPage() {
  const data = await listNewsletterAutomations()

  return (
    <div className="space-y-6 p-6">
      <NewsletterAutomationList {...data} />
    </div>
  )
}
