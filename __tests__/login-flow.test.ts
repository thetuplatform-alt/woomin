import {
  finishLoginSubmission,
  getLoginFailureFeedback,
  resolveSuccessfulLoginRedirect,
  tryBeginLoginSubmission,
} from '@/lib/login-flow'

describe('credentials login UX flow', () => {
  it('redirects valid credentials to a safe returnTo', () => {
    expect(
      resolveSuccessfulLoginRedirect(
        { success: true, redirectTo: '/lumi-series' },
        '/my-services'
      )
    ).toBe('/lumi-series')
  })

  it('uses the existing fallback after valid credentials without returnTo', () => {
    expect(resolveSuccessfulLoginRedirect({ success: true })).toBe('/my-services')
  })

  it('does not redirect after invalid credentials', () => {
    expect(
      resolveSuccessfulLoginRedirect({ error: '電子郵件或密碼錯誤' }, '/lumi-series')
    ).toBeNull()
  })

  it('preserves email, clears password, and keeps the explicit failure message', () => {
    expect(
      getLoginFailureFeedback('member@example.com', {
        error: '電子郵件或密碼錯誤',
      })
    ).toEqual({
      email: 'member@example.com',
      password: '',
      error: '電子郵件或密碼錯誤',
    })
  })

  it('prevents a second submission until a failed attempt finishes', () => {
    const lock = { current: false }

    expect(tryBeginLoginSubmission(lock)).toBe(true)
    expect(tryBeginLoginSubmission(lock)).toBe(false)
    finishLoginSubmission(lock)
    expect(tryBeginLoginSubmission(lock)).toBe(true)
  })

  it('resolves the safe path on the canonical production origin', () => {
    const path = resolveSuccessfulLoginRedirect(
      { success: true, redirectTo: '/lumi-series' }
    )

    expect(new URL(path!, 'https://bestappstore.co.uk/login').toString()).toBe(
      'https://bestappstore.co.uk/lumi-series'
    )
  })

  it('rejects malicious or external returnTo values', () => {
    expect(
      resolveSuccessfulLoginRedirect(
        { success: true, redirectTo: 'https://evil.example/steal' },
        '//evil.example/steal'
      )
    ).toBe('/my-services')
  })
})
