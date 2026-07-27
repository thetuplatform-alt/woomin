// components/admin/users/promote-role-dialog.tsx
// 提升用戶角色對話框
// 允許管理員在用戶詳情頁將用戶提升為管理員或講師

'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { updateUserRole } from '@/lib/actions/users'
import type { UserRole } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Shield, Loader2 } from 'lucide-react'

interface PromoteRoleDialogProps {
  userId: string
  userName: string | null
  currentRole: UserRole
}

type EditableRole = Extract<UserRole, 'USER' | 'INSTRUCTOR' | 'ADMIN'>

const roleLabels: Record<UserRole, string> = {
  USER: '學員',
  INSTRUCTOR: '講師',
  EDITOR: '講師',
  ADMIN: '管理員',
}

export function PromoteRoleDialog({
  userId,
  userName,
  currentRole,
}: PromoteRoleDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<EditableRole>(
    currentRole === 'ADMIN' ? 'ADMIN' : currentRole === 'USER' ? 'INSTRUCTOR' : 'INSTRUCTOR'
  )

  const handleConfirm = () => {
    if (selectedRole === currentRole) {
      toast.error('角色未變更')
      return
    }

    startTransition(async () => {
      try {
        const result = await updateUserRole({
          userId,
          role: selectedRole,
        })

        if (result.success) {
          toast.success(`已將用戶角色變更為「${roleLabels[selectedRole]}」`)
          setOpen(false)
          router.refresh()
        } else {
          toast.error(result.error ?? '變更角色失敗')
        }
      } catch {
        toast.error('變更角色時發生錯誤')
      }
    })
  }

  const displayName = userName || '此用戶'
  const isDemoting =
    (currentRole === 'ADMIN' && selectedRole !== 'ADMIN') ||
    ((currentRole === 'INSTRUCTOR' || currentRole === 'EDITOR') && selectedRole === 'USER')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
        >
          <Shield className="mr-2 h-4 w-4" />
          變更角色
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white border-divider rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-heading">
            變更用戶角色
          </DialogTitle>
          <DialogDescription className="text-body">
            將「{displayName}」的角色從「{roleLabels[currentRole]}」變更為其他角色。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="text-sm font-medium text-heading mb-2 block">
            選擇新角色
          </label>
          <Select
            value={selectedRole}
            onValueChange={(v) => setSelectedRole(v as EditableRole)}
          >
            <SelectTrigger className="w-full bg-white border-divider text-heading rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-divider">
              <SelectItem value="ADMIN">管理員 — 完整管理權限</SelectItem>
              <SelectItem value="INSTRUCTOR">講師 — 課程管理權限</SelectItem>
              <SelectItem value="USER">學員 — 一般用戶</SelectItem>
            </SelectContent>
          </Select>

          {isDemoting && (
            <p className="text-sm text-amber-700 mt-3">
              此操作將降低該用戶的權限等級。
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || selectedRole === currentRole}
            className={
              isDemoting
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
  )
}
