// app/(admin)/admin/courses/[id]/comments/page.tsx
// 課程留言管理 - 依單元管理（私訊已獨立至「私訊」分頁）

import { ContentLayout } from '@/components/admin/course-editor/content-layout'
import { CommentSummaryPanel } from '@/components/admin/comments/comment-summary-panel'
import { LessonCommentsAdminPanel } from '@/components/admin/comments/lesson-comments-admin-panel'

export const metadata = {
  title: '課程留言',
}

interface CommentsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CommentsPage({ params }: CommentsPageProps) {
  const { id: courseId } = await params

  return (
    <ContentLayout
      leftPanel={<CommentSummaryPanel courseId={courseId} />}
      centerPanel={
        <div className="space-y-8">
          <LessonCommentsAdminPanel />
        </div>
      }
      rightPanel={
        <div className="p-6 space-y-3">
          <h2 className="text-sm font-bold text-heading">提示</h2>
          <ul className="text-sm text-body list-disc pl-5 space-y-2">
            <li>左側選擇有留言的單元，即可管理該單元的留言。</li>
            <li>紅色數字表示未讀留言，點擊後自動標記為已讀。</li>
            <li>匿名留言在前台只會顯示「學員」，但後台會顯示真實身份。</li>
            <li>學員「私訊老師」已移到上方「私訊」分頁，可獨立查看與回覆。</li>
            <li>刪除為軟刪除：前台不再顯示，但仍保留追蹤資訊。</li>
          </ul>
        </div>
      }
    />
  )
}
