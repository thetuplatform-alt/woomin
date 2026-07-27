// components/admin/shared/sticky-save-bar.tsx
// 浮動儲存列 — 當表單有未儲存變更時顯示，確保用戶不會錯過儲存按鈕
// 使用 fixed 定位固定在畫面底部

'use client'

import { useEffect } from 'react'
import { Loader2, Save, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StickySaveBarProps {
  isDirty: boolean
  isPending: boolean
  onSubmit?: () => void
  form?: 'submit'
  label?: string
}

export function StickySaveBar({
  isDirty,
  isPending,
  onSubmit,
  form,
  label = '儲存變更',
}: StickySaveBarProps) {
  const show = isDirty || isPending

  // 離開頁面前提示
  useEffect(() => {
    if (!isDirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out',
        show
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0 pointer-events-none'
      )}
    >
      <div className="border-t border-divider bg-white/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-body font-medium">有未儲存的變更</span>
          </div>

          <Button
            type={form === 'submit' ? 'submit' : 'button'}
            onClick={form === 'submit' ? undefined : onSubmit}
            disabled={isPending}
            className="bg-cta hover:bg-cta-hover text-white rounded-full px-6 shadow-sm"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                儲存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {label}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
