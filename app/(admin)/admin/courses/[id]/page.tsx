// app/(admin)/admin/courses/[id]/page.tsx
// 課程編輯頁 - 重新導向到 /info

import { redirect } from 'next/navigation'

interface EditCoursePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditCoursePage({ params }: EditCoursePageProps) {
  const { id } = await params
  redirect(`/admin/courses/${id}/info`)
}
