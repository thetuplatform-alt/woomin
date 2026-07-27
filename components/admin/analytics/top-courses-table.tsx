// components/admin/analytics/top-courses-table.tsx
// 熱門課程排行表格元件
// 顯示銷售排名前幾名的課程

'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trophy, ExternalLink, BookOpen, Boxes } from 'lucide-react'
import type { TopCourse } from '@/lib/actions/analytics'

interface TopCoursesTableProps {
  courses: TopCourse[]
}

// 格式化金額
function formatAmount(amount: number): string {
  return `NT$ ${amount.toLocaleString()}`
}

// 排名樣式
const rankStyles: Record<number, string> = {
  1: 'bg-cta text-white',
  2: 'bg-heading text-white',
  3: 'bg-heading text-white',
}

export function TopCoursesTable({ courses }: TopCoursesTableProps) {
  if (courses.length === 0) {
    return (
      <Card className="bg-white border-divider">
        <CardHeader>
          <CardTitle className="text-heading flex items-center gap-2">
            <Trophy className="h-5 w-5 text-cta" />
            熱門商品排行
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface border border-divider flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-caption" />
            </div>
            <h3 className="text-lg font-medium text-heading mb-2">
              暫無銷售數據
            </h3>
            <p className="text-sm text-caption">
              開始銷售後，熱門課程與組合包將顯示於此
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border-divider">
      <CardHeader>
        <CardTitle className="text-heading flex items-center gap-2">
          <Trophy className="h-5 w-5 text-cta" />
          熱門商品排行
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-divider overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-divider hover:bg-transparent bg-surface">
                <TableHead className="text-body w-16 text-center">
                  排名
                </TableHead>
                <TableHead className="text-body">商品名稱</TableHead>
                <TableHead className="text-body text-center w-24">
                  訂單數
                </TableHead>
                <TableHead className="text-body text-right w-32">
                  總營收
                </TableHead>
                <TableHead className="text-body w-16 text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course, index) => {
                const rank = index + 1
                const rankStyle = rankStyles[rank] || 'bg-heading text-body'

                return (
                  <TableRow
                    key={course.courseId}
                    className="border-divider hover:bg-surface"
                  >
                    {/* 排名 */}
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${rankStyle}`}
                      >
                        {rank}
                      </span>
                    </TableCell>

                    {/* 商品名稱 */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {course.coverImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={course.coverImage}
                            alt={course.courseTitle}
                            className="w-12 h-8 object-cover rounded-lg"
                          />
                        )}
                        <div className="min-w-0">
                          <span className="block text-heading font-medium line-clamp-1">
                            {course.courseTitle}
                          </span>
                          <Badge variant="outline" className="mt-1 gap-1">
                            {course.itemType === 'bundle' ? (
                              <Boxes className="h-3 w-3" />
                            ) : (
                              <BookOpen className="h-3 w-3" />
                            )}
                            {course.itemType === 'bundle' ? '組合包' : '課程'}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>

                    {/* 訂單數 */}
                    <TableCell className="text-center">
                      <span className="text-body">
                        {course.totalOrders} 筆
                      </span>
                    </TableCell>

                    {/* 總營收 */}
                    <TableCell className="text-right">
                      <span className="text-cta font-medium">
                        {formatAmount(course.totalRevenue)}
                      </span>
                    </TableCell>

                    {/* 操作 */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-surface"
                      >
                        <Link
                          href={
                            course.itemType === 'bundle'
                              ? `/admin/bundles/${course.courseId}`
                              : `/admin/courses/${course.courseId}`
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">查看商品</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
