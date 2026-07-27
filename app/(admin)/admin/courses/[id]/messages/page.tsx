// app/(admin)/admin/courses/[id]/messages/page.tsx
// 課程私訊 - 本課程的老師私訊收件匣

import { getPrivateMessageConversations } from '@/lib/actions/private-messages-admin'
import { PrivateMessageInbox } from '@/components/admin/messages/private-message-inbox'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '私訊',
}

interface CourseMessagesPageProps {
  params: Promise<{ id: string }>
}

export default async function CourseMessagesPage({
  params,
}: CourseMessagesPageProps) {
  const { id: courseId } = await params
  const conversations = await getPrivateMessageConversations(courseId)

  return (
    <div className="h-full overflow-y-auto p-4">
      <PrivateMessageInbox
        courseId={courseId}
        initialConversations={conversations}
      />
    </div>
  )
}
