import { listNewsletters } from '@/lib/actions/newsletters'
import { NewsletterList } from '@/components/admin/newsletter/newsletter-list'

export const metadata = {
  title: '電子報 | 後台管理',
}

export default async function NewslettersPage() {
  const data = await listNewsletters()
  return (
    <div className="space-y-6 p-6">
      <NewsletterList campaigns={data.campaigns} stats={data.stats} alerts={data.alerts} />
    </div>
  )
}
