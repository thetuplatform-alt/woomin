import { NextRequest } from 'next/server'
import { patchHost } from '@/lib/auth-route-host'

describe('patchHost', () => {
  const originalAppUrl = process.env.APP_URL
  const originalAuthUrl = process.env.AUTH_URL

  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL
    else process.env.APP_URL = originalAppUrl

    if (originalAuthUrl === undefined) delete process.env.AUTH_URL
    else process.env.AUTH_URL = originalAuthUrl
  })

  it('APP_URL、AUTH_URL 都沒設定時，原樣回傳 request、完全不改寫', () => {
    delete process.env.APP_URL
    delete process.env.AUTH_URL

    const request = new NextRequest('http://internal-host/api/auth/session', {
      headers: { host: 'internal-host' },
    })

    expect(patchHost(request)).toBe(request)
    expect(request.headers.get('host')).toBe('internal-host')
    expect(request.headers.get('x-forwarded-host')).toBeNull()
  })

  it('對已經是 APP_URL host 的 request 保持 no-op', () => {
    process.env.APP_URL = 'https://aiver.me'
    const request = new NextRequest('https://aiver.me/api/auth/session', {
      headers: { host: 'aiver.me', 'x-forwarded-host': 'aiver.me' },
    })

    expect(patchHost(request)).toBe(request)
    expect(request.headers.get('host')).toBe('aiver.me')
    expect(request.headers.get('x-forwarded-host')).toBe('aiver.me')
  })

  it('對不同 host 的 request 改寫成 APP_URL host', () => {
    process.env.APP_URL = 'https://aiver.me'
    const request = new NextRequest('http://internal-host/api/auth/session', {
      headers: { host: 'internal-host' },
    })

    const patched = patchHost(request)

    expect(patched).not.toBe(request)
    expect(new URL(patched.url).host).toBe('aiver.me')
    expect(patched.headers.get('host')).toBe('aiver.me')
    expect(patched.headers.get('x-forwarded-host')).toBe('aiver.me')
    expect(patched.headers.get('x-forwarded-proto')).toBe('https')
  })
})
