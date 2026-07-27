// components/main/player/lesson-comments-popover.tsx
// 單元「課程留言」(群組公開留言, Popover)
// 私訊老師已獨立為 LessonPrivateMessagePopover

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { format, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageCircle, Send, UserRound } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type LessonCommentDTO = {
  id: string
  lessonId: string
  content: string
  isAnonymous: boolean
  createdAt: string
  user: { id: string; name: string | null; image: string | null }
}

interface LessonCommentsPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lessonId: string
  trigger: React.ReactNode
}

export function LessonCommentsPopover({
  open,
  onOpenChange,
  lessonId,
  trigger,
}: LessonCommentsPopoverProps) {
  const { data: session } = useSession()

  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [comments, setComments] = useState<LessonCommentDTO[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const composingRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const canSend = useMemo(() => {
    if (!session?.user?.id) return false
    if (!content.trim()) return false
    if (sending) return false
    if (cooldownUntil && now < cooldownUntil) return false
    return true
  }, [session?.user?.id, content, sending, cooldownUntil, now])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return isToday(d) ? format(d, 'HH:mm') : format(d, 'MM/dd HH:mm')
  }

  const fetchLatest = useCallback(async () => {
    if (!session?.user?.id) {
      setComments([])
      setNextCursor(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/lesson-comments?lessonId=${encodeURIComponent(lessonId)}&limit=50`,
        { method: 'GET' }
      )
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || '取得留言失敗')
      }

      setComments((json.comments as LessonCommentDTO[]).slice().reverse())
      setNextCursor(json.nextCursor ?? null)

      setTimeout(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, 0)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '取得留言失敗')
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
        `/api/lesson-comments?lessonId=${encodeURIComponent(
          lessonId
        )}&limit=50&cursor=${encodeURIComponent(nextCursor)}`,
        { method: 'GET' }
      )
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || '取得更多留言失敗')
      }
      const more = (json.comments as LessonCommentDTO[]).slice().reverse()
      setComments((prev) => [...more, ...prev])
      setNextCursor(json.nextCursor ?? null)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '取得更多留言失敗')
    } finally {
      setLoadingMore(false)
    }
  }, [lessonId, loadingMore, nextCursor, session?.user?.id])

  useEffect(() => {
    if (!open) return
    fetchLatest()
  }, [open, fetchLatest])

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const res = await fetch('/api/lesson-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, content, isAnonymous }),
      })

      const json = await res.json()
      if (!res.ok || !json?.success) {
        if (res.status === 429) {
          const retryAfterSec = Number(json?.retryAfterSec ?? 15)
          setCooldownUntil(Date.now() + retryAfterSec * 1000)
          toast.error('每 15 秒只能發言一次')
          return
        }
        throw new Error(json?.error || '送出失敗')
      }

      setContent('')
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
            <MessageCircle className="h-4 w-4 text-cta" />
            <span className="text-sm font-bold">課程留言</span>
          </div>

          <div className="px-4 pt-3">
            {comments.length === 0 && !loading && (
              <p className="text-sm text-white/60">
                還沒有留言，來當第一個吧！
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
                {loadingMore ? '載入中...' : '載入較早留言'}
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 px-4 pb-3" viewportRef={scrollRef}>
            <div className="space-y-4 py-3">
              {comments.map((c) => {
                const isMine = session?.user?.id === c.user.id
                const displayImage = c.isAnonymous ? null : c.user.image
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'flex gap-3',
                      isMine ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {!isMine && (
                      <Avatar className="mt-0.5 size-7 border border-white/10 bg-white/5">
                        {displayImage ? (
                          <AvatarImage src={displayImage} alt={c.user.name ?? ''} />
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
                          {c.isAnonymous && !isMine ? '學員（匿名）' : c.user.name ?? '學員'}
                        </span>
                        <span className="text-[11px] text-white/35">
                          {formatTime(c.createdAt)}
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
                        {c.content}
                      </div>
                    </div>

                    {isMine && (
                      <Avatar className="mt-0.5 size-7 border border-white/10 bg-white/5">
                        {!c.isAnonymous && session?.user?.image ? (
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
                請先登入才能留言
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isAnonymous}
                      onCheckedChange={setIsAnonymous}
                      className={cn(
                        'h-4 w-8',
                        'data-[state=checked]:bg-cta data-[state=unchecked]:bg-white/15'
                      )}
                    />
                    <span className="text-xs font-semibold text-white/70">
                      匿名送出
                    </span>
                  </div>
                  {cooldownText && (
                    <span className="text-[11px] text-white/35">
                      冷卻 {cooldownText}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="輸入留言..."
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
                    aria-label="送出留言"
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
