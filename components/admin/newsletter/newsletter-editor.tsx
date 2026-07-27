'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  Check,
  CircleHelp,
  Loader2,
  Save,
  Search,
  Send,
  TestTube2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { NewsletterContent, SegmentJson } from '@/lib/newsletter/types'
import {
  estimateNewsletterAudience,
  getNewsletterSenderSettings,
  getNewsletterSendChecklist,
  searchNewsletterUsers,
  sendTestNewsletter,
  startNewsletter,
  updateNewsletterSenderSettings,
  updateNewsletter,
} from '@/lib/actions/newsletters'

type Campaign = {
  id: string
  type: 'GENERAL' | 'PROMO'
  name: string
  subject: string
  preheader?: string | null
  contentJson: NewsletterContent
  segmentJson?: SegmentJson | null
  couponId?: string | null
  scheduledAt?: string | null
  updatedAt: string
  status: string
}

type Options = {
  courses: Array<{ id: string; title: string; slug: string; coverImage?: string | null; price: number; salePrice?: number | null; audienceCount?: number }>
  coupons: Array<{ id: string; code: string; name: string; description?: string | null; expiresAt?: string | null; amountOff?: number | null; percentOff?: number | null }>
  audienceGroups?: { totalEmailCount: number; noCourseCount: number }
}

type AudiencePreview = {
  matched: number
  excluded: {
    unsubscribed: number
    marketingMissing: number
    hardBounced: number
  }
  sendable: number
  samples: Array<{
    id: string
    name: string | null
    emailMasked: string
  }>
  recipients?: Array<{
    id: string
    name: string | null
    email: string
    source: 'user' | 'external'
  }>
}

type UserSuggestion = { id: string; name: string | null; email: string }
type SenderSettings = { footerName: string; footerEmail: string }
type AudienceItem =
  | { type: 'all'; id: 'all'; label?: string }
  | { type: 'course'; id: string; label?: string }
  | { type: 'noCourse'; id: 'noCourse'; label?: string }
  | { type: 'user'; id: string; email?: string; label?: string }
  | { type: 'email'; id: string; email: string; label?: string }

const TUTORIAL_STORAGE_KEY = 'newsletter-editor-basic-tutorial-dismissed'
const BUILT_IN_TAGS = ['一般', '促銷', '課程更新', '活動公告', '學員故事']
const BlockNoteNewsletterComposer = dynamic(
  () => import('@/components/admin/newsletter/blocknote-newsletter-composer').then((mod) => mod.BlockNoteNewsletterComposer),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[360px] bg-white p-8 text-sm text-muted-foreground">
        正在載入 BlockNote 編輯器...
      </div>
    ),
  }
)

function normalizeContent(content: NewsletterContent): NewsletterContent {
  return {
    blocks: Array.isArray(content?.blocks) ? content.blocks : [],
    meta: content?.meta && typeof content.meta === 'object' ? content.meta : undefined,
  }
}

