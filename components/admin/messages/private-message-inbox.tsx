// components/admin/messages/private-message-inbox.tsx
// 老師私訊「對話式收件匣」(Messenger 風格)
// 左：依學員聚合的對話清單（未讀紅點、最後訊息預覽、待回覆篩選）
// 右：完整往返訊息 + 行內回覆 + 附件

'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { format, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  FileText,
  Inbox,
  Loader2,
  Mail,
  MessagesSquare,
  Paperclip,
  Send,
  UserRound,
  X,
} from 'lucide-react'
import {
  getPrivateMessageConversations,
  getPrivateMessageThread,
  markPrivateMessageThreadRead,
  type PrivateMessageConversation,
  type PrivateMessageThreadItem,
} from '@/lib/actions/private-messages-admin'
import { notifyAdminPrivateMessageUnreadChanged } from '@/lib/private-message-events'

type InboxFilter = 'ALL' | 'UNREPLIED'

interface PrivateMessageInboxProps {
  /** 指定課程時，只顯示該課程的私訊；未指定為全站可管理範圍。 */
  courseId?: string
  initialConversations: PrivateMessageConversation[]
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return isToday(d) ? format(d, 'HH:mm') : format(d, 'MM/dd HH:mm')
}

export function PrivateMessageInbox({
  courseId,
  initialConversations,
}: PrivateMessageInboxProps) {
  const [conversations, setConversations] = useState<
    PrivateMessageConversation[]
  >(initialConversations)
  const [filter, setFilter] = useState<InboxFilter>('ALL')
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const [thread, setThread] = useState<PrivateMessageThreadItem[]>([])
  const [loadingThread, setLoadingThread] = useState(false)

  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachment, setAttachment] = useState<{
    id: string
    originalName: string
  } | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const composingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const threadScrollRef = useRef<HTMLDivElement>(null)

  const activeConversation = useMemo(
    () => conversations.find((c) => c.key === activeKey) ?? null,
    [conversations, activeKey]
  )

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  )

  const visibleConversations = useMemo(
    () =>
      filter === 'UNREPLIED'
        ? // 「待回覆」= 學員未讀，或最後一則為學員所發（已讀但老師尚未回覆）
          conversations.filter(
            (c) => c.unreadCount > 0 || !c.lastMessage.isFromTeacher
          )
        : conversations,
    [conversations, filter]
  )

  const refreshConversations = useCallback(async () => {
    try {
      const list = await getPrivateMessageConversations(courseId)
      setConversations(list)
    } catch (e) {
      console.error(e)
    }
  }, [courseId])

  const openConversation = useCallback(
    async (conversation: PrivateMessageConversation) => {
      setActiveKey(conversation.key)
      setContent('')
      setAttachment(null)
      setLoadingThread(true)
      try {
        const items = await getPrivateMessageThread(
          conversation.lessonId,
          conversation.userId
        )
        setThread(items)
        setTimeout(() => {
          const el = threadScrollRef.current
          if (el) el.scrollTop = el.scrollHeight
        }, 0)

        // 標記已讀並更新本地未讀數
        if (conversation.unreadCount > 0) {
          const result = await markPrivateMessageThreadRead(
            conversation.lessonId,
            conversation.userId
          )
          if (result.success) {
            setConversations((prev) =>
              prev.map((c) =>
                c.key === conversation.key ? { ...c, unreadCount: 0 } : c
              )
            )
            notifyAdminPrivateMessageUnreadChanged()
          } else {
            toast.error(result.error || '標記已讀失敗')
          }
        }
      } catch (e) {
        console.error(e)
        toast.error('載入對話失敗')
      } finally {
        setLoadingThread(false)
      }
    },
    []
  )

  const handleAttachmentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file || !activeConversation) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('私訊附件不能超過 10MB')
      event.target.value = ''
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('lessonId', activeConversation.lessonId)
      formData.append('file', file)
      const res = await fetch('/api/lesson-private-messages/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || '附件上傳失敗')
      }
      setAttachment({ id: json.media.id, originalName: json.media.originalName })
      toast.success('附件已加入回覆')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '附件上傳失敗')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const canSend =
    !!activeConversation &&
    (!!content.trim() || !!attachment) &&
    !sending &&
    !(cooldownUntil && now < cooldownUntil)

  const handleSend = async () => {
    if (!canSend || !activeConversation) return
    setSending(true)
    try {
      const res = await fetch('/api/lesson-private-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: activeConversation.lessonId,
          userId: activeConversation.userId,
          content,
          ...(attachment ? { attachmentMediaId: attachment.id } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        if (res.status === 429) {
          const retryAfterSec = Number(json?.retryAfterSec ?? 15)
          setCooldownUntil(Date.now() + retryAfterSec * 1000)
          toast.error('回覆過於頻繁，請稍候再試')
          return
        }
        throw new Error(json?.error || '回覆失敗')
      }

      setContent('')
      setAttachment(null)
      setCooldownUntil(Date.now() + 15_000)

      // 重新載入對話串與清單
      const items = await getPrivateMessageThread(
        activeConversation.lessonId,
        activeConversation.userId
      )
      setThread(items)
      setTimeout(() => {
        const el = threadScrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, 0)
      await refreshConversations()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '回覆失敗')
    } finally {
      setSending(false)
    }
  }

  // 冷卻倒數
  useEffect(() => {
    if (!cooldownUntil) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [cooldownUntil])

  const cooldownText = useMemo(() => {
    if (!cooldownUntil) return null
    const left = Math.ceil((cooldownUntil - now) / 1000)
    return left > 0 ? `${left}s` : null
  }, [cooldownUntil, now])

  return (
    <div className="flex h-full min-h-[520px] overflow-hidden">
      {/* 左側：對話清單 */}
      <div className="flex w-full max-w-[340px] flex-shrink-0 flex-col border-r border-divider">
        <div className="border-b border-divider p-4">
          <h2
            data-tour="inbox-unread-badge"
            className="flex items-center gap-2 text-base font-extrabold text-heading"
          >
            <Mail className="h-5 w-5 text-cta" />
            老師私訊
            {totalUnread > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {totalUnread}
              </span>
            )}
          </h2>
          <div
            data-tour="inbox-filter-toggle"
            className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1"
          >
            {(['ALL', 'UNREPLIED'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'h-8 rounded-md text-xs font-semibold transition-colors',
                  filter === f
                    ? 'bg-white text-heading shadow-sm'
                    : 'text-body hover:text-heading'
                )}
              >
                {f === 'ALL' ? '全部' : '待回覆'}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea data-tour="inbox-conversation-list" className="flex-1">
          {visibleConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Inbox className="mb-3 h-10 w-10 text-[#D4D4D4]" />
              <p className="text-sm text-body">
                {filter === 'UNREPLIED' ? '沒有待回覆的私訊' : '目前沒有私訊'}
              </p>
              <p className="mt-1 text-xs text-caption">
                學員私訊老師後會出現在這裡
              </p>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {visibleConversations.map((c) => {
                const isActive = c.key === activeKey
                const hasUnread = c.unreadCount > 0
                return (
                  <button
                    key={c.key}
                    onClick={() => openConversation(c)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-cta/10 border-l-2 border-cta'
                        : 'border-l-2 border-transparent hover:bg-surface'
                    )}
                  >
                    <Avatar className="mt-0.5 size-9 flex-shrink-0 border border-divider">
                      {c.student.image ? (
                        <AvatarImage
                          src={c.student.image}
                          alt={c.student.name ?? ''}
                        />
                      ) : (
                        <AvatarFallback className="bg-surface text-caption">
                          <UserRound className="h-4 w-4" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-sm',
                            hasUnread
                              ? 'font-bold text-heading'
                              : 'font-semibold text-heading'
                          )}
                        >
                          {c.student.name || '未命名學員'}
                        </span>
                        <span className="flex-shrink-0 text-[10px] text-caption">
                          {formatTime(c.lastActivityAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-caption">
                        {c.course.title}・{c.lesson.title}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <p
                          className={cn(
                            'flex-1 truncate text-xs',
                            hasUnread ? 'text-heading' : 'text-body'
                          )}
                        >
                          {c.lastMessage.isFromTeacher && '老師：'}
                          {c.lastMessage.content ||
                            (c.lastMessage.hasAttachment ? '（附件）' : '')}
                        </p>
                        {hasUnread && (
                          <span className="flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 右側：對話內容 */}
      <div
        data-tour="inbox-thread"
        className="flex min-w-0 flex-1 flex-col bg-surface"
      >
        {!activeConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <MessagesSquare className="mb-3 h-12 w-12 text-[#D4D4D4]" />
            <p className="text-sm text-body">選擇左側的對話即可查看與回覆</p>
          </div>
        ) : (
          <>
            {/* 對話標題 */}
            <div className="flex items-center gap-3 border-b border-divider bg-white px-5 py-3">
              <Avatar className="size-9 border border-divider">
                {activeConversation.student.image ? (
                  <AvatarImage
                    src={activeConversation.student.image}
                    alt={activeConversation.student.name ?? ''}
                  />
                ) : (
                  <AvatarFallback className="bg-surface text-caption">
                    <UserRound className="h-4 w-4" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-heading">
                  {activeConversation.student.name || '未命名學員'}
                </p>
                <p className="truncate text-xs text-caption">
                  {activeConversation.student.email}・
                  {activeConversation.course.title} /{' '}
                  {activeConversation.lesson.title}
                </p>
              </div>
            </div>

            {/* 訊息串 */}
            <ScrollArea className="flex-1 px-5" viewportRef={threadScrollRef}>
              {loadingThread ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-caption" />
                </div>
              ) : (
                <div className="space-y-4 py-5">
                  {thread.map((m) => {
                    const isTeacher = m.isFromTeacher
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'flex gap-2.5',
                          isTeacher ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {!isTeacher && (
                          <Avatar className="mt-0.5 size-7 flex-shrink-0 border border-divider">
                            {m.user.image ? (
                              <AvatarImage src={m.user.image} alt="" />
                            ) : (
                              <AvatarFallback className="bg-white text-caption">
                                <UserRound className="h-4 w-4" />
                              </AvatarFallback>
                            )}
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            'max-w-[78%]',
                            isTeacher && 'text-right'
                          )}
                        >
                          <div
                            className={cn(
                              'mb-1 flex items-center gap-2 text-[11px]',
                              isTeacher && 'justify-end'
                            )}
                          >
                            <span className="font-semibold text-body">
                              {isTeacher ? '老師' : m.user.name || '學員'}
                            </span>
                            <span className="text-caption">
                              {formatTime(m.createdAt)}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed',
                              isTeacher
                                ? 'rounded-tr-md bg-cta text-white'
                                : 'rounded-tl-md border border-divider bg-white text-heading'
                            )}
                          >
                            {m.content || null}
                            {m.attachmentUrl && (
                              <a
                                href={m.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  'mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold underline-offset-2 hover:underline',
                                  isTeacher
                                    ? 'bg-white/15 text-white'
                                    : 'bg-surface text-cta'
                                )}
                              >
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="truncate">
                                  {m.attachmentName || '附件'}
                                </span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>

            {/* 回覆輸入區 */}
            <div
              data-tour="inbox-reply-box"
              className="border-t border-divider bg-white px-5 py-3"
            >
              {attachment && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-divider bg-surface px-3 py-2 text-xs text-body">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{attachment.originalName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="shrink-0 text-caption hover:text-heading"
                    aria-label="移除附件"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttachmentUpload}
                />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={sending || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 w-10 rounded-xl text-body hover:bg-surface hover:text-heading"
                  aria-label="上傳附件"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="輸入回覆給學員..."
                  maxLength={2000}
                  disabled={sending}
                  className="h-10 rounded-xl border-divider"
                  onCompositionStart={() => {
                    composingRef.current = true
                  }}
                  onCompositionEnd={() => {
                    composingRef.current = false
                  }}
                  onKeyDown={(e) => {
                    if (composingRef.current) return
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="h-10 w-10 rounded-xl bg-cta text-white hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="送出回覆"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-caption">
                <span>Ctrl/⌘ + Enter 送出，回覆會 Email 通知學員</span>
                {cooldownText && <span>冷卻 {cooldownText}</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
