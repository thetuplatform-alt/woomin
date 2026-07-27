'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle } from 'lucide-react'
import { requestPasswordReset } from '@/lib/actions/auth'

const initialState: { error?: string; success?: boolean } = {}

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState)

  return (
    <div className="rounded-2xl border border-divider bg-white p-8 shadow-none">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-heading">忘記密碼</h3>
          <p className="text-sm text-body">
            輸入您的電子郵件，我們將發送密碼重設連結給您
          </p>
        </div>

        {state?.success ? (
          <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <div className="text-sm text-green-700">
              <p className="font-medium">連結已寄出</p>
              <p className="mt-1">我們已將設定密碼的連結寄到這個信箱，請於幾分鐘內查收（記得檢查垃圾郵件資料夾）。連結 1 小時內有效。</p>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
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

            <Button
              type="submit"
              className="w-full rounded-full bg-cta py-6 text-base font-semibold text-white transition-colors hover:bg-cta-hover"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  發送中...
                </>
              ) : (
                '發送重設連結'
              )}
            </Button>
          </form>
        )}

        <div className="text-center text-sm text-body">
          <Link
            href="/login"
            className="font-semibold text-cta hover:text-cta-hover transition-colors"
          >
            返回登入
          </Link>
        </div>
      </div>
    </div>
  )
}
