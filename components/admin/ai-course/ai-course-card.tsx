// components/admin/ai-course/ai-course-card.tsx
// AI 快速建立課程入口卡片

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, FolderUp, Zap } from 'lucide-react'
import { AICourseDialog } from './ai-course-dialog'

interface AICourseCardProps {
  courseId: string
  onSuccess?: () => void
}

export function AICourseCard({ courseId, onSuccess }: AICourseCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50 rounded-xl overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5A524] to-[#E09000] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-heading">AI 快速建立課程</CardTitle>
              <CardDescription className="text-body">
                拖入資料夾，自動生成課程內容
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 功能說明 */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-body">
                <FolderUp className="w-4 h-4 text-cta" />
                <span>批量上傳影片</span>
              </div>
              <div className="flex items-center gap-2 text-body">
                <Zap className="w-4 h-4 text-cta" />
                <span>AI 生成內文</span>
              </div>
            </div>

            {/* 操作按鈕 */}
            <Button
              onClick={() => setDialogOpen(true)}
              className="w-full bg-cta hover:bg-cta-hover text-white rounded-lg"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              開始建立
            </Button>
          </div>
        </CardContent>
      </Card>

      <AICourseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        courseId={courseId}
        onSuccess={onSuccess}
      />
    </>
  )
}
