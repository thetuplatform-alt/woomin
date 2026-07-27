// components/admin/users/user-purchases.tsx
// 用戶購買記錄列表
// 顯示用戶已購買的課程，含有效期狀態、延長與撤銷功能

'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { revokeCourseAccess, extendCourseAccess } from '@/lib/actions/users'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BookOpen, Loader2, ShieldX, Clock, CalendarPlus } from 'lucide-react'
import type { Purchase, Course, PurchaseSource } from '@prisma/client'

type PurchaseWithCourse = Purchase & { course: Course }

interface UserPurchasesProps {
  userId: string
  purchases: PurchaseWithCourse[]
}

function sourceLabel(source: PurchaseSource, orderId: string | null): string {
  if (source === 'PAID') return '付費購買'
  if (source === 'FREE_ENROLL') return '免費加入'
  if (source === 'ADMIN_GRANT') return '手動授權'
  if (source === 'ADMIN_IMPORT') return '批次匯入'
  return orderId ? '付費購買' : '手動授權'
}

function getExpiryStatus(purchase: PurchaseWithCourse): {
  label: string
  color: string
} {
  if (purchase.revokedAt) {
    return { label: '已撤銷', color: 'bg-gray-200 text-gray-700 border-gray-300' }
  }
  if (!purchase.expiresAt) {
    return { label: '永久', color: 'bg-surface text-body border-divider' }
  }
  const now = Date.now()
  const expires = new Date(purchase.expiresAt).getTime()
  if (expires <= now) {
    return { label: '已過期', color: 'bg-red-100 text-red-700 border-red-200' }
  }
  const daysLeft = Math.ceil((expires - now) / (24 * 60 * 60 * 1000))
  if (daysLeft <= 7) {
    return {
      label: `剩 ${daysLeft} 天`,
      color: 'bg-red-50 text-red-700 border-red-200',
    }
  }
  if (daysLeft <= 30) {
    return {
      label: `剩 ${daysLeft} 天`,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  }
  return { label: `剩 ${daysLeft} 天`, color: 'bg-surface text-body border-divider' }
}

export function UserPurchases({ userId, purchases }: UserPurchasesProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [extendDialogOpen, setExtendDialogOpen] = useState(false)
  const [activePurchase, setActivePurchase] = useState<PurchaseWithCourse | null>(null)

  // Extend dialog state
  const [extendMode, setExtendMode] = useState<'add_days' | 'set_date' | 'lifetime'>(
    'add_days'
  )
  const [extendDays, setExtendDays] = useState<string>('30')
  const [extendDate, setExtendDate] = useState<string>('')
  const [extendNote, setExtendNote] = useState<string>('')
  const [extendNotify, setExtendNotify] = useState<boolean>(true)

  function openRevokeDialog(purchase: PurchaseWithCourse) {
    setActivePurchase(purchase)
    setRevokeDialogOpen(true)
  }

  function openExtendDialog(purchase: PurchaseWithCourse) {
    setActivePurchase(purchase)
    setExtendMode('add_days')
    setExtendDays('30')
    setExtendDate(
      purchase.expiresAt
        ? new Date(purchase.expiresAt).toISOString().split('T')[0]
        : ''
    )
    setExtendNote('')
    setExtendNotify(true)
    setExtendDialogOpen(true)
  }

  async function handleConfirmRevoke() {
    if (!activePurchase) return
    startTransition(async () => {
      try {
        const result = await revokeCourseAccess({
          userId,
          courseId: activePurchase.courseId,
        })
        if (result.success) {
          toast.success('課程存取權限已撤銷')
          setRevokeDialogOpen(false)
          setActivePurchase(null)
          router.refresh()
        } else {
          toast.error(result.error ?? '撤銷權限失敗')
        }
      } catch {
        toast.error('撤銷權限時發生錯誤')
      }
    })
  }

  async function handleConfirmExtend() {
    if (!activePurchase) return

    let payload: Parameters<typeof extendCourseAccess>[0]
    if (extendMode === 'add_days') {
      const days = parseInt(extendDays)
      if (!days || days < 1) {
        toast.error('請輸入有效天數')
        return
      }
      payload = {
        userId,
        courseId: activePurchase.courseId,
        mode: 'add_days',
        days,
        grantNote: extendNote.trim() || null,
        notifyUser: extendNotify,
      }
    } else if (extendMode === 'lifetime') {
      payload = {
        userId,
        courseId: activePurchase.courseId,
        mode: 'set_date',
        expiresAt: null,
        grantNote: extendNote.trim() || null,
        notifyUser: extendNotify,
      }
    } else {
      if (!extendDate) {
        toast.error('請選擇到期日')
        return
      }
      payload = {
        userId,
        courseId: activePurchase.courseId,
        mode: 'set_date',
        expiresAt: new Date(`${extendDate}T23:59:59`),
        grantNote: extendNote.trim() || null,
        notifyUser: extendNotify,
      }
    }

    startTransition(async () => {
      try {
        const result = await extendCourseAccess(payload)
        if (result.success) {
          toast.success('有效期已更新')
          setExtendDialogOpen(false)
          setActivePurchase(null)
          router.refresh()
        } else {
          toast.error(result.error ?? '更新失敗')
        }
      } catch {
        toast.error('更新有效期時發生錯誤')
      }
    })
  }

  return (
    <>
      <Card className="bg-white border-divider rounded-xl">
        <CardHeader>
          <CardTitle className="text-heading flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            已購課程
            <Badge
              variant="secondary"
              className="bg-surface text-body border border-divider ml-2"
            >
              {purchases.length} 門
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center mb-3">
                <BookOpen className="h-6 w-6 text-caption" />
              </div>
              <p className="text-body text-sm">此用戶尚未購買任何課程</p>
            </div>
          ) : (
            <div className="rounded-xl border border-divider overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-divider hover:bg-transparent bg-surface">
                    <TableHead className="text-body">課程名稱</TableHead>
                    <TableHead className="text-body w-28">取得方式</TableHead>
                    <TableHead className="text-body w-28">取得日期</TableHead>
                    <TableHead className="text-body w-44">有效期限</TableHead>
                    <TableHead className="text-body w-32 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => {
                    const status = getExpiryStatus(purchase)
                    const isRevoked = !!purchase.revokedAt
                    return (
                      <TableRow
                        key={purchase.id}
                        className="border-divider hover:bg-surface"
                      >
                        <TableCell>
                          <p className="font-medium text-heading">
                            {purchase.course.title}
                          </p>
                          {purchase.grantNote && (
                            <p className="mt-1 text-xs text-caption line-clamp-1">
                              備註：{purchase.grantNote}
                            </p>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-surface text-body border border-divider"
                          >
                            {sourceLabel(purchase.source, purchase.orderId)}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <p className="text-body text-sm">
                            {format(new Date(purchase.createdAt), 'yyyy/MM/dd', {
                              locale: zhTW,
                            })}
                          </p>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="outline"
                              className={`w-fit ${status.color}`}
                            >
                              {status.label}
                            </Badge>
                            {purchase.expiresAt && !isRevoked && (
                              <span className="text-xs text-caption">
                                {format(
                                  new Date(purchase.expiresAt),
                                  'yyyy/MM/dd HH:mm',
                                  { locale: zhTW }
                                )}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!isRevoked && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openExtendDialog(purchase)}
                                className="h-8 w-8 p-0 text-body hover:text-cta hover:bg-surface"
                                title="延長有效期"
                              >
                                <CalendarPlus className="h-4 w-4" />
                                <span className="sr-only">延長有效期</span>
                              </Button>
                            )}
                            {!isRevoked && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openRevokeDialog(purchase)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                title="撤銷權限"
                              >
                                <ShieldX className="h-4 w-4" />
                                <span className="sr-only">撤銷權限</span>
                              </Button>
                            )}
                          </div>
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

      {/* 撤銷確認對話框 */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認撤銷權限</DialogTitle>
            <DialogDescription className="text-body">
              您確定要撤銷此用戶對「{activePurchase?.course.title}」的存取權限嗎？
              撤銷後用戶將無法繼續觀看此課程。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={isPending}
              className="bg-red-500 hover:bg-red-600 rounded-lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  撤銷中...
                </>
              ) : (
                '確認撤銷'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 延長有效期對話框 */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="bg-white border-divider rounded-xl sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-heading flex items-center gap-2">
              <Clock className="h-4 w-4" />
              調整有效期
            </DialogTitle>
            <DialogDescription className="text-body">
              課程：{activePurchase?.course.title}
              <br />
              目前：
              {activePurchase?.expiresAt
                ? format(new Date(activePurchase.expiresAt), 'yyyy/MM/dd HH:mm', {
                    locale: zhTW,
                  })
                : '永久有效'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-heading">調整方式</Label>
              <Select
                value={extendMode}
                onValueChange={(v) => setExtendMode(v as typeof extendMode)}
              >
                <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-divider">
                  <SelectItem value="add_days" className="text-body focus:bg-surface">
                    延長 N 天（從現有到期日加上）
                  </SelectItem>
                  <SelectItem value="set_date" className="text-body focus:bg-surface">
                    設定到期日
                  </SelectItem>
                  <SelectItem value="lifetime" className="text-body focus:bg-surface">
                    改為永久有效
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {extendMode === 'add_days' && (
              <div className="grid gap-2">
                <Label className="text-heading">延長天數</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="3650"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    className="w-32 bg-white border-divider text-heading rounded-lg"
                  />
                  <span className="text-sm text-body">天</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['30', '90', '365'].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExtendDays(d)}
                      className="border-divider text-body hover:bg-surface"
                    >
                      {d === '365' ? '1 年' : `${d} 天`}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {extendMode === 'set_date' && (
              <div className="grid gap-2">
                <Label className="text-heading">新到期日</Label>
                <Input
                  type="date"
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-white border-divider text-heading rounded-lg"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-heading">備註（選填）</Label>
              <Textarea
                value={extendNote}
                onChange={(e) => setExtendNote(e.target.value)}
                placeholder="例：客服補償、案件編號..."
                rows={2}
                maxLength={500}
                className="bg-white border-divider text-heading rounded-lg"
              />
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border border-divider p-3">
              <div className="space-y-0.5">
                <Label className="text-heading">通知學員</Label>
                <p className="text-xs text-caption">以 Email 通知學員有效期已更新</p>
              </div>
              <Switch checked={extendNotify} onCheckedChange={setExtendNotify} />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtendDialogOpen(false)}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmExtend}
              disabled={isPending}
              className="bg-cta hover:bg-cta-hover text-white rounded-lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : (
                '確認更新'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
