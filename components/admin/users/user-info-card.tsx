// components/admin/users/user-info-card.tsx
// 用戶資訊卡片
// 顯示用戶基本資訊

import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Calendar, Mail, Phone, User as UserIcon } from 'lucide-react'
import type { UserRole } from '@prisma/client'

interface UserInfoCardProps {
  user: {
    id: string
    name: string | null
    email: string
    phone: string | null
    image: string | null
    role: UserRole
    createdAt: Date
  }
  purchaseCount?: number
  lastActiveAt?: Date | null
}

// 角色顯示設定
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

export function UserInfoCard({
  user,
  purchaseCount = 0,
  lastActiveAt,
}: UserInfoCardProps) {
  const role = roleConfig[user.role]

  return (
    <Card className="bg-white border-divider rounded-xl">
      <CardHeader>
        <CardTitle className="text-heading">用戶資訊</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center text-center">
          {/* 頭像 */}
          <Avatar className="h-24 w-24 mb-4">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? '用戶'} />
            <AvatarFallback className="bg-surface text-body text-2xl border border-divider">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>

          {/* 姓名與角色 */}
          <h3 className="text-xl font-semibold text-heading mb-2">
            {user.name || '未設定姓名'}
          </h3>
          <Badge className={role.className}>{role.label}</Badge>

          {/* 詳細資訊 */}
          <div className="w-full mt-6 space-y-4">
            {/* Email */}
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-surface border border-divider flex items-center justify-center">
                <Mail className="h-5 w-5 text-body" />
              </div>
              <div>
                <p className="text-xs text-caption">電子郵件</p>
                <p className="text-sm text-heading">{user.email}</p>
              </div>
            </div>

            {/* 電話 */}
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-surface border border-divider flex items-center justify-center">
                <Phone className="h-5 w-5 text-body" />
              </div>
              <div>
                <p className="text-xs text-caption">電話號碼</p>
                <p className="text-sm text-heading">{user.phone || '未提供'}</p>
              </div>
            </div>

            {/* 註冊日期 */}
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-surface border border-divider flex items-center justify-center">
                <Calendar className="h-5 w-5 text-body" />
              </div>
              <div>
                <p className="text-xs text-caption">註冊日期</p>
                <p className="text-sm text-heading">
                  {format(new Date(user.createdAt), 'yyyy年MM月dd日', {
                    locale: zhTW,
                  })}
                </p>
              </div>
            </div>

            {/* 購買課程數 */}
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-surface border border-divider flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-body" />
              </div>
              <div>
                <p className="text-xs text-caption">已購課程</p>
                <p className="text-sm text-heading">{purchaseCount} 門課程</p>
              </div>
            </div>

            {/* 最後上線時間 */}
            {lastActiveAt && (
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-surface border border-divider flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-body" />
                </div>
                <div>
                  <p className="text-xs text-caption">最後上線</p>
                  <p className="text-sm text-heading">
                    {format(new Date(lastActiveAt), 'yyyy/MM/dd HH:mm', {
                      locale: zhTW,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
