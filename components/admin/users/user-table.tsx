// components/admin/users/user-table.tsx
// 用戶表格元件
// 顯示學員列表，支援操作功能

'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { UserWithPurchaseCount } from '@/lib/actions/users'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Users } from 'lucide-react'
import type { UserRole } from '@prisma/client'

interface UserTableProps {
  users: UserWithPurchaseCount[]
}

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  USER: {
    label: '學員',
    className: 'bg-surface hover:bg-surface text-body border border-divider',
  },
  INSTRUCTOR: {
    label: '講師',
    className: 'bg-cta hover:bg-cta-hover text-white',
  },
  EDITOR: {
    label: '講師',
    className: 'bg-cta hover:bg-cta-hover text-white',
  },
  ADMIN: {
    label: '管理員',
    className: 'bg-heading hover:bg-heading text-white',
  },
}

// 取得用戶名稱縮寫
function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function UserTable({ users }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-surface border border-divider flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-caption" />
        </div>
        <h3 className="text-lg font-medium text-heading mb-2">
          尚未有學員
        </h3>
        <p className="text-sm text-body mb-4">
          目前沒有符合條件的學員資料
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-divider overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-divider hover:bg-transparent bg-surface">
            <TableHead className="text-body w-12">頭像</TableHead>
            <TableHead className="text-body">姓名</TableHead>
            <TableHead className="text-body">Email</TableHead>
            <TableHead className="text-body w-24">角色</TableHead>
            <TableHead className="text-body">電話</TableHead>
            <TableHead className="text-body w-32 text-center">
              已購課程數
            </TableHead>
            <TableHead className="text-body w-32">註冊日期</TableHead>
            <TableHead className="text-body w-36 text-right">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              className="border-divider hover:bg-surface"
            >
              {/* 頭像 */}
              <TableCell>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? '用戶'} />
                  <AvatarFallback className="bg-surface text-body border border-divider">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </TableCell>

              {/* 姓名 */}
              <TableCell>
                <p className="font-medium text-heading">
                  {user.name || '未設定姓名'}
                </p>
              </TableCell>

              {/* Email */}
              <TableCell>
                <p className="text-body text-sm">{user.email}</p>
              </TableCell>

              <TableCell>
                <Badge className={roleConfig[user.role].className}>
                  {roleConfig[user.role].label}
                </Badge>
              </TableCell>

              {/* 電話 */}
              <TableCell>
                <p className="text-body text-sm">
                  {user.phone || '-'}
                </p>
              </TableCell>

              {/* 已購課程數 */}
              <TableCell className="text-center">
                <Badge
                  variant={user._count.purchases > 0 ? 'default' : 'secondary'}
                  className={
                    user._count.purchases > 0
                      ? 'bg-cta hover:bg-cta-hover text-white'
                      : 'bg-surface hover:bg-surface text-body border border-divider'
                  }
                >
                  {user._count.purchases} 門課程
                </Badge>
              </TableCell>

              {/* 註冊日期 */}
              <TableCell>
                <p className="text-body text-sm">
                  {format(new Date(user.createdAt), 'yyyy/MM/dd', {
                    locale: zhTW,
                  })}
                </p>
              </TableCell>

              {/* 操作 */}
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
                >
                  <Link href={`/admin/users/${user.id}`}>
                    <BookOpen className="mr-1.5 h-4 w-4" />
                    編輯持有課程
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
