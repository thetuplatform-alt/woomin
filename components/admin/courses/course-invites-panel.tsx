'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  createCourseInvite,
  deactivateCourseInvite,
  type CourseInviteListItem,
} from '@/lib/actions/course-invites'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Copy, Link2, Loader2, ShieldOff } from 'lucide-react'

interface CourseInvitesPanelProps {
  courseId: string
  courseTitle: string
  courseSlug: string
  invites: CourseInviteListItem[]
}

interface GeneratedInvite {
  token: string
  inviteUrl: string
}

function formatDate(date: Date | null) {
  if (!date) return '無期限'
  return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: zhTW })
}

function getInviteStatus(invite: CourseInviteListItem) {
  if (!invite.active) return { label: '已停用', variant: 'secondary' as const }
  if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) {
    return { label: '已過期', variant: 'outline' as const }
  }
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    return { label: '已用完', variant: 'outline' as const }
  }
  return { label: '可使用', variant: 'default' as const }
}

export function CourseInvitesPanel({
  courseId,
  courseTitle,
  courseSlug,
  invites,
}: CourseInvitesPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(
    null
  )

  async function copyText(value: string, message: string) {
    await navigator.clipboard.writeText(value)
    toast.success(message)
  }

  function handleCreateInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      const result = await createCourseInvite(courseId, {
        email: email.trim() || null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        active: true,
      })

      if (!result.success || !result.token || !result.inviteUrl) {
        toast.error(result.error ?? '建立邀請連結失敗')
        return
      }

      setGeneratedInvite({
        token: result.token,
        inviteUrl: result.inviteUrl,
      })
      setEmail('')
      setMaxUses('')
      setExpiresAt('')
      toast.success('邀請連結已建立')
      router.refresh()
    })
  }

  function handleDeactivate(inviteId: string) {
    startTransition(async () => {
      const result = await deactivateCourseInvite(inviteId)

      if (!result.success) {
        toast.error(result.error ?? '停用邀請失敗')
        return
      }

      toast.success('邀請已停用')
      router.refresh()
    })
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-heading">邀請連結</h2>
          <p className="mt-1 text-body">
            管理「{courseTitle}」的私密購買入口。邀請網址格式為
            <span className="mx-1 font-mono text-sm text-heading">
              /courses/{courseSlug}?invite=token
            </span>
          </p>
        </div>

        <Card className="rounded-xl border-divider bg-white">
          <CardHeader>
            <CardTitle className="text-heading">建立邀請</CardTitle>
            <CardDescription className="text-body">
              明文 token 只會在建立後顯示一次；系統只保存 token hash。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateInvite}
              className="grid gap-4 md:grid-cols-[1.2fr_0.7fr_0.9fr_auto]"
            >
              <div className="space-y-2">
                <Label htmlFor="invite-email">限制 Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="留空代表任何登入者可使用"
                  className="rounded-lg border-divider bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-max-uses">使用上限</Label>
                <Input
                  id="invite-max-uses"
                  type="number"
                  min={1}
                  step={1}
                  value={maxUses}
                  onChange={(event) => setMaxUses(event.target.value)}
                  placeholder="不限"
                  className="rounded-lg border-divider bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-expires-at">到期時間</Label>
                <Input
                  id="invite-expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className="rounded-lg border-divider bg-white"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={isPending}
                  data-tour="invite-create-button"
                  className="w-full rounded-lg bg-cta text-white hover:bg-cta-hover"
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  建立
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {generatedInvite && (
          <Card className="rounded-xl border-cta/30 bg-surface">
            <CardHeader>
              <CardTitle className="text-heading">新邀請已建立</CardTitle>
              <CardDescription className="text-body">
                請現在複製保存。離開此頁後無法再次查看明文 token。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-divider bg-white p-3">
                <p className="mb-1 text-xs font-medium text-caption">邀請網址</p>
                <p className="break-all font-mono text-sm text-heading">
                  {generatedInvite.inviteUrl}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg border-divider"
                  onClick={() =>
                    copyText(generatedInvite.inviteUrl, '邀請網址已複製')
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  複製邀請網址
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg border-divider"
                  onClick={() =>
                    copyText(generatedInvite.token, '邀請 token 已複製')
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  複製 token
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card
          data-tour="invite-records-table"
          className="rounded-xl border-divider bg-white"
        >
          <CardHeader>
            <CardTitle className="text-heading">邀請紀錄</CardTitle>
            <CardDescription className="text-body">
              可停用既有邀請；基於安全性，舊 token 不會再次顯示。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-divider py-12 text-center">
                <p className="text-body">尚未建立邀請連結</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-divider">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface hover:bg-surface">
                      <TableHead>狀態</TableHead>
                      <TableHead>Email 限制</TableHead>
                      <TableHead>使用次數</TableHead>
                      <TableHead>到期時間</TableHead>
                      <TableHead>建立時間</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => {
                      const status = getInviteStatus(invite)

                      return (
                        <TableRow key={invite.id}>
                          <TableCell>
                            <Badge
                              variant={status.variant}
                              className={
                                status.variant === 'default'
                                  ? 'rounded-full bg-emerald-500 text-white hover:bg-emerald-500'
                                  : 'rounded-full'
                              }
                            >
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-body">
                            {invite.email ?? '不限'}
                          </TableCell>
                          <TableCell className="text-body">
                            {invite.usedCount}
                            {invite.maxUses === null
                              ? ' / 不限'
                              : ` / ${invite.maxUses}`}
                          </TableCell>
                          <TableCell className="text-body">
                            {formatDate(invite.expiresAt)}
                          </TableCell>
                          <TableCell className="text-body">
                            {formatDate(invite.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!invite.active || isPending}
                              onClick={() => handleDeactivate(invite.id)}
                              className="rounded-lg border-divider text-body"
                            >
                              <ShieldOff className="mr-2 h-4 w-4" />
                              停用
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
      </div>
    </div>
  )
}
