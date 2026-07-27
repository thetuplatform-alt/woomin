import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ path: string[] }>
}

interface PublicUploadDeps {
  readLocalStorageObject: (key: string) => Promise<{ success: boolean; buffer?: Buffer; error?: string }>
  findMediaByFilename: (
    key: string
  ) => Promise<{ mimeType: string; type: string; originalName?: string | null } | null>
}

function getInlineUrlFlag(request: NextRequest) {
  return request.nextUrl.searchParams.get('inline') === '1'
}

export function createPublicUploadImageHandler(deps: PublicUploadDeps) {
  return async function GET(request: NextRequest, context: RouteContext) {
    const { path } = await context.params
    const key = path.join('/')

    const result = await deps.readLocalStorageObject(key)
    if (!result.success || !result.buffer) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
    }

    const media = await deps.findMediaByFilename(key)
    if (!media || (media.type !== 'IMAGE' && media.type !== 'ATTACHMENT')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const headers = new Headers({
      'Content-Type': media.mimeType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })

    if (media.type === 'ATTACHMENT') {
      const filename = media.originalName || key.split('/').pop() || 'download'
      const disposition =
        media.mimeType === 'application/pdf' && getInlineUrlFlag(request)
          ? 'inline'
          : 'attachment'
      headers.set('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`)
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers,
    })
  }
}
