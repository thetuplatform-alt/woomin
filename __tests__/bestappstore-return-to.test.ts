import { resolveLoginReturnTo, resolveSafeReturnTo } from '@/lib/auth-return-to'

describe('BestAppStore safe returnTo', () => {
  it.each([
    ['/lumi-series', '/lumi-series'],
    ['/lumi-series/launch/today-where-to-go', '/lumi-series/launch/today-where-to-go'],
    ['/my-services', '/my-services'],
    ['/courses/my-course/lessons/lesson_1', '/courses/my-course/lessons/lesson_1'],
    ['/checkout?courseId=course_1&plan=plan_1', '/checkout?courseId=course_1&plan=plan_1'],
    ['/admin/setup', '/admin/setup'],
  ])('allows a known internal route: %s', (input, expected) => {
    expect(resolveSafeReturnTo(input)).toBe(expected)
  })

  it.each([
    'https://evil.example/steal',
    '//evil.example/steal',
    '/\\evil.example/steal',
    'javascript:alert(1)',
    '/unknown-route',
    '/lumi-series/launch/../../admin',
    '/checkout?returnTo=https://evil.example',
    '',
    null,
    undefined,
  ])('rejects a non-allowlisted destination: %s', (input) => {
    expect(resolveSafeReturnTo(input)).toBeNull()
  })

  it('prefers a safe returnTo and remains compatible with a legacy callbackUrl', () => {
    expect(resolveLoginReturnTo({ returnTo: '/lumi-series', callbackUrl: '/my-services' }))
      .toBe('/lumi-series')
    expect(resolveLoginReturnTo({ returnTo: 'https://evil.example', callbackUrl: '/my-services' }))
      .toBe('/my-services')
  })
})
