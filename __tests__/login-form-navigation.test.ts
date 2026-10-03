import fs from 'node:fs'
import path from 'node:path'
import {
  beginLoginNavigation,
  finishLoginSubmission,
  getLoginFailureFeedback,
  replaceWindowLocation,
  resolveSuccessfulLoginRedirect,
  tryBeginLoginSubmission,
  type LoginActionResult,
} from '@/lib/login-flow'

const loginFormSource = fs.readFileSync(
  path.join(process.cwd(), 'components/forms/login-form.tsx'),
  'utf8'
)

async function runLoginFormSuccessFlow(params: {
  action: () => Promise<LoginActionResult>
  returnTo?: string
  replace: (url: string) => void
}) {
  const result = await params.action()
  const redirectTo = resolveSuccessfulLoginRedirect(result, params.returnTo)

  if (redirectTo) replaceWindowLocation(redirectTo, params.replace)

  return redirectTo
}

describe('LoginForm navigation reliability', () => {
  it('calls credentials once and replaces to a safe returnTo', async () => {
    const action = jest.fn().mockResolvedValue({
      success: true,
      redirectTo: '/my-services',
    })
    const replace = jest.fn()

    await runLoginFormSuccessFlow({ action, returnTo: '/my-services', replace })

    expect(action).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/my-services')
  })

  it('uses /my-services when a successful response has no returnTo', async () => {
    const replace = jest.fn()

    await runLoginFormSuccessFlow({
      action: jest.fn().mockResolvedValue({
        success: true,
        redirectTo: '/my-services',
      }),
      replace,
    })

    expect(replace).toHaveBeenCalledWith('/my-services')
  })

  it('keeps email, clears password, shows the error, and does not navigate', () => {
    const replace = jest.fn()
    const result = { error: 'Invalid credentials' }
    const redirectTo = resolveSuccessfulLoginRedirect(result, '/my-services')
    const feedback = getLoginFailureFeedback('member@example.com', result)

    if (redirectTo) replaceWindowLocation(redirectTo, replace)

    expect(replace).not.toHaveBeenCalled()
    expect(feedback).toEqual({
      email: 'member@example.com',
      password: '',
      error: 'Invalid credentials',
    })
  })

  it.each(['https://evil.example/steal', '//evil.example/steal'])(
    'rejects unsafe returnTo %s and uses the safe fallback',
    async (returnTo) => {
      const replace = jest.fn()

      await runLoginFormSuccessFlow({
        action: jest.fn().mockResolvedValue({ success: true, redirectTo: returnTo }),
        returnTo,
        replace,
      })

      expect(replace).toHaveBeenCalledWith('/my-services')
    }
  )

  it('prevents a double submit from invoking the action twice', async () => {
    const lock = { current: false }
    const action = jest.fn().mockResolvedValue({ success: true })
    const submissions: Array<Promise<LoginActionResult>> = []

    if (tryBeginLoginSubmission(lock)) submissions.push(action())
    if (tryBeginLoginSubmission(lock)) submissions.push(action())
    await Promise.all(submissions)
    finishLoginSubmission(lock)

    expect(action).toHaveBeenCalledTimes(1)
  })

  it('releases the lock and exposes /my-services when replace throws', () => {
    const lock = { current: true }
    const onFallback = jest.fn((fallback) => {
      finishLoginSubmission(lock)
      expect(fallback.target).toBe('/my-services')
    })

    beginLoginNavigation({
      redirectTo: '/my-services',
      onFallback,
      replace: () => {
        throw new Error('navigation failed')
      },
      schedule: jest.fn(() => 1),
      cancel: jest.fn(),
      subscribeToPageHide: jest.fn(() => jest.fn()),
    })

    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(lock.current).toBe(false)
  })

  it('leaves redirecting state through the watchdog when navigation does not complete', () => {
    let watchdog: () => void = () => undefined
    let isRedirecting = true
    const lock = { current: true }
    const replace = jest.fn()
    const onFallback = jest.fn((fallback) => {
      isRedirecting = false
      finishLoginSubmission(lock)
      expect(fallback).toEqual({
        message: '登入已成功，但自動前往頁面未完成。',
        target: '/my-services',
      })
    })

    beginLoginNavigation({
      redirectTo: '/my-services',
      onFallback,
      replace,
      schedule: (callback) => {
        watchdog = callback
        return 1
      },
      cancel: jest.fn(),
      subscribeToPageHide: jest.fn(() => jest.fn()),
    })
    watchdog()

    expect(replace).toHaveBeenCalledTimes(1)
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(isRedirecting).toBe(false)
    expect(lock.current).toBe(false)
  })

  it('cancels the watchdog on pagehide without a second navigation', () => {
    let pageHide: () => void = () => undefined
    let watchdog: () => void = () => undefined
    const replace = jest.fn()
    const cancel = jest.fn()
    const onFallback = jest.fn()

    beginLoginNavigation({
      redirectTo: '/my-services',
      onFallback,
      replace,
      schedule: (callback) => {
        watchdog = callback
        return 7
      },
      cancel,
      subscribeToPageHide: (callback) => {
        pageHide = callback
        return jest.fn()
      },
    })
    pageHide()
    watchdog()

    expect(replace).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith(7)
    expect(onFallback).not.toHaveBeenCalled()
  })

  it('keeps the component contract outside an async transition', () => {
    expect(loginFormSource).not.toContain('useTransition')
    expect(loginFormSource).not.toMatch(/startTransition\s*\(\s*async/)
    expect(loginFormSource).toContain('beginLoginNavigation({')
    expect(loginFormSource).toContain('setNavigationFallback(fallback)')
    expect(loginFormSource).toContain('前往我的服務')
    expect(loginFormSource).not.toContain('window.location.assign')
  })
})
