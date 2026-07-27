import { getNewsletter, getNewsletterEditorOptions } from '@/lib/actions/newsletters'
import { NewsletterEditor } from '@/components/admin/newsletter/newsletter-editor'

export const metadata = {
  title: '編輯電子報 | 後台管理',
}

export default async function NewsletterEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [campaign, options] = await Promise.all([
    getNewsletter(id),
    getNewsletterEditorOptions(),
  ])

  return (
    <NewsletterEditor
      campaign={JSON.parse(JSON.stringify(campaign))}
      options={JSON.parse(JSON.stringify(options))}
    />
  )
}
