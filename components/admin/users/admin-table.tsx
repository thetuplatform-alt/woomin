// components/admin/users/admin-table.tsx
// 管理員表格元件
// 顯示管理員和講師列表，支援角色切換

'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { updateUserRole, type AdminUser } from '@/lib/actions/users'
import type { UserRole } from '@prisma/client'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Shield, Loader2 } from 'lucide-react'

interface AdminTableProps {
  admins: AdminUser[]
  currentUserId: string
}

type EditableRole = Extract<UserRole, 'USER' | 'INSTRUCTOR' | 'ADMIN'>

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

export function AdminTable({ admins, currentUserId }: AdminTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false)
  const [userToChange, setUserToChange] = useState<AdminUser | null>(null)
  const [newRole, setNewRole] = useState<EditableRole | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)

  // 處理角色變更點擊
  function handleRoleChange(admin: AdminUser, role: EditableRole) {
    if (admin.id === currentUserId) {
      toast.error('無法修改自己的角色')
      return
    }

    if (admin.role === role) return

    setUserToChange(admin)
    setNewRole(role)
    setChangeRoleDialogOpen(true)
  }

  // 確認變更角色
  async function handleConfirmRoleChange() {
    if (!userToChange || !newRole) return

    setActioningId(userToChange.id)
    startTransition(async () => {
      try {
        const result = await updateUserRole({
          userId: userToChange.id,
          role: newRole,
        })

        if (result.success) {
          const roleLabel = roleConfig[newRole].label
          toast.success(`用戶角色已更新為「${roleLabel}」`)
          setChangeRoleDialogOpen(false)
          setUserToChange(null)
          setNewRole(null)
          router.refresh()
        } else {
          toast.error(result.error ?? '更新角色失敗')
        }
      } catch {
        toast.error('更新角色時發生錯誤')
      } finally {
        setActioningId(null)
      }
    })
  }

  if (admins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-surface border border-divider flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-caption" />
        </div>
        <h3 className="text-lg font-medium text-heading mb-2">
          尚未有管理員
        </h3>
        <p className="text-sm text-body mb-4">
          目前沒有管理員或講師帳號
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-divider overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-divider hover:bg-transparent bg-surface">
              <TableHead className="text-body w-12">頭像</TableHead>
              <TableHead className="text-body">姓名</TableHead>
              <TableHead className="text-body">Email</TableHead>
              <TableHead className="text-body w-40">角色</TableHead>
              <TableHead className="text-body w-32">建立日期</TableHead>
              <TableHead className="text-body w-24 text-center">
                操作記錄
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => {
              const role = roleConfig[admin.role]
              const isActioning = actioningId === admin.id
              const isCurrentUser = admin.id === currentUserId

              return (
                <TableRow
                  key={admin.id}
                  className="border-divider hover:bg-surface"
                >
                  {/* 頭像 */}
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={admin.image ?? undefined} alt={admin.name ?? '用戶'} />
                      <AvatarFallback className="bg-surface text-body border border-divider">
                        {getInitials(admin.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>

                  {/* 姓名 */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-heading">
                        {admin.name || '未設定姓名'}
                      </p>
                      {isCurrentUser && (
                        <Badge
                          variant="outline"
                          className="border-divider text-body"
                        >
                          你自己
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Email */}
                  <TableCell>
                    <p className="text-body text-sm">{admin.email}</p>
                  </TableCell>

                  {/* 角色選擇 */}
                  <TableCell>
                    {isCurrentUser ? (
                      <Badge className={role.className}>{role.label}</Badge>
                    ) : (
                      <Select
                        value={admin.role === 'EDITOR' ? 'INSTRUCTOR' : admin.role}
                        onValueChange={(value) =>
                          handleRoleChange(admin, value as EditableRole)
                        }
                        disabled={isActioning}
                      >
                        <SelectTrigger className="w-32 h-8 bg-white border-divider text-heading rounded-lg">
                          {isActioning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent className="bg-white border-divider">
                          <SelectItem
                            value="ADMIN"
                            className="text-heading focus:bg-surface focus:text-heading"
                          >
                            管理員
                          </SelectItem>
                          <SelectItem
                            value="INSTRUCTOR"
                            className="text-cta focus:bg-surface focus:text-cta-hover"
                          >
                            講師
                          </SelectItem>
                          <SelectItem
                            value="USER"
                            className="text-body focus:bg-surface focus:text-body"
                          >
                            學員
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>

                  {/* 建立日期 */}
                  <TableCell>
                    <p className="text-body text-sm">
                      {format(new Date(admin.createdAt), 'yyyy/MM/dd', {
                        locale: zhTW,
                      })}
                    </p>
                  </TableCell>

                  {/* 操作記錄 */}
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className="border-divider text-body"
                    >
                      {admin._count.adminLogs} 筆
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 變更角色確認對話框 */}
      <Dialog open={changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認變更角色</DialogTitle>
            <DialogDescription className="text-body">
              {newRole === 'USER' ? (
                <>
                  您確定要將「{userToChange?.name || userToChange?.email}」的角色從
                  「{userToChange && roleConfig[userToChange.role].label}」降級為「學員」嗎？
                  <br />
                  <span className="text-cta-hover font-medium">
                    此操作將移除該用戶的管理權限。
                  </span>
                </>
              ) : (
                <>
                  您確定要將「{userToChange?.name || userToChange?.email}」的角色變更為
                  「{newRole && roleConfig[newRole].label}」嗎？
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangeRoleDialogOpen(false)}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
            <Button
              variant={newRole === 'USER' ? 'destructive' : 'default'}
              onClick={handleConfirmRoleChange}
              disabled={isPending}
              className={
                newRole === 'USER'
                  ? 'bg-red-500 hover:bg-red-600 rounded-lg'
                  : 'bg-cta hover:bg-cta-hover rounded-lg'
              }
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  變更中...
                </>
              ) : (
                '確認變更'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
