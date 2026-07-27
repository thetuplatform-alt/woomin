// components/admin/users/user-progress.tsx
// 用戶學習進度
// 顯示用戶各課程的學習進度

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import type { CourseProgress } from '@/lib/actions/users'

interface UserProgressProps {
  progress: CourseProgress[]
}

// 格式化時間
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours} 小時 ${minutes} 分鐘`
  }
  return `${minutes} 分鐘`
}

export function UserProgress({ progress }: UserProgressProps) {
  // 計算總體統計
  const totalCourses = progress.length
  const completedCourses = progress.filter((p) => p.progressPercent === 100).length
  const totalWatchedDuration = progress.reduce((sum, p) => sum + p.watchedDuration, 0)

  return (
    <Card className="bg-white border-divider rounded-xl">
      <CardHeader>
        <CardTitle className="text-heading flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          學習進度
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 總體統計 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface border border-divider rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-heading">{totalCourses}</p>
            <p className="text-xs text-body">已購課程</p>
          </div>
          <div className="bg-surface border border-divider rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-cta">{completedCourses}</p>
            <p className="text-xs text-body">已完成</p>
          </div>
          <div className="bg-surface border border-divider rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-heading">
              {formatDuration(totalWatchedDuration)}
            </p>
            <p className="text-xs text-body">總學習時間</p>
          </div>
        </div>

        {/* 各課程進度 */}
        {progress.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center mb-3">
              <TrendingUp className="h-6 w-6 text-caption" />
            </div>
            <p className="text-body text-sm">
              尚無學習進度記錄
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {progress.map((courseProgress) => (
              <div
                key={courseProgress.courseId}
                className="p-4 bg-surface border border-divider rounded-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-heading">
                    {courseProgress.courseTitle}
                  </h4>
                  {courseProgress.progressPercent === 100 ? (
                    <Badge className="bg-cta hover:bg-cta-hover text-white">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      已完成
                    </Badge>
                  ) : (
                    <span className="text-sm text-body">
                      {courseProgress.progressPercent}%
                    </span>
                  )}
                </div>

                {/* 進度條 */}
                <Progress
                  value={courseProgress.progressPercent}
                  className="h-2 bg-[#E5E5E5]"
                />

                {/* 詳細資訊 */}
                <div className="flex items-center gap-4 mt-2 text-xs text-caption">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {courseProgress.completedLessons} / {courseProgress.totalLessons} 單元
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    已觀看 {formatDuration(courseProgress.watchedDuration)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
