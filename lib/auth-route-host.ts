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
    if (url.host === baseUrl.host) return req
    url.protocol = baseUrl.protocol
    url.host = baseUrl.host
    const headers = new Headers(req.headers)
    headers.set('host', baseUrl.host)
    headers.set('x-forwarded-host', baseUrl.hostname)
    headers.set('x-forwarded-proto', baseUrl.protocol.replace(/:$/, ''))
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
