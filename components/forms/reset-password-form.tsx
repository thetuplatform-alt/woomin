'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ResetPasswordFormProps {
  token: string
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 8) {
      setError('密碼至少需要 8 個字元')
      return
    }

    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致')
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '重設失敗')
      }

      setSuccess(result.message || '密碼已重設，正在導向登入頁')
      setTimeout(() => {
        router.push('/login?reset=true')
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重設失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <Input
        type="password"
        placeholder="設定新密碼（至少 8 碼）"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="h-12 rounded-xl border-divider"
        minLength={8}
        autoComplete="new-password"
        required
      />
      <Input
        type="password"
        placeholder="再次輸入新密碼"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        className="h-12 rounded-xl border-divider"
        minLength={8}
        autoComplete="new-password"
        required
      />

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">{success}</p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-full bg-cta py-6 text-base font-bold text-white hover:bg-cta-hover"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            重設中...
          </>
        ) : (
          '重設密碼'
        )}
      </Button>

      <p className="text-center text-xs text-caption">
        <Link href="/login" className="text-body hover:text-heading underline">
          返回登入
        </Link>
      </p>
    </form>
  )
}
