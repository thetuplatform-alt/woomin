import fs from 'node:fs'
import path from 'node:path'
import {
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
      action: jest.fn().mockResolvedValue({ success: true }),
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

  it('keeps the component contract outside an async transition', () => {
    expect(loginFormSource).not.toContain('useTransition')
    expect(loginFormSource).not.toMatch(/startTransition\s*\(\s*async/)
    expect(loginFormSource).toContain('replaceWindowLocation(redirectTo)')
    expect(loginFormSource).not.toContain('window.location.assign')
  })
})
