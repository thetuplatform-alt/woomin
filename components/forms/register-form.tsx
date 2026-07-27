// components/forms/register-form.tsx
// 註冊表單元件
// 使用 Server Actions 處理表單提交，zod 驗證

'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { registerUser } from '@/lib/actions/auth'
import { Loader2 } from 'lucide-react'
import { trackMetaPixelEvent } from '@/components/common/meta-pixel-events'

// 初始狀態
const initialState: { error?: string; success?: boolean } = {}

interface RegisterFormProps {
  callbackUrl?: string
}

export function RegisterForm({ callbackUrl }: RegisterFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(registerUser, initialState)

  // 註冊成功後導向登入頁面（保留 callbackUrl）
  useEffect(() => {
    if (state?.success) {
      // PostHog 註冊事件已在伺服器端 (lib/actions/auth.ts) 追蹤，此處不重複追蹤
      // Meta Pixel: CompleteRegistration
      trackMetaPixelEvent('CompleteRegistration', {
        status: 'success',
        currency: 'TWD',
      })
      const loginUrl = callbackUrl
        ? `/login?registered=true&callbackUrl=${encodeURIComponent(callbackUrl)}`
        : '/login?registered=true'
      router.push(loginUrl)
    }
  }, [state?.success, router, callbackUrl])

  return (
    <div className="rounded-2xl border border-divider bg-white p-8 shadow-none">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-heading">註冊</h3>
          <p className="text-sm text-body">
            填寫以下資訊建立您的帳號
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {/* 錯誤訊息 */}
          {state?.error && (
            <div className="p-3 text-sm text-red-500 bg-red-50/50 border border-red-200 rounded-lg">
              {state.error}
            </div>
          )}

          {/* 成功訊息 */}
          {state?.success && (
            <div className="p-3 text-sm text-green-500 bg-green-50/50 border border-green-200 rounded-lg">
              註冊成功！正在導向登入頁面...
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-heading">姓名</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="請輸入您的姓名"
              required
              disabled={isPending}
              className="rounded-lg border border-divider bg-white px-4 py-6 text-heading placeholder:text-caption focus:border-cta focus:ring-cta/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-heading">電子郵件</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
              disabled={isPending}
              className="rounded-lg border border-divider bg-white px-4 py-6 text-heading placeholder:text-caption focus:border-cta focus:ring-cta/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-heading">密碼</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="請輸入密碼（至少 8 個字元）"
              required
              disabled={isPending}
              className="rounded-lg border border-divider bg-white px-4 py-6 text-heading placeholder:text-caption focus:border-cta focus:ring-cta/20"
            />
            <p className="text-xs text-caption">
              密碼至少需要 8 個字元
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-heading">確認密碼</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="請再次輸入密碼"
              required
              disabled={isPending}
              className="rounded-lg border border-divider bg-white px-4 py-6 text-heading placeholder:text-caption focus:border-cta focus:ring-cta/20"
            />
          </div>

          <p className="text-xs leading-relaxed text-caption">
            註冊即代表您同意本站的{' '}
            <a href="/terms" target="_blank" rel="noreferrer" className="text-cta underline hover:text-cta-hover">
              服務條款
            </a>
            {' 與 '}
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-cta underline hover:text-cta-hover">
              隱私政策
            </a>
            。
          </p>

          <div className="space-y-3 rounded-lg border border-divider bg-surface p-3">
            <label className="flex items-start gap-3 text-sm text-body">
              <Checkbox name="generalEmailConsent" className="mt-0.5" />
              <span>接收學習資源電子報、開課公告與平台內容更新。</span>
            </label>
            <label className="flex items-start gap-3 text-sm text-body">
              <Checkbox name="marketingConsent" className="mt-0.5" />
              <span>我明確同意接收課程促銷、優惠碼與限時活動電子報（可隨時退訂）。</span>
            </label>
          </div>

          <Button
            type="submit"
            className="w-full rounded-full bg-cta py-6 text-base font-semibold text-white transition-colors hover:bg-cta-hover"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                註冊中...
              </>
            ) : (
              '建立帳號'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
