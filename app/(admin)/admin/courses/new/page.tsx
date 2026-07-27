// app/(admin)/admin/courses/new/page.tsx
// 新增課程頁
// 提供課程新增表單

import Link from 'next/link'
import { CourseForm } from '@/components/admin/courses/course-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '新增課程',
}

export default function NewCoursePage() {
  return (
    <div className="space-y-8 p-6 md:p-10">
      {/* 頁面標題 */}
      <div className="flex items-center gap-4">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-body hover:text-heading hover:bg-surface rounded-lg"
        >
          <Link href="/admin/courses">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-bold text-heading">新增課程</h2>
          <p className="text-body mt-1">
            先填寫建立課程最重要的資訊，其餘內容可在建立後到編輯頁補上。
          </p>
        </div>
      </div>

      {/* 課程表單 */}
      <CourseForm />
    </div>
  )
}
