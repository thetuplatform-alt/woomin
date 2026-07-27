// components/forms/login-form.tsx
// 登入表單元件
// 使用 Server Actions 處理表單提交

'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginWithCredentials, loginWithGoogle, loginWithApple } from '@/lib/actions/auth'
import { Loader2 } from 'lucide-react'

// 初始狀態
const initialState: { error?: string; success?: boolean; redirectTo?: string } = {}

interface LoginFormProps {
  callbackUrl?: string
  oauthErrorMessage?: string
  resetSuccess?: boolean
  googleEnabled?: boolean
  appleEnabled?: boolean
}

export function LoginForm({
  callbackUrl,
  oauthErrorMessage,
  resetSuccess,
  googleEnabled = true,
  appleEnabled = true,
}: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginWithCredentials, initialState)

  useEffect(() => {
    if (state?.success) {
      // PostHog 登入事件已在伺服器端 (lib/actions/auth.ts) 追蹤，此處不重複追蹤
      // 使用硬導向確保瀏覽器帶著新的 session cookie 發起請求
      window.location.href = state.redirectTo || callbackUrl || '/'
    }
  }, [state?.success, state?.redirectTo, callbackUrl])

  return (
    <div className="rounded-2xl border border-divider bg-white p-8 shadow-none">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-heading">登入</h3>
          <p className="text-sm text-body">
            選擇您偏好的登入方式
          </p>
        </div>

        {oauthErrorMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {oauthErrorMessage}
          </div>
        )}
        {resetSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            密碼已重設，請使用新密碼登入。
          </div>
        )}

        {/* OAuth 登入按鈕 */}
        {(googleEnabled || appleEnabled) && (
          <div className={`grid gap-4 ${googleEnabled && appleEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {googleEnabled && (
              <form action={loginWithGoogle}>
                {callbackUrl && (
                  <input type="hidden" name="callbackUrl" value={callbackUrl} />
                )}
                <Button
                  variant="outline"
                  type="submit"
                  className="w-full rounded-full border-divider bg-transparent py-6 text-sm font-medium text-heading transition-colors hover:bg-surface"
                >
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  Google
                </Button>
              </form>
            )}
            {appleEnabled && (
              <form action={loginWithApple}>
                {callbackUrl && (
                  <input type="hidden" name="callbackUrl" value={callbackUrl} />
                )}
                <Button
                  variant="outline"
                  type="submit"
                  className="w-full rounded-full border-divider bg-transparent py-6 text-sm font-medium text-heading transition-colors hover:bg-surface"
                >
                  <AppleIcon className="mr-2 h-4 w-4" />
                  Apple
                </Button>
              </form>
            )}
          </div>
        )}

        {/* 分隔線 */}
        {(googleEnabled || appleEnabled) && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-divider" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-caption">
                或使用電子郵件
              </span>
            </div>
          </div>
        )}

        {/* 電子郵件登入表單 */}
        <form action={formAction} className="space-y-4">
          {callbackUrl && (
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
          )}
          {/* 錯誤訊息 */}
          {state?.error && (
            <div className="p-3 text-sm text-red-500 bg-red-50/50 border border-red-200 rounded-lg">
              {state.error}
            </div>
          )}

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
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-heading">密碼</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-caption hover:text-cta transition-colors"
              >
                忘記密碼？
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="請輸入密碼"
              required
              disabled={isPending}
              className="rounded-lg border border-divider bg-white px-4 py-6 text-heading placeholder:text-caption focus:border-cta focus:ring-cta/20"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full rounded-full bg-cta py-6 text-base font-semibold text-white transition-colors hover:bg-cta-hover" 
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登入中...
              </>
            ) : (
              '登入'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

// Google 圖標
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// Apple 圖標
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}
