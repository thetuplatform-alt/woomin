'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ClipboardCheck, FileQuestion, Eye, HardDrive } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { SubmissionList } from '@/components/admin/assignment/submission-list'
import { QuizResultsList } from '@/components/admin/quiz/quiz-results-list'
import { getAssignmentStorageUsage } from '@/lib/actions/assignment'

interface AssignmentsPageClientProps {
  course: {
    id: string
    title: string
    chapters: Array<{
      id: string
      title: string
      order: number
      lessons: Array<{
        id: string
        title: string
        order: number
        assignment: {
          id: string
          title: string
          gradingType: string
          _count: { submissions: number }
        } | null
        quiz: {
          id: string
          _count: { attempts: number }
        } | null
      }>
    }>
  }
}

export function AssignmentsPageClient({ course }: AssignmentsPageClientProps) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null)
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)
  const [storageUsage, setStorageUsage] = useState<{
    usedBytes: number
    quotaBytes: number
    quotaGB: number
    usagePercent: number
    isWarning: boolean
  } | null>(null)

  useEffect(() => {
    getAssignmentStorageUsage().then((res) => {
      if (res.success && res.data) setStorageUsage(res.data)
    })
  }, [])

  // 收集所有有作業或測驗的單元
  const lessonsWithContent = course.chapters.flatMap((chapter) =>
    chapter.lessons
      .filter((lesson) => lesson.assignment || lesson.quiz)
      .map((lesson) => ({
        ...lesson,
        chapterTitle: chapter.title,
      }))
  )

  const totalAssignments = lessonsWithContent.filter(
    (l) => l.assignment
  ).length
  const totalQuizzes = lessonsWithContent.filter((l) => l.quiz).length
  const totalSubmissions = lessonsWithContent.reduce(
    (sum, l) => sum + (l.assignment?._count.submissions ?? 0),
    0
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 統計摘要 */}
      <div data-tour="assignments-summary" className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{totalAssignments}</p>
              <p className="text-sm text-muted-foreground">作業數</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileQuestion className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{totalQuizzes}</p>
              <p className="text-sm text-muted-foreground">測驗數</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{totalSubmissions}</p>
              <p className="text-sm text-muted-foreground">作業提交數</p>
            </div>
          </div>
        </Card>
      </div>

      {/* 儲存容量 */}
      {storageUsage && (
        <Card className={`p-4 ${storageUsage.isWarning ? 'border-amber-400 bg-amber-50' : ''}`}>
          <div className="flex items-center gap-3 mb-2">
            <HardDrive className={`h-5 w-5 ${storageUsage.isWarning ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium">
              作業附件儲存空間
              {storageUsage.isWarning && (
                <Badge variant="outline" className="ml-2 text-amber-600 border-amber-400">
                  容量警告
                </Badge>
              )}
            </span>
          </div>
          <Progress value={storageUsage.usagePercent} className="h-2 mb-1" />
          <p className="text-xs text-muted-foreground">
            已使用 {(storageUsage.usedBytes / 1024 / 1024).toFixed(1)} MB / {storageUsage.quotaGB} GB（{storageUsage.usagePercent}%）
          </p>
        </Card>
      )}

      {/* 單元列表 */}
      {lessonsWithContent.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">尚未設定任何測驗或作業</h3>
          <p className="text-sm text-muted-foreground">
            請到「課程內容」頁面，在各單元的右側設定面板中新增測驗或作業。
          </p>
        </Card>
      ) : (
        <Card data-tour="lessons-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>章節 / 單元</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>提交 / 作答</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessonsWithContent.map((lesson) => (
                <TableRow key={lesson.id}>
                  <TableCell>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {lesson.chapterTitle}
                      </p>
                      <p className="font-medium">{lesson.title}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {lesson.quiz && (
                        <Badge variant="secondary">測驗</Badge>
                      )}
                      {lesson.assignment && (
                        <Badge variant="outline">
                          {lesson.assignment.gradingType === 'PASS_FAIL'
                            ? '通過制'
                            : lesson.assignment.gradingType === 'PERCENTAGE'
                              ? '百分制'
                              : '等第制'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-3">
                      {lesson.quiz && (
                        <span className="text-sm text-muted-foreground">
                          {lesson.quiz._count.attempts} 次作答
                        </span>
                      )}
                      {lesson.assignment && (
                        <span className="text-sm text-muted-foreground">
                          {lesson.assignment._count.submissions} 份提交
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {lesson.quiz && lesson.quiz._count.attempts > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedQuizId(lesson.quiz!.id)
                          }
                        >
                          查看作答結果
                        </Button>
                      )}
                      {lesson.assignment &&
                        lesson.assignment._count.submissions > 0 && (
                          <Button
                            data-tour="grade-assignment-btn"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSelectedAssignmentId(lesson.assignment!.id)
                            }
                          >
                            批改作業
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 作業提交列表 Dialog */}
      <Dialog
        open={!!selectedAssignmentId}
        onOpenChange={(open) => !open && setSelectedAssignmentId(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedAssignmentId && (
            <SubmissionList
              assignmentId={selectedAssignmentId}
              courseId={course.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 測驗作答結果 Dialog */}
      <Dialog
        open={!!selectedQuizId}
        onOpenChange={(open) => !open && setSelectedQuizId(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedQuizId && <QuizResultsList quizId={selectedQuizId} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
