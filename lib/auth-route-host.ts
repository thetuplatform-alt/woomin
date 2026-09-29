import { NextRequest } from 'next/server'

type PatchedRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>

// 主機入口不一定會轉送 host header，Next.js 可能 fallback 到 process.env.HOSTNAME。
// 強制用 APP_URL 修正 request.url，確保 Auth.js 產出正確的 callbackUrl。
export function patchHost(req: NextRequest): NextRequest {
  const base = process.env.APP_URL || process.env.AUTH_URL
  if (!base) return req
  try {
    const baseUrl = new URL(base)
    const url = new URL(req.url)
    const forwardedPort = req.headers.get('x-forwarded-port')
    const hasCanonicalForwardedPort = baseUrl.port
      ? forwardedPort === baseUrl.port
      : forwardedPort === null
    if (
      url.origin === baseUrl.origin &&
      req.headers.get('host') === baseUrl.host &&
      req.headers.get('x-forwarded-host') === baseUrl.host &&
      req.headers.get('x-forwarded-proto') === baseUrl.protocol.replace(/:$/, '') &&
      hasCanonicalForwardedPort
    ) {
      return req
    }
    url.protocol = baseUrl.protocol
    url.hostname = baseUrl.hostname
    url.port = baseUrl.port
    const headers = new Headers(req.headers)
    headers.set('host', baseUrl.host)
    headers.set('x-forwarded-host', baseUrl.host)
    headers.set('x-forwarded-proto', baseUrl.protocol.replace(/:$/, ''))
    if (baseUrl.port) {
      headers.set('x-forwarded-port', baseUrl.port)
    } else {
      headers.delete('x-forwarded-port')
    }
    const init: PatchedRequestInit = {
      method: req.method,
      headers,
    }
    if (req.body) {
      init.body = req.body as unknown as BodyInit
      init.duplex = 'half'
    }

    return new NextRequest(url.toString(), init)
  } catch {
    return req
  }
}
