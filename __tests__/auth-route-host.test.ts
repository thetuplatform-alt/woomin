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
      headers: {
        host: 'aiver.me',
        'x-forwarded-host': 'aiver.me',
        'x-forwarded-proto': 'https',
      },
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

  it('清除相同 hostname 上的內部 runtime port', () => {
    process.env.APP_URL = 'https://bestappstore.co.uk'
    const request = new NextRequest(
      'https://bestappstore.co.uk:8080/api/auth/providers',
      {
        headers: {
          host: 'bestappstore.co.uk:8080',
          'x-forwarded-host': 'bestappstore.co.uk:8080',
          'x-forwarded-proto': 'https',
          'x-forwarded-port': '8080',
        },
      }
    )

    const patched = patchHost(request)
    const patchedUrl = new URL(patched.url)

    expect(patchedUrl.toString()).toBe(
      'https://bestappstore.co.uk/api/auth/providers'
    )
    expect(patchedUrl.port).toBe('')
    expect(patched.headers.get('host')).toBe('bestappstore.co.uk')
    expect(patched.headers.get('x-forwarded-host')).toBe('bestappstore.co.uk')
    expect(patched.headers.get('x-forwarded-port')).toBeNull()
  })

  it('將不同 hostname 與 port canonicalize 成 APP_URL origin', () => {
    process.env.APP_URL = 'https://bestappstore.co.uk'
    const request = new NextRequest(
      'http://internal-host:8080/api/auth/providers',
      {
        headers: {
          host: 'internal-host:8080',
          'x-forwarded-host': 'internal-host:8080',
          'x-forwarded-proto': 'http',
          'x-forwarded-port': '8080',
        },
      }
    )

    const patched = patchHost(request)

    expect(new URL(patched.url).origin).toBe('https://bestappstore.co.uk')
    expect(patched.headers.get('x-forwarded-port')).toBeNull()
  })

  it('保留 APP_URL 明確指定的非標準 port', () => {
    process.env.APP_URL = 'https://example.com:8443'
    const request = new NextRequest(
      'http://internal-host:8080/api/auth/providers',
      {
        headers: {
          host: 'internal-host:8080',
          'x-forwarded-host': 'internal-host:8080',
          'x-forwarded-proto': 'http',
          'x-forwarded-port': '8080',
        },
      }
    )

    const patched = patchHost(request)

    expect(new URL(patched.url).origin).toBe('https://example.com:8443')
    expect(new URL(patched.url).port).toBe('8443')
    expect(patched.headers.get('host')).toBe('example.com:8443')
    expect(patched.headers.get('x-forwarded-host')).toBe('example.com:8443')
    expect(patched.headers.get('x-forwarded-port')).toBe('8443')
  })

})