function toTaipeiLocalInput(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function scheduledDate(value: string) {
  if (!value) return null
  const date = new Date(`${value}:00+08:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatTaipeiPreview(value: string) {
  const date = scheduledDate(value)
  return date
    ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Taipei' }).format(date)
    : '尚未設定'
}

function isPastSchedule(value: string) {
  const date = scheduledDate(value)
  return !!date && date.getTime() <= Date.now()
}

function itemKey(item: AudienceItem) {
  return `${item.type}:${item.id}`
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function migrateSegment(segment: SegmentJson): SegmentJson {
  if (segment.include?.length) return segment
  if (!segment.preset || segment.preset === 'all') {
    return { ...segment, include: [{ type: 'all', id: 'all', label: '所有電子郵件' }], exclude: [] }
  }
  if (segment.preset === 'courseStudents') {
    return {
      ...segment,
      include: (segment.courseIds || []).map((id) => ({ type: 'course', id })),
      exclude: [],
    }
  }
  if (segment.preset === 'manual') {
    return {
      ...segment,
      include: [
        ...(segment.manualUserIds || []).map((id) => ({ type: 'user' as const, id })),
        ...(segment.manualEmails || []).map((email) => ({ type: 'email' as const, id: normalizeEmail(email), email: normalizeEmail(email) })),
      ],
      exclude: [],
    }
  }
  return { ...segment, include: [{ type: 'all', id: 'all', label: '所有電子郵件' }], exclude: [] }
}

function audienceLabel(item: AudienceItem, courses: Options['courses']) {
  if (item.label) return item.label
  if (item.type === 'all') return '所有電子郵件'
  if (item.type === 'noCourse') return '尚未加入課程'
  if (item.type === 'course') return courses.find((course) => course.id === item.id)?.title || '課程名單'
  if (item.type === 'user') return item.label || item.email || '指定學員'
  return item.email
}

function AudiencePicker({
  label,
  placeholder,
  selected,
  courses,
  totalEmailCount,
  noCourseCount,
  includeAllOption = false,
  onChange,
}: {
  label: string
  placeholder: string
  selected: AudienceItem[]
  courses: Options['courses']
  totalEmailCount: number
  noCourseCount: number
  includeAllOption?: boolean
  onChange: (items: AudienceItem[]) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserSuggestion[]>([])
  const selectedKeys = new Set(selected.map(itemKey))
  const normalizedQuery = query.trim().toLowerCase()

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setUsers([])
        return
      }
      const result = await searchNewsletterUsers(query)
      setUsers(result.success && result.data ? result.data : [])
    }, 220)
    return () => clearTimeout(timer)
  }, [query])

  const groupOptions: Array<AudienceItem & { count?: number; description?: string }> = [
    ...(includeAllOption
      ? [{
          type: 'all' as const,
          id: 'all' as const,
          label: '所有電子郵件',
          count: totalEmailCount,
          description: '所有可聯絡的學員與帳號',
        }]
      : []),
    ...courses.map((course) => ({
      type: 'course' as const,
      id: course.id,
      label: course.title,
      count: course.audienceCount || 0,
      description: '課程名單',
    })),
    ...(includeAllOption
      ? [{
          type: 'noCourse' as const,
          id: 'noCourse' as const,
          label: '尚未加入課程',
          count: noCourseCount,
          description: '有 email 但目前沒有任何課程權限',
        }]
      : []),
  ]

  const visibleGroups = groupOptions.filter((item) => {
    if (!normalizedQuery) return true
    return `${item.label || ''} ${item.description || ''}`.toLowerCase().includes(normalizedQuery)
  })
  const userOptions: AudienceItem[] = users.map((user) => ({
    type: 'user',
    id: user.id,
    email: user.email,
    label: user.name ? `${user.name} · ${user.email}` : user.email,
  }))
  const exactUserEmail = users.some((user) => normalizeEmail(user.email) === normalizeEmail(query))
  const canAddEmail = isEmail(query) && !exactUserEmail && !selectedKeys.has(`email:${normalizeEmail(query)}`)
  const emailOption: AudienceItem | null = canAddEmail
    ? { type: 'email', id: normalizeEmail(query), email: normalizeEmail(query), label: `新增 ${normalizeEmail(query)}` }
    : null

  function toggle(item: AudienceItem) {
    const key = itemKey(item)
    if (selectedKeys.has(key)) {
      onChange(selected.filter((current) => itemKey(current) !== key))
      return
    }
    if (item.type === 'all') {
      onChange([item])
      setQuery('')
      return
    }
    onChange([...selected.filter((current) => current.type !== 'all'), item])
    setQuery('')
  }

  const menuItems = [
    ...visibleGroups,
    ...userOptions.filter((item) => !selectedKeys.has(itemKey(item))),
    ...(emailOption ? [emailOption] : []),
  ]

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="relative rounded-lg border bg-white focus-within:ring-2 focus-within:ring-ring">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="h-9 w-full bg-transparent pl-9 pr-3 text-sm outline-none"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && menuItems[0]) {
              event.preventDefault()
              toggle(menuItems[0])
            }
          }}
          placeholder={placeholder}
        />
      </div>
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selected.map((item) => (
            <Badge key={itemKey(item)} variant="secondary" className="max-w-full gap-1 rounded-full px-2 py-0.5 text-xs">
              <span className="truncate">{audienceLabel(item, courses)}</span>
              <button type="button" onClick={() => onChange(selected.filter((current) => itemKey(current) !== itemKey(item)))} aria-label={`移除 ${audienceLabel(item, courses)}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="max-h-72 overflow-auto rounded-lg border bg-white p-1 shadow-lg">
          {menuItems.length ? menuItems.map((item) => {
            const key = itemKey(item)
            const checked = selectedKeys.has(key)
            const groupItem = groupOptions.find((group) => itemKey(group) === key)
            return (
              <button
                key={key}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggle(item)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.type === 'email' && item.label?.startsWith('新增') ? item.label : audienceLabel(item, courses)}
                    {groupItem?.count !== undefined ? `（${groupItem.count.toLocaleString()} 人）` : ''}
                  </span>
                  {groupItem?.description ? <span className="block truncate text-xs text-muted-foreground">{groupItem.description}</span> : null}
                  {item.type === 'user' ? <span className="block truncate text-xs text-muted-foreground">{item.email}</span> : null}
                </span>
                {checked ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            )
          }) : (
            <div className="px-3 py-5 text-center text-xs text-muted-foreground">找不到符合的群組或 email</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function NewsletterEditor({
  campaign,
  options,
}: {
  campaign: Campaign
  options: Options
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const initialContent = useMemo(() => normalizeContent(campaign.contentJson), [campaign.contentJson])
  const [name, setName] = useState(campaign.name)
  const [subject, setSubject] = useState(campaign.subject)
  const [content, setContent] = useState<NewsletterContent>(initialContent)
  const [tags, setTags] = useState<string[]>(initialContent.meta?.tags?.length ? initialContent.meta.tags : [campaign.type === 'PROMO' ? '促銷' : '一般'])
  const [tagInput, setTagInput] = useState('')
  const [segment, setSegment] = useState<SegmentJson>(() => migrateSegment(campaign.segmentJson || { preset: 'all', mode: 'AND', rules: [] }))
  const [couponId, setCouponId] = useState(campaign.couponId || '')
  const [updatedAt, setUpdatedAt] = useState(campaign.updatedAt)
  const [dirty, setDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<string>('')
  const [audience, setAudience] = useState<AudiencePreview | null>(null)
  const [isAudienceRefreshing, setIsAudienceRefreshing] = useState(false)
  const [isChecklistLoading, setIsChecklistLoading] = useState(false)
  const [isSenderSaving, setIsSenderSaving] = useState(false)
  const [startingMode, setStartingMode] = useState<'schedule' | 'send' | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [checklistError, setChecklistError] = useState('')
  const [senderSettings, setSenderSettings] = useState<SenderSettings | null>(null)
  const [senderForm, setSenderForm] = useState<SenderSettings>({ footerName: '', footerEmail: '' })
  const [previewVersion, setPreviewVersion] = useState(0)
  const [scheduledLocal, setScheduledLocal] = useState(() => toTaipeiLocalInput(campaign.scheduledAt))
  const [showTutorial, setShowTutorial] = useState(false)
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null)

  const type: Campaign['type'] = tags.includes('促銷') ? 'PROMO' : 'GENERAL'
  const subjectState = subject.length > 70 ? 'text-red-600' : subject.length > 50 ? 'text-amber-600' : 'text-muted-foreground'
  const includeAudience = (segment.include || []) as AudienceItem[]
  const excludeAudience = (segment.exclude || []) as AudienceItem[]
  const hasGroupAudience = includeAudience.some((item) => item.type === 'all' || item.type === 'course' || item.type === 'noCourse')
  const senderIncomplete = !senderSettings?.footerName || !senderSettings?.footerEmail

  const saveDraft = useCallback(async (showToast = true) => {
    const result = await updateNewsletter({
      id: campaign.id,
      expectedUpdatedAt: updatedAt,
      type,
      name,
      subject,
      preheader: '',
      contentJson: { ...content, meta: { ...(content.meta || {}), tags } },
      segmentJson: segment,
      couponId: couponId || null,
      scheduledAt: scheduledLocal,
      timezone: 'Asia/Taipei',
    })
    if (result.success && result.data) {
      setUpdatedAt(result.data.updatedAt)
      setDirty(false)
      const label = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit' }).format(new Date())
      setLastSaved(label)
      if (showToast) alert(`已於 ${label} 儲存草稿`)
    } else {
      alert(result.error)
    }
  }, [campaign.id, content, couponId, name, scheduledLocal, segment, subject, tags, type, updatedAt])

  function handleContentChange(next: NewsletterContent) {
    setContent(next)
    setDirty(true)
  }

  function addTag(tag: string) {
    const normalized = tag.trim()
    if (!normalized || tags.includes(normalized)) return
    setTags([...tags, normalized])
    setTagInput('')
    setDirty(true)
  }

  function removeTag(tag: string) {
    const next = tags.filter((item) => item !== tag)
    setTags(next.length ? next : ['一般'])
    setDirty(true)
  }

  const runAudienceEstimate = useCallback(async () => {
    setIsAudienceRefreshing(true)
    setChecklistError('')
    try {
      const result = await estimateNewsletterAudience(campaign.id)
      if (result.success && result.data) {
        setAudience(result.data)
      } else {
        setChecklistError(result.error || '預估收件人失敗')
      }
    } finally {
      setIsAudienceRefreshing(false)
    }
  }, [campaign.id])

  const refreshAudience = useCallback(async () => {
    await saveDraft(false)
    await runAudienceEstimate()
  }, [runAudienceEstimate, saveDraft])

  async function handleChecklist() {
    setIsChecklistLoading(true)
    setChecklistError('')
    try {
      await saveDraft(false)
      const [settingsResult, result] = await Promise.all([
        getNewsletterSenderSettings(),
        getNewsletterSendChecklist(campaign.id),
      ])
      if (settingsResult.success && settingsResult.data) {
        setSenderSettings(settingsResult.data)
        setSenderForm(settingsResult.data)
      }
      setChecklistError(result.success ? '' : result.error || '')
      if (result.data) setAudience(result.data)
    } finally {
      setIsChecklistLoading(false)
    }
  }

  async function handleSenderSave() {
    setIsSenderSaving(true)
    setChecklistError('')
    try {
      const result = await updateNewsletterSenderSettings(senderForm)
      if (!result.success) {
        setChecklistError(result.error || '儲存寄件人資訊失敗')
        return
      }
      if (result.data) {
        setSenderSettings(result.data)
        setSenderForm(result.data)
      }
      setPreviewVersion((value) => value + 1)
      await handleChecklist()
    } finally {
      setIsSenderSaving(false)
    }
  }

  async function handleStart(scheduled = false) {
    setStartingMode(scheduled ? 'schedule' : 'send')
    setChecklistError('')
    try {
      await saveDraft(false)
      const result = await startNewsletter(campaign.id, scheduled ? scheduledLocal : null)
      if (result.success) {
        router.push('/admin/newsletters')
        router.refresh()
      } else {
        setChecklistError(result.error || '啟動失敗')
      }
    } finally {
      setStartingMode(null)
    }
  }

  async function handleTest() {
    await saveDraft(false)
    const result = await sendTestNewsletter(campaign.id, testEmail)
    alert(result.success ? '測試信已寄出' : result.error)
  }

  function updateIncludeAudience(items: AudienceItem[]) {
    const normalized = items.some((item) => item.type === 'all')
      ? items.filter((item) => item.type === 'all').slice(-1)
      : items
    setSegment({ ...segment, include: normalized, preset: 'manual', mode: 'OR' })
    setDirty(true)
  }

  function updateExcludeAudience(items: AudienceItem[]) {
    setSegment({ ...segment, exclude: items.filter((item) => item.type !== 'all') })
    setDirty(true)
  }

  useEffect(() => {
    setShowTutorial(window.localStorage.getItem(TUTORIAL_STORAGE_KEY) !== 'true')
  }, [])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!dirty) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      startTransition(() => saveDraft(false))
    }, 5000)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [dirty, saveDraft])

  useEffect(() => {
    runAudienceEstimate()
  }, [runAudienceEstimate])

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-6">
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setDirty(true)
          }}
          className="h-9 w-80 border-0 bg-transparent px-0 text-base font-semibold shadow-none"
          placeholder="內部名稱（不會寄出）"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{dirty ? '尚未儲存' : lastSaved ? `已於 ${lastSaved} 儲存草稿` : '已載入草稿'}</span>
          <Button variant="ghost" onClick={() => saveDraft()} disabled={isPending}>
            <Save className="h-4 w-4" />
            儲存草稿
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <TestTube2 className="h-4 w-4" />
                發送測試
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>發送測試信</DialogTitle>
              </DialogHeader>
              <Label>內部帳號 Email</Label>
              <Input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="admin@example.com" />
              <DialogFooter>
                <Button onClick={handleTest}>寄送測試信</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog onOpenChange={(open) => open && handleChecklist()}>
            <DialogTrigger asChild>
              <Button variant={type === 'PROMO' ? 'cta' : 'default'}>
                <Send className="h-4 w-4" />
                排程 / 立即發送
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100vh-2rem)] w-[min(calc(100vw-2rem),1040px)] overflow-y-auto sm:max-w-[1040px]">
              <DialogHeader>
                <DialogTitle>發送前確認與真實預覽</DialogTitle>
              </DialogHeader>
              <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <iframe src={`/api/newsletter/preview?id=${campaign.id}&v=${previewVersion}`} className="h-[min(58vh,560px)] min-h-[360px] w-full rounded-lg border bg-white" sandbox="" />
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">收件人</p>
                    <div className="mt-1 flex items-center gap-2">
                      {isChecklistLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
                      <p className="font-mono text-2xl font-bold">{isChecklistLoading ? '計算中' : audience?.sendable ?? '—'}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">符合 {audience?.matched ?? 0}，排除 {((audience?.excluded?.unsubscribed || 0) + (audience?.excluded?.marketingMissing || 0) + (audience?.excluded?.hardBounced || 0)).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">發布時間</p>
                    <p className="font-medium">{isPastSchedule(scheduledLocal) ? '立即發送' : formatTaipeiPreview(scheduledLocal)}</p>
                  </div>
                  <div className={senderIncomplete ? 'rounded-lg border border-amber-200 bg-amber-50 p-3' : 'rounded-lg border p-3'}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">寄件人資訊</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          會顯示在電子報頁尾，讓收件人知道寄件方並可以聯絡你。
                        </p>
                      </div>
                      <Badge variant={senderIncomplete ? 'outline' : 'secondary'}>{senderIncomplete ? '未完成' : '已設定'}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">寄件人名稱</Label>
                        <Input
                          className="h-9"
                          value={senderForm.footerName}
                          onChange={(event) => setSenderForm((current) => ({ ...current, footerName: event.target.value }))}
                          placeholder="例如：WooMin"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">聯絡信箱</Label>
                        <Input
                          className="h-9"
                          value={senderForm.footerEmail}
                          onChange={(event) => setSenderForm((current) => ({ ...current, footerEmail: event.target.value }))}
                          placeholder="support@example.com"
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={handleSenderSave} disabled={isSenderSaving || isChecklistLoading} className="w-full">
                        {isSenderSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isSenderSaving ? '正在儲存...' : '儲存並重新檢查'}
                      </Button>
                    </div>
                  </div>
                  {isChecklistLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在重新計算收件人與檢查發送條件...
                    </div>
                  ) : checklistError ? (
                    <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{checklistError}</pre>
                  ) : (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">發送檢查通過。</div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleStart(true)} disabled={isChecklistLoading || !!startingMode || !!checklistError || isPastSchedule(scheduledLocal)}>
                  {startingMode === 'schedule' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  {startingMode === 'schedule' ? '正在排程...' : '排程發送'}
                </Button>
                <Button variant={type === 'PROMO' ? 'cta' : 'default'} onClick={() => handleStart(false)} disabled={isChecklistLoading || !!startingMode || !!checklistError}>
                  {startingMode === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {startingMode === 'send' ? '正在計算並發送...' : '立即發送'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {showTutorial ? (
        <div className="fixed left-4 top-20 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border bg-white p-4 shadow-xl shadow-slate-950/10 lg:left-[18rem]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CircleHelp className="h-4 w-4" />
                新手教學
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                在內容區輸入 <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">/</kbd> 可以新增電子報區塊，例如按鈕、課程卡、優惠券與 CTA。
              </p>
            </div>
            <button
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')
                setShowTutorial(false)
              }}
              aria-label="永久關閉新手教學"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[minmax(0,1fr)_360px] gap-0">
        <main className="mx-auto w-full max-w-[760px] px-10 py-12">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">電子郵件主旨</Label>
            <Input
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value)
                setDirty(true)
              }}
              className="mt-3 h-auto border-0 px-0 text-5xl font-extrabold leading-tight tracking-normal shadow-none focus-visible:ring-0"
              placeholder="輸入電子郵件主旨"
            />
            <p className={`mt-2 text-xs ${subjectState}`}>{subject.length} 字，建議 50 字內，超過 70 字會過長。</p>

            <div className="mt-8">
              <BlockNoteNewsletterComposer
                content={content}
                courses={options.courses}
                coupons={options.coupons}
                onChange={handleContentChange}
              />
            </div>
          </div>
        </main>

        <aside className="border-l px-6 py-6">
          <SettingsSection title="基礎設定與發布">
            <Label>發布時間</Label>
            <div className="grid grid-cols-[1fr_92px] gap-2">
              <Input type="date" value={scheduledLocal.slice(0, 10)} onChange={(event) => { setScheduledLocal(`${event.target.value}T${scheduledLocal.slice(11, 16)}`); setDirty(true) }} />
              <Input type="time" value={scheduledLocal.slice(11, 16)} onChange={(event) => { setScheduledLocal(`${scheduledLocal.slice(0, 10)}T${event.target.value}`); setDirty(true) }} />
            </div>
            <div className={isPastSchedule(scheduledLocal) ? 'rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800' : 'text-xs text-muted-foreground'}>
              {isPastSchedule(scheduledLocal) ? '發布時間早於目前時間，將顯示為立即發送。' : `將於 ${formatTaipeiPreview(scheduledLocal)} 發送`}
            </div>

            <Label>標籤</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 rounded-full px-2 py-0.5 text-xs">
                  {tag}
                  <button onClick={() => removeTag(tag)} aria-label={`移除 ${tag}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input className="h-9" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(tagInput) } }} placeholder="新增標籤" />
              <Button variant="outline" size="sm" onClick={() => addTag(tagInput)}>新增</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {BUILT_IN_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
                <button key={tag} className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted" onClick={() => addTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>

            {type === 'PROMO' ? (
              <>
                <Label>優惠券（選填）</Label>
                <Select
                  value={couponId || 'none'}
                  onValueChange={(value) => {
                    setCouponId(value === 'none' ? '' : value)
                    setDirty(true)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不綁定優惠券</SelectItem>
                    {options.coupons.map((coupon) => (
                      <SelectItem key={coupon.id} value={coupon.id}>
                        {coupon.code} · {coupon.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
          </SettingsSection>

          <SettingsSection title="收件人管理">
            <AudiencePicker
              label="收件對象"
              placeholder="搜尋群組、課程或 email"
              selected={includeAudience}
              courses={options.courses}
              totalEmailCount={options.audienceGroups?.totalEmailCount || 0}
              noCourseCount={options.audienceGroups?.noCourseCount || 0}
              includeAllOption
              onChange={updateIncludeAudience}
            />

            {hasGroupAudience ? (
              <div className="border-t pt-2.5">
                <AudiencePicker
                  label="排除受眾"
                  placeholder="搜尋要排除的課程或 email"
                  selected={excludeAudience}
                  courses={options.courses}
                  totalEmailCount={options.audienceGroups?.totalEmailCount || 0}
                  noCourseCount={options.audienceGroups?.noCourseCount || 0}
                  onChange={updateExcludeAudience}
                />
              </div>
            ) : null}
          </SettingsSection>

          <SettingsSection title="發送摘要">
            <div className="grid grid-cols-2 gap-4 border-b pb-3">
              <div>
                <p className="text-xs text-muted-foreground">將發送</p>
                <p className="font-mono text-2xl font-bold">{audience?.sendable ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">已排除</p>
                <p className="font-mono text-2xl font-bold">{((audience?.excluded?.unsubscribed || 0) + (audience?.excluded?.marketingMissing || 0) + (audience?.excluded?.hardBounced || 0)).toLocaleString()}</p>
              </div>
            </div>
            <Button variant="outline" onClick={refreshAudience} disabled={isAudienceRefreshing} className="w-full">
              {isAudienceRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isAudienceRefreshing ? '正在重新預估...' : '重新預估收件人'}
            </Button>
            {isAudienceRefreshing ? (
              <p className="text-center text-xs text-muted-foreground">正在套用分眾、排除名單與退訂狀態，請稍候...</p>
            ) : null}
            {audience?.recipients?.length ? (
              <div className="max-h-56 overflow-auto rounded-lg border bg-muted/20">
                {audience.recipients.map((recipient) => (
                  <div key={`${recipient.source}:${recipient.id}`} className="flex items-center justify-between gap-3 border-b px-3 py-2 text-xs last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{recipient.email}</p>
                      {recipient.name ? <p className="truncate text-muted-foreground">{recipient.name}</p> : null}
                    </div>
                    {recipient.source === 'external' ? <Badge variant="outline">手動</Badge> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {checklistError ? <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{checklistError}</pre> : null}
          </SettingsSection>
        </aside>
      </div>
    </div>
  )
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-2.5 text-sm">{children}</div>
    </section>
  )
}
