import { resolveSafeReturnTo } from '@/lib/auth-return-to'

export type LoginActionResult = {
  error?: string
  success?: boolean
  redirectTo?: string
}

type SubmissionLock = { current: boolean }

type LoginNavigationFallback = {
  message: string
  target: string
}

type LoginNavigationOptions = {
  redirectTo: string
  onFallback: (fallback: LoginNavigationFallback) => void
  replace?: (url: string) => void
  schedule?: (callback: () => void, delayMs: number) => number
  cancel?: (timerId: number) => void
  subscribeToPageHide?: (callback: () => void) => () => void
  watchdogMs?: number
}

const DEFAULT_POST_LOGIN_PATH = '/my-services'
const DEFAULT_LOGIN_ERROR = '登入時發生錯誤，請稍後再試'
const LOGIN_NAVIGATION_FALLBACK_MESSAGE = '登入已成功，但自動前往頁面未完成。'
export const LOGIN_NAVIGATION_WATCHDOG_MS = 2000

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

export function replaceWindowLocation(
  redirectTo: string,
  replace: (url: string) => void = (url) => window.location.replace(url)
): void {
  replace(redirectTo)
}

export function beginLoginNavigation({
  redirectTo,
  onFallback,
  replace = (url) => window.location.replace(url),
  schedule = (callback, delayMs) => window.setTimeout(callback, delayMs),
  cancel = (timerId) => window.clearTimeout(timerId),
  subscribeToPageHide = (callback) => {
    window.addEventListener('pagehide', callback, { once: true })
    return () => window.removeEventListener('pagehide', callback)
  },
  watchdogMs = LOGIN_NAVIGATION_WATCHDOG_MS,
}: LoginNavigationOptions): () => void {
  let settled = false
  const runtime: {
    timerId?: number
    unsubscribe: () => void
  } = {
    unsubscribe: () => undefined,
  }

  const settle = () => {
    if (settled) return
    settled = true
    if (runtime.timerId !== undefined) cancel(runtime.timerId)
    runtime.unsubscribe()
  }

  const showFallback = () => {
    if (settled) return
    settled = true
    if (runtime.timerId !== undefined) cancel(runtime.timerId)
    runtime.unsubscribe()
    onFallback({
      message: LOGIN_NAVIGATION_FALLBACK_MESSAGE,
      target: redirectTo,
    })
  }

  runtime.unsubscribe = subscribeToPageHide(settle)
  runtime.timerId = schedule(showFallback, watchdogMs)

  try {
    replaceWindowLocation(redirectTo, replace)
  } catch {
    showFallback()
  }

  return settle
}
