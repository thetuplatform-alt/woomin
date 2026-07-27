// app/(admin)/admin/messages/page.tsx
// 老師私訊 - 全站收件匣（所有可管理課程）

import { getPrivateMessageConversations } from '@/lib/actions/private-messages-admin'
import { PrivateMessageInbox } from '@/components/admin/messages/private-message-inbox'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '老師私訊',
}

export default async function AdminMessagesPage() {
  const conversations = await getPrivateMessageConversations()

  return (
    <div className="h-full">
      <PrivateMessageInbox initialConversations={conversations} />
    </div>
  )
}
