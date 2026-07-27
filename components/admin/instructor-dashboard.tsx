// components/admin/instructor-dashboard.tsx
// 講師專屬儀表板（僅顯示自己可管理課程的概況）

import Link from 'next/link'
import { BookOpen, Users, DollarSign, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InstructorDashboardData } from '@/lib/actions/instructor-dashboard'
import type { CourseStatus } from '@prisma/client'

const STATUS_LABEL: Record<CourseStatus, { label: string; className: string }> = {
  PUBLISHED: { label: '已發佈', className: 'bg-green-100 text-green-700' },
  DRAFT: { label: '草稿', className: 'bg-gray-100 text-gray-600' },
  UNLISTED: { label: '隱藏', className: 'bg-amber-100 text-amber-700' },
}

function formatCurrency(amount: number) {
  return `NT$ ${amount.toLocaleString('zh-TW')}`
}

export function InstructorDashboard({
  userName,
  data,
}: {
  userName: string
  data: InstructorDashboardData
}) {
  const stats = [
    {
      label: '我的課程',
      value: data.totalCourses.toString(),
      icon: BookOpen,
    },
    {
      label: '學員人數',
      value: data.totalStudents.toLocaleString('zh-TW'),
      icon: Users,
    },
    {
      label: '課程營收',
      value: formatCurrency(data.totalRevenue),
      icon: DollarSign,
    },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* 標題與引導 */}
      <div>
        <h2 className="text-xl font-bold text-heading">歡迎回來，{userName}</h2>
        <p className="text-body mt-1">
          以下是你負責課程的概況。你可以在「課程管理」編輯內容、在「留言管理」回覆學員、在「訂單管理」查看成交紀錄。
        </p>
      </div>

      {data.totalCourses === 0 ? (
        <Card className="bg-white border-divider rounded-xl">
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-caption" />
            <p className="text-heading font-medium mt-4">你目前還沒有被指派任何課程</p>
            <p className="text-body mt-1">
              請聯絡平台管理員，把你加入要負責的課程後，這裡就會顯示課程概況。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 統計卡片 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <Card key={stat.label} className="bg-white border-divider rounded-xl">
                <CardContent className="flex items-center gap-4 py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface">
                    <stat.icon className="h-6 w-6 text-heading" />
                  </div>
                  <div>
                    <p className="text-body text-sm">{stat.label}</p>
                    <p className="text-2xl font-bold text-heading">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 我的課程 */}
          <Card className="bg-white border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading">我的課程</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.courses.map((course) => {
                const status = STATUS_LABEL[course.status]
                return (
                  <Link
                    key={course.id}
                    href={`/admin/courses/${course.id}/info`}
                    className="flex items-center justify-between rounded-lg border border-divider px-4 py-3 transition-colors hover:bg-surface"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-heading">
                          {course.title}
                        </span>
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-xs ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="text-body text-sm mt-0.5">
                        {course.studentCount} 位學員 · {formatCurrency(course.revenue)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-caption" />
                  </Link>
                )
              })}
            </CardContent>
          </Card>

          {/* 最近訂單 */}
          <Card className="bg-white border-divider rounded-xl">
            <CardHeader>
              <CardTitle className="text-heading">最近成交</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentOrders.length === 0 ? (
                <p className="text-body py-6 text-center text-sm">尚無成交紀錄</p>
              ) : (
                <div className="space-y-2">
                  {data.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border border-divider px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-heading">
                          {order.courseTitle}
                        </p>
                        <p className="text-body text-sm">
                          {order.userName} · {order.orderNo}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-heading">
                        {formatCurrency(order.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
