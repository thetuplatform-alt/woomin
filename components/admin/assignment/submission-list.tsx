// components/admin/assignment/submission-list.tsx
// 後台作業提交列表

'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Loader2, ClipboardCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getAssignmentSubmissions,
  getAssignmentStatistics,
} from '@/lib/actions/assignment'
import { ReviewPanel } from './review-panel'

interface SubmissionListProps {
  assignmentId: string
  courseId: string
}

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Submission = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Statistics = any

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待批改' },
  { value: 'APPROVED', label: '已通過' },
  { value: 'NEEDS_REVISION', label: '退回修改' },
  { value: 'REJECTED', label: '不通過' },
]

const SUBMISSION_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  SUBMITTED: {
    label: '待批改',
    className: 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]',
  },
  UNDER_REVIEW: {
    label: '批改中',
    className: 'bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD]',
  },
  APPROVED: {
    label: '已通過',
    className: 'bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]',
  },
  NEEDS_REVISION: {
    label: '退回修改',
    className: 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]',
  },
  REJECTED: {
    label: '不通過',
    className: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]',
  },
  DRAFT: {
    label: '草稿',
    className: 'bg-muted text-muted-foreground border border-border',
  },
}

function StatCard({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${highlight ? 'border-amber-300 bg-amber-50' : ''}`}>
      <p className={`text-xl font-bold ${highlight ? 'text-amber-700' : 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

export function SubmissionList({ assignmentId }: SubmissionListProps) {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [stats, setStats] = useState<Statistics | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [reviewSubmissionId, setReviewSubmissionId] = useState<string | null>(null)

  const loadData = useCallback(
    async (filter: StatusFilter = 'ALL') => {
      setLoading(true)
      try {
        const statusMap: Record<StatusFilter, string | undefined> = {
          ALL: undefined,
          PENDING: 'SUBMITTED',
          APPROVED: 'APPROVED',
          NEEDS_REVISION: 'NEEDS_REVISION',
          REJECTED: 'REJECTED',
        }

        const [subResult, statResult] = await Promise.all([
          getAssignmentSubmissions(
            assignmentId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            statusMap[filter] as any
          ),
          getAssignmentStatistics(assignmentId),
        ])

        if (subResult.success) setSubmissions(subResult.data ?? [])
        if (statResult.success) setStats(statResult.data)
      } finally {
        setLoading(false)
      }
    },
    [assignmentId]
  )

  useEffect(() => {
    loadData(statusFilter)
  }, [loadData, statusFilter])

  function handleFilterChange(value: string) {
    setStatusFilter(value as StatusFilter)
  }

  function handleReviewed() {
    setReviewSubmissionId(null)
    loadData(statusFilter)
  }

  const pendingCount = stats ? stats.pending : 0

  return (
    <div className="space-y-4">
      {/* 統計摘要 */}
      {stats && (
        <div data-tour="submission-stats" className="grid grid-cols-5 gap-3">
          <StatCard label="總提交" value={stats.total} />
          <StatCard label="待批改" value={stats.pending} highlight={stats.pending > 0} />
          <StatCard label="已通過" value={stats.approved} />
          <StatCard label="退回修改" value={stats.revision} />
          <StatCard
            label={stats.averageScore != null ? `平均 ${stats.averageScore} 分` : '不通過'}
            value={stats.rejected}
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              提交列表
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex h-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">
                  {pendingCount}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(statusFilter)}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-1 text-xs">重新整理</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={statusFilter} onValueChange={handleFilterChange}>
            <TabsList className="mb-4">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {statusFilter === 'ALL' ? '尚無提交紀錄' : '此分類目前沒有提交'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    <TableHead className="text-xs font-medium">學員</TableHead>
                    <TableHead className="text-xs font-medium">送出時間</TableHead>
                    <TableHead className="text-xs font-medium text-center">版本</TableHead>
                    <TableHead className="text-xs font-medium text-center">狀態</TableHead>
                    <TableHead className="text-xs font-medium text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub: Submission) => {
                    const statusStyle =
                      SUBMISSION_STATUS_STYLES[sub.status] ?? SUBMISSION_STATUS_STYLES.SUBMITTED
                    const isPending =
                      sub.status === 'SUBMITTED' || sub.status === 'UNDER_REVIEW'

                    return (
                      <TableRow key={sub.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">
                              {sub.user?.name || '未設定姓名'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sub.user?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {sub.submittedAt
                              ? format(new Date(sub.submittedAt), 'MM/dd HH:mm', { locale: zhTW })
                              : '—'}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground">
                            v{sub.version ?? 1}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${statusStyle.className}`}>
                            {statusStyle.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={isPending ? 'default' : 'outline'}
                            className="h-7 text-xs"
                            onClick={() => setReviewSubmissionId(sub.id)}
                          >
                            {isPending ? '批改' : '查看'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批改 Dialog */}
      <Dialog
        open={!!reviewSubmissionId}
        onOpenChange={(open) => {
          if (!open) setReviewSubmissionId(null)
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批改作業</DialogTitle>
          </DialogHeader>
          {reviewSubmissionId && (
            <ReviewPanel
              submissionId={reviewSubmissionId}
              onClose={() => setReviewSubmissionId(null)}
              onReviewed={handleReviewed}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
