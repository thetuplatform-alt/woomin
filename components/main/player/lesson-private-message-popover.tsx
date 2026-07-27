// components/main/player/lesson-private-message-popover.tsx
// 單元「私訊老師」(一對一私密訊息, Popover)
// 與課程留言 (LessonCommentsPopover) 完全獨立

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { format, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FileText, Lock, Mail, Paperclip, Send, UserRound, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type LessonPrivateMessageDTO = {
  id: string
  lessonId: string
  content: string
  attachmentMediaId: string | null
  attachmentUrl: string | null
  attachmentName: string | null
  attachmentMimeType: string | null
  attachmentSize: number | null
  isFromTeacher: boolean
  createdAt: string
  user: { id: string; name: string | null; image: string | null }
}

interface LessonPrivateMessagePopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lessonId: string
  trigger: React.ReactNode
}

export function LessonPrivateMessagePopover({
  open,
  onOpenChange,
  lessonId,
  trigger,
}: LessonPrivateMessagePopoverProps) {
  const { data: session } = useSession()

  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [messages, setMessages] = useState<LessonPrivateMessageDTO[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const [content, setContent] = useState('')
  const [selectedAttachment, setSelectedAttachment] = useState<{
    id: string
    url: string
    originalName: string
    mimeType: string
    size: number
  } | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const composingRef = useRef(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  const canSend = useMemo(() => {
    if (!session?.user?.id) return false
    if (!content.trim() && !selectedAttachment) return false
    if (sending) return false
    if (cooldownUntil && now < cooldownUntil) return false
    return true
  }, [session?.user?.id, content, selectedAttachment, sending, cooldownUntil, now])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return isToday(d) ? format(d, 'HH:mm') : format(d, 'MM/dd HH:mm')
  }

  const fetchLatest = useCallback(async () => {
    if (!session?.user?.id) {
      setMessages([])
      setNextCursor(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/lesson-private-messages?lessonId=${encodeURIComponent(
          lessonId
        )}&limit=50`,
        { method: 'GET' }
      )
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || '取得私訊失敗')
      }

      setMessages((json.messages as LessonPrivateMessageDTO[]).slice().reverse())
      setNextCursor(json.nextCursor ?? null)

      setTimeout(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, 0)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '取得私訊失敗')
    } finally {
      setLoading(false)
    }
  }, [lessonId, session?.user?.id])

  const fetchMore = useCallback(async () => {
    if (!session?.user?.id) return
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/lesson-private-messages?lessonId=${encodeURIComponent(
          lessonId
        )}&limit=50&cursor=${encodeURIComponent(nextCursor)}`,
        { method: 'GET' }
      )
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || '取得更多私訊失敗')
      }
      const more = (json.messages as LessonPrivateMessageDTO[]).slice().reverse()
      setMessages((prev) => [...more, ...prev])
      setNextCursor(json.nextCursor ?? null)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '取得更多私訊失敗')
    } finally {
      setLoadingMore(false)
    }
  }, [lessonId, loadingMore, nextCursor, session?.user?.id])

  useEffect(() => {
    if (!open) return
    fetchLatest()
  }, [open, fetchLatest])

  const handleAttachmentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('私訊附件不能超過 10MB')
      event.target.value = ''
      return
    }

    setUploadingAttachment(true)
    try {
      const formData = new FormData()
      formData.append('lessonId', lessonId)
      formData.append('file', file)

      const res = await fetch('/api/lesson-private-messages/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || '附件上傳失敗')
      }

      setSelectedAttachment(json.media)
      toast.success('附件已加入私訊')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '附件上傳失敗')
    } finally {
      setUploadingAttachment(false)
      if (attachmentInputRef.current) attachmentInputRef.current.value = ''
    }
  }

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const res = await fetch('/api/lesson-private-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          content,
          ...(selectedAttachment
            ? { attachmentMediaId: selectedAttachment.id }
            : {}),
        }),
      })

      const json = await res.json()
      if (!res.ok || !json?.success) {
        if (res.status === 429) {
          const retryAfterSec = Number(json?.retryAfterSec ?? 15)
          setCooldownUntil(Date.now() + retryAfterSec * 1000)
          toast.error('每 15 秒只能發送一次私訊')
          return
        }
        throw new Error(json?.error || '送出失敗')
      }

      setContent('')
      setSelectedAttachment(null)
      setCooldownUntil(Date.now() + 15_000)
      await fetchLatest()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '送出失敗')
    } finally {
      setSending(false)
    }
  }

  const cooldownText = useMemo(() => {
    if (!cooldownUntil) return null
    const left = Math.ceil((cooldownUntil - now) / 1000)
    if (left <= 0) return null
    return `${left}s`
  }, [cooldownUntil, now])

  useEffect(() => {
    if (!cooldownUntil) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [cooldownUntil])

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={12}
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
        className={cn(
          'z-[70] w-[92vw] max-w-[360px] p-0 overflow-hidden',
          'border border-white/10 bg-[#121212] text-white shadow-2xl rounded-2xl'
        )}
      >
        <div className="flex flex-col min-h-[240px] max-h-[72vh]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <Mail className="h-4 w-4 text-cta" />
            <span className="text-sm font-bold">私訊老師</span>
          </div>

          <div className="px-4 pt-3">
            {messages.length === 0 && !loading && (
              <p className="text-sm text-white/60">
                還沒有私訊紀錄，可以直接把問題傳給老師。
              </p>
            )}
            {loading && <p className="text-[11px] text-white/35">載入中...</p>}
          </div>

          <div className="px-4 pt-2">
            {nextCursor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchMore}
                disabled={loadingMore}
                className="h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
              >
                {loadingMore ? '載入中...' : '載入較早私訊'}
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 px-4 pb-3" viewportRef={scrollRef}>
            <div className="space-y-4 py-3">
              {messages.map((m) => {
                const isTeacher = m.isFromTeacher
                const isMine = session?.user?.id === m.user.id && !isTeacher
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex gap-3',
                      isMine ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {!isMine && (
                      <Avatar className="mt-0.5 size-7 border border-white/10 bg-white/5">
                        {m.user.image ? (
                          <AvatarImage src={m.user.image} alt={m.user.name ?? ''} />
                        ) : (
                          <AvatarFallback className="bg-transparent text-white/60">
                            <UserRound className="h-4 w-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    )}

                    <div className={cn('max-w-[78%]', isMine && 'text-right')}>
                      <div
                        className={cn(
                          'mb-1 flex items-center gap-2',
                          isMine && 'justify-end'
                        )}
                      >
                        <span className="text-xs font-semibold text-white/70">
                          {isTeacher ? '老師' : m.user.name ?? '學員'}
                        </span>
                        <span className="text-[11px] text-white/35">
                          {formatTime(m.createdAt)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
                          isMine
                            ? 'bg-cta text-heading rounded-tr-md'
                            : 'bg-white/10 text-white rounded-tl-md'
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
                              isMine ? 'bg-black/10 text-heading' : 'bg-white/10 text-white'
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

                    {isMine && (
                      <Avatar className="mt-0.5 size-7 border border-white/10 bg-white/5">
                        {session?.user?.image ? (
                          <AvatarImage
                            src={session.user.image}
                            alt={session.user.name ?? ''}
                          />
                        ) : (
                          <AvatarFallback className="bg-transparent text-white/60">
                            <UserRound className="h-4 w-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          <div className="border-t border-white/10 bg-[#0F0F0F] px-4 py-3">
            {!session?.user?.id ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
                請先登入才能私訊老師
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-white/45" />
                    <span className="text-xs font-semibold text-white/70">
                      只有你和老師看得到
                    </span>
                  </div>
                  {cooldownText && (
                    <span className="text-[11px] text-white/35">
                      冷卻 {cooldownText}
                    </span>
                  )}
                </div>

                {selectedAttachment && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {selectedAttachment.originalName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAttachment(null)}
                      className="shrink-0 text-white/45 hover:text-white"
                      aria-label="移除附件"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleAttachmentUpload}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={sending || uploadingAttachment}
                    onClick={() => attachmentInputRef.current?.click()}
                    className="h-10 w-10 rounded-xl text-white/65 hover:bg-white/10 hover:text-white"
                    aria-label="上傳附件"
                  >
                    {uploadingAttachment ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>
                  <Input
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="輸入給老師的私訊..."
                    maxLength={2000}
                    className={cn(
                      'h-10 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35',
                      'focus-visible:ring-cta/30'
                    )}
                    disabled={sending}
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
                    className={cn(
                      'h-10 w-10 rounded-xl bg-cta text-heading hover:bg-cta/90',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    aria-label="送出私訊"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-[11px] text-white/35">Ctrl/⌘ + Enter 送出</div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
