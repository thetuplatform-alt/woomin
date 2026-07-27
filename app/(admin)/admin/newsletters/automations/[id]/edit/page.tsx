import { getNewsletterAutomation, getNewsletterAutomationEditorOptions } from '@/lib/actions/newsletter-automations'
import { NewsletterAutomationEditor } from '@/components/admin/newsletter/automation-editor'

export const metadata = {
  title: '編輯電子報自動化 | 後台管理',
}

export default async function EditNewsletterAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [automation, options] = await Promise.all([
    getNewsletterAutomation(id),
    getNewsletterAutomationEditorOptions(),
  ])

  return (
    <div className="space-y-6 p-6">
      <NewsletterAutomationEditor automation={automation} options={options} />
    </div>
  )
}
