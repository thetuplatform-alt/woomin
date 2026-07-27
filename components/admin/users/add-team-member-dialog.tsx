// components/admin/users/add-team-member-dialog.tsx
// 講師管理 — 新增講師 / 管理員對話框
// 右上「新增」提供「新增講師」「新增管理員」兩選項，皆開啟同一個「email 即時搜尋」對話框：
// - 輸入 email/姓名關鍵字時即時列出既有用戶，點選即可把該用戶設為講師/管理員
// - 查無相符且 email 有效時，可直接新增該用戶
// - 透過按鈕文字引導：已存在 →「將已有用戶設為…」、不存在 →「新增該用戶」

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { UserRole } from '@prisma/client'
import {
  assignTeamRole,
  searchUsersForRole,
  type UserSearchResult,
} from '@/lib/actions/users'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Loader2,
  Search,
  Check,
  GraduationCap,
  Shield,
  UserPlus,
} from 'lucide-react'

type TeamRole = 'INSTRUCTOR' | 'ADMIN'

const roleLabels: Record<TeamRole, string> = {
  INSTRUCTOR: '講師',
  ADMIN: '管理員',
}

const currentRoleLabels: Record<UserRole, string> = {
  USER: '學員',
  INSTRUCTOR: '講師',
  EDITOR: '講師',
  ADMIN: '管理員',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AddTeamMemberDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<TeamRole>('INSTRUCTOR')
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [sendInvite, setSendInvite] = useState(true)
  const [isPending, startTransition] = useTransition()

  // 開啟對話框並預設角色
  function openWith(nextRole: TeamRole) {
    resetForm()
    setRole(nextRole)
    setOpen(true)
  }

  function resetForm() {
    setQuery('')
    setName('')
    setResults([])
    setSelectedUser(null)
    setSendInvite(true)
    setIsSearching(false)
  }

  // 即時搜尋（debounce）。已選取既有用戶時不再搜尋
  useEffect(() => {
    if (!open) return
    if (selectedUser) {
      setResults([])
      return
    }
    const q = query.trim()
    if (q.length < 1) {
      setResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const timer = setTimeout(() => {
      searchUsersForRole(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, open, selectedUser])

  // 模式：已選既有用戶 → 既有帳號預設不寄信；輸入新 email → 新帳號預設寄信
  function handleSelectUser(user: UserSearchResult) {
    setSelectedUser(user)
    setQuery(user.email)
    setSendInvite(false)
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    if (selectedUser) {
      // 編輯了 email → 取消既有選取，回到「新增」模式
      setSelectedUser(null)
      setSendInvite(true)
    }
  }

  const isValidNewEmail = EMAIL_RE.test(query.trim())
  const canSubmit = selectedUser ? true : isValidNewEmail

  const primaryLabel = selectedUser
    ? `將已有用戶設為${roleLabels[role]}`
    : '新增該用戶'

  function handleSubmit() {
    if (!canSubmit) {
      toast.error('請選取既有用戶，或輸入有效的 Email')
      return
    }
    startTransition(async () => {
      const result = await assignTeamRole({
        userId: selectedUser?.id,
        email: selectedUser ? undefined : query.trim(),
        name: selectedUser ? undefined : name.trim() || undefined,
        role,
        sendInvite,
      })
      if (result.success) {
        toast.success(
          result.created
            ? `已新增${roleLabels[role]}`
            : `已將用戶設為${roleLabels[role]}`
        )
        resetForm()
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? '操作失敗')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-tour="instructors-add-btn"
            className="bg-cta hover:bg-cta-hover text-white rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新增
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-white border-divider">
          <DropdownMenuItem
            onClick={() => openWith('INSTRUCTOR')}
            className="cursor-pointer text-body focus:bg-surface focus:text-heading"
          >
            <GraduationCap className="mr-2 h-4 w-4" />
            新增講師
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openWith('ADMIN')}
            className="cursor-pointer text-body focus:bg-surface focus:text-heading"
          >
            <Shield className="mr-2 h-4 w-4" />
            新增管理員
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetForm()
        }}
      >
        <DialogContent className="bg-white border-divider rounded-xl sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-heading">
              新增{roleLabels[role]}
            </DialogTitle>
            <DialogDescription className="text-body">
              輸入 Email 搜尋既有用戶並設定身分；若系統中尚無此人，也可直接新增。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 角色切換 */}
            <div className="space-y-2">
              <Label className="text-heading">身分</Label>
              <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                <SelectTrigger className="bg-white border-divider rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-divider">
                  <SelectItem value="INSTRUCTOR">講師 — 課程管理權限</SelectItem>
                  <SelectItem value="ADMIN">管理員 — 完整管理權限</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email 搜尋 / 輸入 */}
            <div className="space-y-2">
              <Label htmlFor="team-email" className="text-heading">
                電子郵件
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-caption" />
                <Input
                  id="team-email"
                  type="email"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="輸入 Email 或姓名關鍵字搜尋"
                  className="pl-10 bg-white border-divider rounded-lg"
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-caption" />
                )}
              </div>

              {/* 已選取既有用戶 */}
              {selectedUser && (
                <div className="flex items-center justify-between rounded-lg border border-cta/40 bg-cta/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading truncate">
                      {selectedUser.name || '未設定姓名'}
                    </p>
                    <p className="text-xs text-body truncate">{selectedUser.email}</p>
                  </div>
                  <Badge className="bg-surface hover:bg-surface text-body border border-divider shrink-0">
                    目前：{currentRoleLabels[selectedUser.role]}
                  </Badge>
                </div>
              )}

              {/* 搜尋結果清單 */}
              {!selectedUser && results.length > 0 && (
                <div className="rounded-lg border border-divider divide-y divide-divider max-h-52 overflow-y-auto">
                  {results.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-heading truncate">
                          {user.name || '未設定姓名'}
                        </p>
                        <p className="text-xs text-body truncate">{user.email}</p>
                      </div>
                      <Badge className="bg-surface hover:bg-surface text-body border border-divider shrink-0">
                        {currentRoleLabels[user.role]}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {/* 查無相符 → 提示可直接新增 */}
              {!selectedUser &&
                !isSearching &&
                query.trim().length >= 1 &&
                results.length === 0 && (
                  <p className="text-xs text-body flex items-center gap-1.5">
                    {isValidNewEmail ? (
                      <>
                        <UserPlus className="h-3.5 w-3.5 text-cta" />
                        系統中查無此用戶，可直接新增為{roleLabels[role]}。
                      </>
                    ) : (
                      <>查無相符用戶；若要新增請輸入完整且有效的 Email。</>
                    )}
                  </p>
                )}
            </div>

            {/* 新增用戶時可填姓名 */}
            {!selectedUser && isValidNewEmail && (
              <div className="space-y-2">
                <Label htmlFor="team-name" className="text-heading">
                  姓名（選填）
                </Label>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入姓名"
                  className="bg-white border-divider rounded-lg"
                />
              </div>
            )}

            {/* 寄送邀請信 */}
            <div className="flex flex-row items-center justify-between rounded-lg border border-divider p-3">
              <div className="space-y-0.5 pr-3">
                <Label className="text-heading">寄送設定密碼邀請信</Label>
                <p className="text-xs text-caption">
                  讓對方知道被賦予{roleLabels[role]}身分，並提供 30 天有效的設定密碼連結
                </p>
              </div>
              <Switch checked={sendInvite} onCheckedChange={setSendInvite} />
            </div>
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
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
              className="bg-cta hover:bg-cta-hover text-white rounded-lg"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : selectedUser ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {primaryLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
