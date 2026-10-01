import { resolveSafeReturnTo } from '@/lib/auth-return-to'

export type LoginActionResult = {
  error?: string
  success?: boolean
  redirectTo?: string
}

type SubmissionLock = { current: boolean }

const DEFAULT_POST_LOGIN_PATH = '/my-services'
const DEFAULT_LOGIN_ERROR = '登入時發生錯誤，請稍後再試'

export function resolveSuccessfulLoginRedirect(
  result: LoginActionResult,
  returnTo?: string
): string | null {
  if (!result.success) return null

  return (
    resolveSafeReturnTo(result.redirectTo) ??
    resolveSafeReturnTo(returnTo) ??
    DEFAULT_POST_LOGIN_PATH
  )
}

export function getLoginFailureFeedback(
  email: string,
  result?: LoginActionResult
): { email: string; password: ''; error: string } {
  return {
    email,
    password: '',
    error: result?.error || DEFAULT_LOGIN_ERROR,
  }
}

export function tryBeginLoginSubmission(lock: SubmissionLock): boolean {
  if (lock.current) return false
  lock.current = true
  return true
}

export function finishLoginSubmission(lock: SubmissionLock): void {
  lock.current = false
}
