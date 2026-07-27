'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ActivateAccountClientProps {
  token: string
}

export function ActivateAccountClient({ token }: ActivateAccountClientProps) {
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

    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致')
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/auth/guest-activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '啟用失敗')
      }

      setSuccess(result.message || '帳號已啟用，正在導向登入頁')
      setTimeout(() => {
        router.push('/login?activated=true')
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : '啟用失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <Input
        type="password"
        placeholder="設定密碼（至少 8 個字元）"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="h-12 rounded-xl border-divider"
        required
      />
      <Input
        type="password"
        placeholder="再次輸入密碼"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        className="h-12 rounded-xl border-divider"
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
            啟用中...
          </>
        ) : (
          '啟用帳號'
        )}
      </Button>

      <p className="text-center text-xs text-caption">
        已有密碼？
        <Link href="/login" className="ml-1 text-body hover:text-heading underline">
          直接登入
        </Link>
      </p>
    </form>
  )
}
