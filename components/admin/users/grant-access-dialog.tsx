// components/admin/users/grant-access-dialog.tsx
// 授權課程對話框
// 提供手動授權課程給用戶的功能（含授權類型、備註、通知選項）

'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { grantCourseAccess, getAvailableCourses } from '@/lib/actions/users'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, Loader2 } from 'lucide-react'

interface GrantAccessDialogProps {
  userId: string
  userName: string | null
  existingCourseIds: string[]
}

type ExpiresMode = 'course_default' | 'custom_date' | 'lifetime'

export function GrantAccessDialog({
  userId,
  userName,
  existingCourseIds,
}: GrantAccessDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [expiresMode, setExpiresMode] = useState<ExpiresMode>('course_default')
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [grantNote, setGrantNote] = useState<string>('')
  const [notifyUser, setNotifyUser] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState(false)

  const today = useMemo(
    () => new Date().toISOString().split('T')[0],
    []
  )

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      getAvailableCourses()
        .then((data) => {
          const availableCourses = data.filter(
            (course) => !existingCourseIds.includes(course.id)
          )
          setCourses(availableCourses)
        })
        .catch(() => toast.error('載入課程列表失敗'))
        .finally(() => setIsLoading(false))
    }
  }, [isOpen, existingCourseIds])

  function applyQuickExpiry(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setExpiresMode('custom_date')
    setExpiresAt(d.toISOString().split('T')[0])
  }

  async function handleGrant() {
    if (!selectedCourseId) {
      toast.error('請選擇課程')
      return
    }
    if (expiresMode === 'custom_date' && !expiresAt) {
      toast.error('請選擇到期日')
      return
    }

    startTransition(async () => {
      try {
        const payload = {
          userId,
          courseId: selectedCourseId,
          expiresMode:
            expiresMode === 'custom_date' || expiresMode === 'lifetime'
              ? ('custom' as const)
              : ('course_default' as const),
          expiresAt:
            expiresMode === 'custom_date'
              ? new Date(`${expiresAt}T23:59:59`)
              : null,
          grantNote: grantNote.trim() || null,
          notifyUser,
        }

        const result = await grantCourseAccess(payload)
        if (result.success) {
          toast.success('課程授權成功')
          setIsOpen(false)
          resetForm()
          router.refresh()
        } else {
          toast.error(result.error ?? '授權失敗')
        }
      } catch {
        toast.error('授權課程時發生錯誤')
      }
    })
  }

  function resetForm() {
    setSelectedCourseId('')
    setExpiresMode('course_default')
    setExpiresAt('')
    setGrantNote('')
    setNotifyUser(true)
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) resetForm()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-cta hover:bg-cta-hover text-white rounded-lg">
          <Plus className="mr-2 h-4 w-4" />
          手動授權課程
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white border-divider rounded-xl sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-heading">授權課程</DialogTitle>
          <DialogDescription className="text-body">
            為 {userName || '此用戶'} 手動授權課程存取權限
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 課程選擇 */}
          <div className="grid gap-2">
            <Label htmlFor="course" className="text-heading">選擇課程</Label>
            {isLoading ? (
              <div className="flex items-center justify-center h-9 bg-surface border border-divider rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-caption" />
              </div>
            ) : courses.length === 0 ? (
              <div className="text-sm text-body p-3 bg-surface border border-divider rounded-lg text-center">
                沒有可授權的課程
              </div>
            ) : (
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                  <SelectValue placeholder="選擇要授權的課程" />
                </SelectTrigger>
                <SelectContent className="bg-white border-divider">
                  {courses.map((course) => (
                    <SelectItem
                      key={course.id}
                      value={course.id}
                      className="text-body focus:bg-surface focus:text-heading"
                    >
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 有效期限模式 */}
          <div className="grid gap-2">
            <Label className="text-heading">有效期限</Label>
            <Select
              value={expiresMode}
              onValueChange={(v) => setExpiresMode(v as ExpiresMode)}
            >
              <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-divider">
                <SelectItem value="course_default" className="text-body focus:bg-surface">
                  依課程預設設定（推薦）
                </SelectItem>
                <SelectItem value="lifetime" className="text-body focus:bg-surface">
                  永久有效
                </SelectItem>
                <SelectItem value="custom_date" className="text-body focus:bg-surface">
                  自訂到期日
                </SelectItem>
              </SelectContent>
            </Select>

            {expiresMode === 'custom_date' && (
              <>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="bg-white border-divider text-heading rounded-lg"
                  min={today}
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '+30 天', days: 30 },
                    { label: '+90 天', days: 90 },
                    { label: '+1 年', days: 365 },
                  ].map((opt) => (
                    <Button
                      key={opt.days}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-divider text-body hover:bg-surface"
                      onClick={() => applyQuickExpiry(opt.days)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 備註 */}
          <div className="grid gap-2">
            <Label htmlFor="grantNote" className="text-heading">
              授權備註（選填）
            </Label>
            <Textarea
              id="grantNote"
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              placeholder="例：客服補償、活動贈送、案件單號..."
              rows={2}
              maxLength={500}
              className="bg-white border-divider text-heading rounded-lg"
            />
          </div>

          {/* 通知學員 */}
          <div className="flex flex-row items-center justify-between rounded-lg border border-divider p-3">
            <div className="space-y-0.5">
              <Label className="text-heading">通知學員</Label>
              <p className="text-xs text-caption">以 Email 通知學員課程已開通</p>
            </div>
            <Switch checked={notifyUser} onCheckedChange={setNotifyUser} />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
          >
            取消
          </Button>
          <Button
            onClick={handleGrant}
            disabled={isPending || !selectedCourseId || courses.length === 0}
            className="bg-cta hover:bg-cta-hover text-white rounded-lg"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                授權中...
              </>
            ) : (
              '確認授權'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
