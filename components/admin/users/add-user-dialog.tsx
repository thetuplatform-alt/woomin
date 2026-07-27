'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { UserRole } from '@prisma/client'
import { createAdminUser, getManageableCourseOptions } from '@/lib/actions/users'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CourseMultiSelect } from '@/components/admin/users/course-multi-select'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'

type VisibleRole = Extract<UserRole, 'USER' | 'INSTRUCTOR' | 'ADMIN'>

const roleLabels: Record<VisibleRole, string> = {
  USER: '學員',
  INSTRUCTOR: '講師',
  ADMIN: '管理員',
}

interface AddUserDialogProps {
  defaultRole: VisibleRole
}

export function AddUserDialog({ defaultRole }: AddUserDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<VisibleRole>(defaultRole)
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [courseIds, setCourseIds] = useState<string[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)
  const [sendInvite, setSendInvite] = useState(false)
  const [isPending, startTransition] = useTransition()

  const warning = useMemo(() => {
    if (role === 'ADMIN') {
      return '此權限將擁有管理員權限，可管理平台設定、金流、用戶與所有課程。請確認你信任此使用者。'
    }
    if (role === 'INSTRUCTOR') {
      return '你即將新增一位講師。講師可以建立課程，並管理被授權的課程內容、留言與優惠券。'
    }
    return null
  }, [role])

  useEffect(() => {
    if (!open) setRole(defaultRole)
  }, [defaultRole, open])

  // 開啟對話框時載入可指派課程
  useEffect(() => {
    if (open && courses.length === 0) {
      setIsLoadingCourses(true)
      getManageableCourseOptions()
        .then(setCourses)
        .catch(() => toast.error('載入課程列表失敗'))
        .finally(() => setIsLoadingCourses(false))
    }
  }, [open, courses.length])

  function resetForm() {
    setName('')
    setEmail('')
    setRole(defaultRole)
    setCourseIds([])
    setSendInvite(false)
    setConfirmOpen(false)
  }

  async function submit() {
    startTransition(async () => {
      const result = await createAdminUser({
        name,
        email,
        role,
        courseIds,
        sendInvite,
      })
      if (result.success) {
        toast.success(`已新增${roleLabels[role]}`)
        resetForm()
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? '新增用戶失敗')
      }
    })
  }

  function handlePrimarySubmit() {
    if (role === 'USER') {
      void submit()
      return
    }
    setConfirmOpen(true)
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) resetForm()
        }}
      >
        <DialogTrigger asChild>
          <Button
            data-tour="users-add-btn"
            className="bg-cta hover:bg-cta-hover text-white rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新增
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">新增用戶</DialogTitle>
            <DialogDescription className="text-body">
              輸入名稱與電子郵件。講師與管理員會在送出前再次確認。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">名稱</Label>
              <Input
                id="new-user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="輸入名稱"
                className="bg-white border-divider rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-email">電子郵件</Label>
              <Input
                id="new-user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="bg-white border-divider rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={role} onValueChange={(value) => setRole(value as VisibleRole)}>
                <SelectTrigger className="bg-white border-divider rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-divider">
                  <SelectItem value="USER">學員</SelectItem>
                  <SelectItem value="INSTRUCTOR">講師</SelectItem>
                  <SelectItem value="ADMIN">管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 指派課程（可多選） */}
            <div className="space-y-2">
              <Label>指派課程（選填）</Label>
              <CourseMultiSelect
                courses={courses}
                value={courseIds}
                onChange={setCourseIds}
                loading={isLoadingCourses}
              />
            </div>

            {/* 寄送設定密碼邀請信 */}
            <div className="flex flex-row items-center justify-between rounded-lg border border-divider p-3">
              <div className="space-y-0.5 pr-3">
                <Label className="text-heading">寄送設定密碼邀請信</Label>
                <p className="text-xs text-caption">
                  通知對方已被加入，並提供 30 天有效的設定密碼連結
                </p>
              </div>
              <Switch checked={sendInvite} onCheckedChange={setSendInvite} />
            </div>

            {warning && (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{warning}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-divider rounded-lg"
            >
              取消
            </Button>
            <Button
              onClick={handlePrimarySubmit}
              disabled={isPending || !name.trim() || !email.trim()}
              className="bg-cta hover:bg-cta-hover text-white rounded-lg"
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認新增{roleLabels[role]}</DialogTitle>
            <DialogDescription className="text-body">{warning}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="border-divider rounded-lg"
            >
              返回修改
            </Button>
            <Button
              onClick={submit}
              disabled={isPending}
              className={role === 'ADMIN' ? 'bg-red-600 hover:bg-red-700 text-white rounded-lg' : 'bg-cta hover:bg-cta-hover text-white rounded-lg'}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              確認新增{roleLabels[role]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
