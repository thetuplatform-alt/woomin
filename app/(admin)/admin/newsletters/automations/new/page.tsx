import { getNewsletterAutomationEditorOptions } from '@/lib/actions/newsletter-automations'
import { NewsletterAutomationEditor } from '@/components/admin/newsletter/automation-editor'

export const metadata = {
  title: '新增電子報自動化 | 後台管理',
}

export default async function NewNewsletterAutomationPage() {
  const options = await getNewsletterAutomationEditorOptions()

  return (
    <div className="space-y-6 p-6">
      <NewsletterAutomationEditor options={options} />
    </div>
  )
}
